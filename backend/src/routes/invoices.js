const express = require('express');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const MonthlyWallet = require('../models/MonthlyWallet');
const Wallet = require('../models/Wallet');
const OtpToken = require('../models/OtpToken');
const Division = require('../models/Division');
const { protect, authorize } = require('../middleware/auth');
const { sendSmsOtp, sendRedemptionConfirmation } = require('../config/sms');

const router = express.Router();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const generateUniqueReferenceNo = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const refNo = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = await Invoice.findOne({ referenceNo: refNo });
    if (!exists) {
      return refNo;
    }
    attempts++;
  }
  throw new Error('Could not generate unique reference number after 10 attempts');
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/invoices/redeem/send-otp
// @desc    Send OTP to vendor's mobile for wallet redemption
// @access  Branch only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem/send-otp', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, redeemAmount, invoiceAmount } = req.body;

    if (!vendorId || !redeemAmount) {
      return res.status(400).json({ success: false, message: 'Vendor ID and redeem amount are required' });
    }

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    if (invoiceAmount) {
      const invoiceAmt = parseFloat(invoiceAmount);
      if (isNaN(invoiceAmt) || invoiceAmt <= 0) {
        return res.status(400).json({ success: false, message: 'Invoice amount must be greater than 0' });
      }
      if (amount > invoiceAmt) {
        return res.status(400).json({ success: false, message: 'Wallet redemption amount cannot exceed invoice amount' });
      }
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendor.status === 'blocked') return res.status(403).json({ success: false, message: 'Vendor is blocked' });

    if (amount > vendor.walletBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! Only ₹${vendor.walletBalance.toFixed(2)} available`,
      });
    }

    if (!vendor.mobileNumber) {
      return res.status(400).json({ success: false, message: 'Vendor has no mobile number registered' });
    }

    // ── Rate limit: max 3 OTPs per vendor mobile per 30 minutes ──────────────
    const otpWindowStart = new Date(Date.now() - 30 * 60 * 1000);
    const recentOtpCount = await OtpToken.countDocuments({
      email: vendor.mobileNumber,
      purpose: 'redemption',
      createdAt: { $gte: otpWindowStart },
    });

    if (recentOtpCount >= 3) {
      const oldestOtp = await OtpToken.findOne({
        email: vendor.mobileNumber,
        purpose: 'redemption',
        createdAt: { $gte: otpWindowStart },
      }).sort({ createdAt: 1 }).lean();

      const retryAfterMs = oldestOtp
        ? new Date(oldestOtp.createdAt).getTime() + 30 * 60 * 1000 - Date.now()
        : 0;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      return res.status(429).json({
        success: false,
        message: `OTP limit reached. You can send a maximum of 3 OTPs per 30 minutes for this party.`,
        retryAfterSeconds,
        otpCount: recentOtpCount,
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Mark old unused OTPs for this branch user as used (don't delete — keeps count accurate)
    await OtpToken.updateMany(
      { user: req.user._id, purpose: 'redemption', used: false },
      { $set: { used: true } }
    );

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await OtpToken.create({
      user: req.user._id,
      email: vendor.mobileNumber, // reusing email field to store mobile
      otpCode: otp,
      purpose: 'redemption',
      expiresAt,
    });

    let smsSent = false;
    let devOtp = null;
    try {
      const result = await sendSmsOtp(vendor.mobileNumber, otp, vendor.companyName);
      smsSent = true;
      if (result.dev) devOtp = otp;
    } catch (smsErr) {
      console.log(`[SMS FALLBACK] OTP for ${vendor.mobileNumber}: ${otp}`);
      devOtp = otp; // always expose on failure
    }

    // Always expose OTP in non-production for testing
    const exposeOtp = process.env.SHOW_OTP === 'true' || !smsSent || (smsSent && devOtp);

    const maskedMobile = vendor.mobileNumber.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2');

    res.status(200).json({
      success: true,
      message: smsSent && !devOtp ? `OTP sent to ${maskedMobile}` : `OTP generated`,
      maskedMobile,
      otpCount: recentOtpCount + 1, // how many OTPs used now (including this one)
      ...(exposeOtp ? { devOtp: otp } : {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/invoices/redeem
// @desc    Verify OTP then debit wallet + send confirmation SMS
// @access  Branch only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, redeemAmount, invoiceAmount, invoiceId, otp } = req.body;

    if (!vendorId || !redeemAmount || !otp) {
      return res.status(400).json({ success: false, message: 'Vendor ID, redeem amount and OTP are required' });
    }

    // Verify OTP
    const otpRecord = await OtpToken.findOne({
      user: req.user._id,
      otpCode: otp,
      purpose: 'redemption',
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    if (invoiceAmount) {
      const invoiceAmt = parseFloat(invoiceAmount);
      if (isNaN(invoiceAmt) || invoiceAmt <= 0) {
        return res.status(400).json({ success: false, message: 'Invoice amount must be greater than 0' });
      }
      if (amount > invoiceAmt) {
        return res.status(400).json({ success: false, message: 'Wallet redemption amount cannot exceed invoice amount' });
      }
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    if (amount > vendor.walletBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! Only ₹${vendor.walletBalance.toFixed(2)} available`,
      });
    }

    // Mark OTP used
    otpRecord.used = true;
    await otpRecord.save();

    const newBalance = parseFloat((vendor.walletBalance - amount).toFixed(2));

    await Vendor.findByIdAndUpdate(vendorId, {
      walletBalance: newBalance,
      lastRedemptionAmount: amount,
      lastRedemptionDate: new Date(),
    });

    await WalletTransaction.create({
      vendor: vendorId,
      invoice: invoiceId || null,
      type: 'debit',
      amount,
      balanceAfter: newBalance,
      description: `Wallet redemption of ₹${amount}`,
      processedBy: req.user._id,
    });

    const invoiceRecord = invoiceId ? await Invoice.findById(invoiceId).select('invoiceNumber referenceNo').lean() : null;
    const invoiceNumberText = invoiceRecord?.invoiceNumber || invoiceId || 'N/A';

    // Send confirmation SMS (non-blocking — redemption already done)
    sendRedemptionConfirmation(
      vendor.mobileNumber,
      vendor.companyName,
      amount,
      invoiceNumberText,
      newBalance,
      invoiceRecord?.referenceNo
    ).then(r => console.log('[REDEMPTION MSG RESULT]', JSON.stringify(r)))
     .catch(e => console.error('[REDEMPTION MSG ERROR]', e.message));

    res.status(200).json({
      success: true,
      message: `₹${amount} redeemed successfully`,
      data: {
        redeemedAmount: amount,
        newWalletBalance: newBalance,
        vendorName: vendor.companyName,
        mobileNumber: vendor.mobileNumber,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/invoices
// @desc    Create invoice and deduct wallet balance (with monthly sub-wallet support)
// @access  Branch only
// Body: vendorId, invoiceDate, invoiceNumber, invoiceAmount, location, remark,
//       redeemAmount, otp,
//       redemptions: [{monthlyWalletId, amount}]  ← optional array for split deduction
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, invoiceDate, invoiceNumber, invoiceAmount, location, redeemAmount, otp, remark, redemptions } = req.body;

    if (!vendorId || !invoiceDate || !invoiceNumber || !invoiceAmount) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendor.status === 'blocked') return res.status(403).json({ success: false, message: 'Vendor is blocked' });

    let division = req.user.division;
    if (!division) {
      return res.status(400).json({ success: false, message: 'Branch user division is not set. Please re-login.' });
    }

    const invoiceText = String(invoiceNumber).trim();
    const invoiceFormatRegex = /^\d+\/(?:RS|CSI)\/\d{8}$/i;
    if (!invoiceFormatRegex.test(invoiceText)) {
      return res.status(400).json({ success: false, message: 'Invoice number must be in format 1/RS/26001200 or 5/CSI/15001623' });
    }

    const invoicePrefixMatch = invoiceText.match(/^([^/]+)\/(.+)$/);
    let prefixedInvoiceNumber = invoiceText;

    if (invoicePrefixMatch) {
      const prefix = invoicePrefixMatch[1].trim();
      const matchedDivision = await Division.findOne({ locationCode: prefix });
      if (!matchedDivision) {
        return res.status(400).json({ success: false, message: 'Invalid invoice prefix. Division not found.' });
      }
      division = matchedDivision;
    } else {
      prefixedInvoiceNumber = `${division.locationCode}/${invoiceText}`;
    }

    const existing = await Invoice.findOne({ invoiceNumber: prefixedInvoiceNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This invoice number already exists' });
    }

    const invoiceAmt = parseFloat(invoiceAmount);
    if (isNaN(invoiceAmt) || invoiceAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice amount must be greater than 0' });
    }

    // ── Redemption validation ─────────────────────────────────────────────────
    // redemptions array: [{monthlyWalletId, amount}] — multi-wallet split
    // redeemAmount: total (for backward compat / OTP check)
    const redemptionList = Array.isArray(redemptions) && redemptions.length > 0 ? redemptions : null;
    const redeemAmt = redeemAmount ? parseFloat(redeemAmount) : 0;

    if (isNaN(redeemAmt) || redeemAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Wallet redemption is required to create the invoice' });
    }
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP is required for wallet redemption' });
    }
    if (redeemAmt > invoiceAmt) {
      return res.status(400).json({ success: false, message: 'Wallet redemption amount cannot exceed invoice amount' });
    }

    // Validate redemption list total matches redeemAmt
    if (redemptionList) {
      const listTotal = parseFloat(redemptionList.reduce((s, r) => s + parseFloat(r.amount || 0), 0).toFixed(2));
      if (Math.abs(listTotal - redeemAmt) > 0.01) {
        return res.status(400).json({ success: false, message: 'Redemption amounts do not match total' });
      }
    }

    // Verify OTP
    const otpRecord = await OtpToken.findOne({
      user: req.user._id,
      otpCode: otp,
      purpose: 'redemption',
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    if (redeemAmt > vendor.walletBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! Only ₹${vendor.walletBalance.toFixed(2)} available`,
      });
    }

    // Validate monthly wallet balances & hold status if redemption list provided
    if (redemptionList) {
      for (const r of redemptionList) {
        const mw = await MonthlyWallet.findById(r.monthlyWalletId);
        if (!mw || String(mw.vendor) !== String(vendorId)) {
          return res.status(400).json({ success: false, message: `Monthly wallet not found: ${r.monthlyWalletId}` });
        }
        if (mw.isHold) {
          return res.status(400).json({
            success: false,
            message: `Redemption blocked: Party balance in ${mw.label || 'wallet'} is on hold (${mw.holdReason || 'Held by admin'})`,
          });
        }
        const parentWallet = mw.wallet ? await Wallet.findById(mw.wallet) : await Wallet.findOne({ name: mw.label });
        if (parentWallet && parentWallet.isHold) {
          return res.status(400).json({
            success: false,
            message: `Redemption blocked: Entire wallet "${parentWallet.name}" is on hold (${parentWallet.holdReason || 'Held by admin'})`,
          });
        }
        const amt = parseFloat(r.amount);
        if (amt > mw.balance) {
          return res.status(400).json({
            success: false,
            message: `Insufficient balance in ${mw.label} wallet. Available: ₹${mw.balance}`,
          });
        }
      }
    } else {
      // For auto-deduct, check if available non-held balance is sufficient
      const activeWallets = await MonthlyWallet.find({ vendor: vendorId, balance: { $gt: 0 } }).lean();
      let usableBalance = 0;
      for (const mw of activeWallets) {
        if (mw.isHold) continue;
        const parentWallet = mw.wallet ? await Wallet.findById(mw.wallet) : await Wallet.findOne({ name: mw.label });
        if (parentWallet && parentWallet.isHold) continue;
        usableBalance += mw.balance;
      }
      if (redeemAmt > usableBalance) {
        return res.status(400).json({
          success: false,
          message: `Cannot redeem ₹${redeemAmt.toFixed(2)}. Available unheld balance is ₹${usableBalance.toFixed(2)} (some wallets/balances are on hold).`,
        });
      }
    }

    // Mark OTP used
    otpRecord.used = true;
    await otpRecord.save();

    // ── Deduct from monthly wallets ───────────────────────────────────────────
    let remainingToDeduct = redeemAmt;
    const walletDeductions = []; // [{monthlyWallet, amount, label}]

    if (redemptionList) {
      // Explicit split provided by frontend
      for (const r of redemptionList) {
        const mw = await MonthlyWallet.findById(r.monthlyWalletId);
        const amt = parseFloat(r.amount);
        const newMwBalance = parseFloat((mw.balance - amt).toFixed(2));
        await MonthlyWallet.findByIdAndUpdate(mw._id, { balance: newMwBalance });
        walletDeductions.push({ monthlyWallet: mw._id, amount: amt, label: mw.label });
        remainingToDeduct = parseFloat((remainingToDeduct - amt).toFixed(2));
      }
    } else {
      // Auto-deduct: oldest months first (FIFO), skipping held wallets
      const allWallets = await MonthlyWallet.find({ vendor: vendorId, balance: { $gt: 0 } })
        .sort({ year: 1, month: 1 });
      for (const mw of allWallets) {
        if (remainingToDeduct <= 0) break;
        if (mw.isHold) continue;
        const parentWallet = mw.wallet ? await Wallet.findById(mw.wallet) : await Wallet.findOne({ name: mw.label });
        if (parentWallet && parentWallet.isHold) continue;

        const deduct = Math.min(mw.balance, remainingToDeduct);
        const newMwBalance = parseFloat((mw.balance - deduct).toFixed(2));
        await MonthlyWallet.findByIdAndUpdate(mw._id, { balance: newMwBalance });
        walletDeductions.push({ monthlyWallet: mw._id, amount: deduct, label: mw.label });
        remainingToDeduct = parseFloat((remainingToDeduct - deduct).toFixed(2));
      }
    }

    // ── Deduct from main vendor wallet ────────────────────────────────────────
    const newBalance = parseFloat((vendor.walletBalance - redeemAmt).toFixed(2));
    await Vendor.findByIdAndUpdate(vendorId, {
      walletBalance: newBalance,
      lastRedemptionAmount: redeemAmt,
      lastRedemptionDate: new Date(),
    });
    vendor.walletBalance = newBalance;

    // ── Create invoice ────────────────────────────────────────────────────────
    const divisionId = division._id;
    const invoiceLocation = location || division.location || '';
    const referenceNo = await generateUniqueReferenceNo();

    const invoice = await Invoice.create({
      vendor: vendorId,
      createdBy: req.user._id,
      division: divisionId,
      invoiceNumber: prefixedInvoiceNumber,
      invoiceDate: new Date(invoiceDate),
      invoiceAmount: invoiceAmt,
      location: invoiceLocation,
      remark: remark || '',
      status: 'processed',
      referenceNo,
    });

    // ── WalletTransaction records (one per monthly wallet) ────────────────────
    const walletLabel = walletDeductions.map(d => d.label).join(' + ');
    for (const d of walletDeductions) {
      await WalletTransaction.create({
        vendor: vendorId,
        invoice: invoice._id,
        type: 'debit',
        amount: d.amount,
        balanceAfter: newBalance,
        description: `Redemption ₹${d.amount} from ${d.label}`,
        processedBy: req.user._id,
        monthlyWallet: d.monthlyWallet,
        walletLabel: d.label,
      });
    }

    // Send WhatsApp confirmation (non-blocking)
    sendRedemptionConfirmation(
      vendor.mobileNumber,
      vendor.companyName,
      redeemAmt,
      prefixedInvoiceNumber,
      vendor.walletBalance,
      referenceNo
    ).then(r => console.log('[REDEMPTION MSG RESULT]', JSON.stringify(r)))
     .catch(e => console.error('[REDEMPTION MSG ERROR]', e.message));

    res.status(201).json({
      success: true,
      data: {
        invoice,
        newWalletBalance: vendor.walletBalance,
        walletDeductions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/invoices/all  (admin — all divisions)
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { q, location, startDate, endDate, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (startDate && endDate) {
      filter.invoiceDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (q) {
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { referenceNo: { $regex: q, $options: 'i' } },
      ];
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('vendor', 'companyName accountNumber mobileNumber')
      .populate('division', 'name location');

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/invoices
// @access  Branch, Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { vendorId, page = 1, limit = 10, q, location, startDate, endDate, divisionId } = req.query;
    const filter = {};

    if (vendorId) filter.vendor = vendorId;
    if (req.user.role === 'branch') filter.division = req.user.division._id || req.user.division;

    // Admin can filter by specific division
    if (req.user.role === 'admin' && divisionId) filter.division = divisionId;

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (startDate && endDate) filter.invoiceDate = { $gte: new Date(startDate), $lte: new Date(endDate + 'T23:59:59.999Z') };
    if (q) {
      // Search by vendor company name or account number (party name/code)
      const matchingVendors = await Vendor.find({
        $or: [
          { companyName: { $regex: q, $options: 'i' } },
          { accountNumber: { $regex: q, $options: 'i' } },
        ],
      }).select('_id').lean();
      const vendorIds = matchingVendors.map(v => v._id);

      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { referenceNo: { $regex: q, $options: 'i' } },
        ...(vendorIds.length > 0 ? [{ vendor: { $in: vendorIds } }] : []),
      ];
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('vendor', 'companyName accountNumber mobileNumber')
      .populate('division', 'name location');

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/invoices/:id
// @desc    Update invoice amount, date, and remark (Admin only)
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { invoiceAmount, invoiceDate, remark, location, invoiceNumber } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // ── Invoice Number update (with division re-assignment) ────────────────
    if (invoiceNumber !== undefined) {
      const newInvoiceNumber = String(invoiceNumber).trim();

      const invoiceFormatRegex = /^\d+\/(?:RS|CSI)\/\d{8}$/i;
      if (!invoiceFormatRegex.test(newInvoiceNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invoice number must be in format 1/RS/26001200 or 5/CSI/15001623',
        });
      }

      // Check for duplicate invoice number (excluding current invoice)
      if (newInvoiceNumber !== invoice.invoiceNumber) {
        const existing = await Invoice.findOne({ invoiceNumber: newInvoiceNumber, _id: { $ne: invoice._id } });
        if (existing) {
          return res.status(409).json({ success: false, message: 'This invoice number already exists' });
        }

        // Extract prefix and re-assign division if prefix changed
        const prefixMatch = newInvoiceNumber.match(/^([^/]+)\//);
        if (prefixMatch) {
          const newPrefix = prefixMatch[1].trim();
          const oldPrefix = (invoice.invoiceNumber || '').split('/')[0].trim();

          if (newPrefix !== oldPrefix) {
            // Prefix changed — find the division matching new prefix
            const newDivision = await Division.findOne({ locationCode: newPrefix });
            if (!newDivision) {
              return res.status(400).json({
                success: false,
                message: `No branch/division found for prefix "${newPrefix}". The invoice cannot be moved.`,
              });
            }
            invoice.division = newDivision._id;
            // Auto-update location from the new division if not explicitly provided
            if (location === undefined || location === '') {
              invoice.location = newDivision.location || invoice.location;
            }
          }
        }

        invoice.invoiceNumber = newInvoiceNumber;
      }
    }

    // ── Other fields ───────────────────────────────────────────────────────
    if (invoiceAmount !== undefined) {
      const amt = parseFloat(invoiceAmount);
      if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Invoice amount must be greater than 0' });
      }
      invoice.invoiceAmount = amt;
    }

    if (invoiceDate !== undefined) {
      const d = new Date(invoiceDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid invoice date' });
      }
      invoice.invoiceDate = d;
    }

    if (remark !== undefined) {
      invoice.remark = String(remark).trim();
    }

    if (location !== undefined && location !== '') {
      invoice.location = String(location).trim();
    }

    await invoice.save();

    const updated = await Invoice.findById(invoice._id)
      .populate('vendor', 'companyName accountNumber mobileNumber')
      .populate('division', 'name location');

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // delete related wallet transactions
    await WalletTransaction.deleteMany({
      invoice: invoice._id,
    });

    await invoice.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
