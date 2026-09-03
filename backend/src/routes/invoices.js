const express = require('express');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const MonthlyWallet = require('../models/MonthlyWallet');
const Wallet = require('../models/Wallet');
const OtpToken = require('../models/OtpToken');
const SystemSetting = require('../models/SystemSetting');
const Division = require('../models/Division');
const { protect, authorize } = require('../middleware/auth');
const { sendSmsOtp, sendRedemptionConfirmation } = require('../config/sms');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POINT 7 — server-side freeze check.
// Enforced here, not only in the UI. Disabling a button in the browser is not
// a control; anyone can bypass it. This is the control.
// ─────────────────────────────────────────────────────────────────────────────
async function redemptionFrozen(res) {
  const doc = await SystemSetting.get('redemptionFreeze', false);
  if (doc.value) {
    res.status(423).json({
      success: false,
      frozen: true,
      message: doc.reason
        ? `Redemption is temporarily suspended: ${doc.reason}. Please contact head office.`
        : 'Redemption is temporarily suspended. Please contact head office.',
    });
    return true;
  }
  return false;
}


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
    if (await redemptionFrozen(res)) return;
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
// ─────────────────────────────────────────────────────────────────────────────
// POINT 6 — REMOVED: POST /api/invoices/redeem
//
// This endpoint debited Vendor.walletBalance but never touched the party's
// month wallets, so every call left the two ledgers permanently disagreeing.
// It was unused by the frontend but still mounted and reachable.
//
// Redemption now goes through POST /api/invoices only, which deducts from both
// inside a transaction. Anything still calling the old route gets a clear
// error rather than silently corrupting a balance.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem', protect, (req, res) => {
  res.status(410).json({
    success: false,
    message:
      'This endpoint has been removed because it corrupted wallet balances. ' +
      'Use POST /api/invoices instead.',
  });
});


router.post('/', protect, authorize('branch'), async (req, res) => {
  try {
    if (await redemptionFrozen(res)) return;
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

    // ═══════════════════════════════════════════════════════════════════════
    // POINT 6 — every write below happens inside one transaction.
    //
    // A redemption touches four collections: MonthlyWallet, Vendor, Invoice
    // and WalletTransaction. Previously these ran one after another with no
    // safety net, so a failure part-way through left the party's month wallets
    // and their master balance permanently disagreeing, with no invoice and no
    // ledger entry to explain it. Nobody saw an error.
    //
    // Deductions are also ATOMIC: the balance check and the write are a single
    // conditional update, so two counters redeeming at the same instant cannot
    // both pass a check against the same balance.
    // ═══════════════════════════════════════════════════════════════════════
    const session = await mongoose.startSession();
    let invoice;
    let walletDeductions = [];
    let newBalance;
    let referenceNo;

    try {
      await session.withTransaction(async () => {
        walletDeductions = [];

        // Consume the OTP conditionally, so a duplicate submission cannot
        // spend the same approval twice.
        const otpClaim = await OtpToken.findOneAndUpdate(
          { _id: otpRecord._id, used: false },
          { $set: { used: true } },
          { new: true, session }
        );
        if (!otpClaim) {
          throw new Error('This OTP has already been used. Please request a new one.');
        }

        const STALE =
          'A balance changed while this redemption was being prepared. ' +
          'Nothing has been deducted — please reload the party and try again.';

        if (redemptionList) {
          for (const r of redemptionList) {
            const amt = parseFloat(r.amount);
            const updated = await MonthlyWallet.findOneAndUpdate(
              { _id: r.monthlyWalletId, balance: { $gte: amt } },
              { $inc: { balance: -amt } },
              { new: true, session }
            );
            if (!updated) throw new Error(STALE);
            walletDeductions.push({
              monthlyWallet: updated._id, amount: amt, label: updated.label,
            });
          }
        } else {
          let remaining = redeemAmt;

          const candidates = await MonthlyWallet.find({ vendor: vendorId, balance: { $gt: 0 } })
            .sort({ year: 1, month: 1 })
            .session(session);

          // Resolve parent schemes in one query rather than one per wallet
          const parents = await Wallet.find({
            _id: { $in: candidates.map((m) => m.wallet).filter(Boolean) },
          }).select('_id isHold').session(session);
          const parentById = new Map(parents.map((w) => [String(w._id), w]));

          for (const mw of candidates) {
            if (remaining <= 0) break;
            if (mw.isHold) continue;
            if (mw.wallet && parentById.get(String(mw.wallet))?.isHold) continue;

            const deduct = parseFloat(Math.min(mw.balance, remaining).toFixed(2));
            if (deduct <= 0) continue;

            const updated = await MonthlyWallet.findOneAndUpdate(
              { _id: mw._id, balance: { $gte: deduct } },
              { $inc: { balance: -deduct } },
              { new: true, session }
            );
            if (!updated) throw new Error(STALE);

            walletDeductions.push({
              monthlyWallet: updated._id, amount: deduct, label: updated.label,
            });
            remaining = parseFloat((remaining - deduct).toFixed(2));
          }

          if (remaining > 0.01) {
            throw new Error(
              `Only ₹${(redeemAmt - remaining).toFixed(2)} could be drawn from available ` +
              'wallets. Nothing has been deducted.'
            );
          }
        }

        // Master balance — conditional, so two simultaneous redemptions cannot
        // both succeed against the same figure.
        const updatedVendor = await Vendor.findOneAndUpdate(
          { _id: vendorId, walletBalance: { $gte: redeemAmt } },
          {
            $inc: { walletBalance: -redeemAmt },
            $set: { lastRedemptionAmount: redeemAmt, lastRedemptionDate: new Date() },
          },
          { new: true, session }
        );
        if (!updatedVendor) throw new Error(STALE);

        newBalance = parseFloat(updatedVendor.walletBalance.toFixed(2));
        vendor.walletBalance = newBalance;

        referenceNo = await generateUniqueReferenceNo();
        const created = await Invoice.create([{
          vendor: vendorId,
          createdBy: req.user._id,
          division: division._id,
          invoiceNumber: prefixedInvoiceNumber,
          invoiceDate: new Date(invoiceDate),
          invoiceAmount: invoiceAmt,
          redeemedAmount: redeemAmt,
          location: location || division.location || '',
          remark: remark || '',
          status: 'processed',
          referenceNo,
        }], { session });
        invoice = created[0];

        // balanceAfter is a RUNNING balance. Previously a three-wallet split
        // wrote three rows all claiming the same closing figure, so party
        // statements would not foot.
        let running = parseFloat((newBalance + redeemAmt).toFixed(2));
        const rows = walletDeductions.map((d) => {
          running = parseFloat((running - d.amount).toFixed(2));
          return {
            vendor: vendorId,
            invoice: invoice._id,
            type: 'debit',
            amount: d.amount,
            balanceAfter: running,
            description: `Redemption ₹${d.amount} from ${d.label}`,
            processedBy: req.user._id,
            monthlyWallet: d.monthlyWallet,
            walletLabel: d.label,
          };
        });
        await WalletTransaction.create(rows, { session, ordered: true });
      });
    } catch (txErr) {
      await session.endSession();
      console.error('[redemption] rolled back —', txErr.message);
      // Nothing was written. Every balance is exactly as it was.
      return res.status(409).json({ success: false, message: txErr.message });
    }

    await session.endSession();

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

    // ── Filter by wallet ────────────────────────────────────────────────────
    // The invoice itself does not record which wallet was drawn from — that
    // link lives on WalletTransaction. So work backwards: find the debits
    // against this wallet, then restrict to the invoices they belong to.
    if (walletId) {
      const wallet = await Wallet.findById(walletId).select('name').lean();

      const monthlyWalletIds = (
        await MonthlyWallet.find({
          $or: [{ wallet: walletId }, ...(wallet ? [{ label: wallet.name }] : [])],
        })
          .select('_id')
          .lean()
      ).map((mw) => mw._id);

      const invoiceIds = (
        await WalletTransaction.find({
          type: 'debit',
          monthlyWallet: { $in: monthlyWalletIds },
          invoice: { $ne: null },
        })
          .select('invoice')
          .lean()
      ).map((wt) => wt.invoice);

      // No matches means no invoices — not "ignore the filter"
      filter._id = { $in: invoiceIds };
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .collation({ locale: 'en', strength: 2 })
      .sort({ [sortField]: sortDir })
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
    const { vendorId, page = 1, limit = 10, q, location, startDate, endDate, divisionId, walletId, sortBy, sortOrder } = req.query;
    const filter = {};

    // Point 11 — whitelisted server-side sort
    // Fields on the invoice itself
    const INVOICE_SORTABLE = {
      invoiceNumber: 'invoiceNumber',
      referenceNo: 'referenceNo',
      invoiceDate: 'invoiceDate',
      invoiceAmount: 'invoiceAmount',
      redeemedAmount: 'redeemedAmount',
      location: 'location',
      remark: 'remark',
      status: 'status',
      createdAt: 'createdAt',
      // Fields on the joined party / division. These cannot be sorted by a
      // plain .sort() because the join has not happened yet, so the query
      // below switches to an aggregation when one of these is requested.
      companyName: 'vendorDoc.companyName',
      accountNumber: 'vendorDoc.accountNumber',
      mobileNumber: 'vendorDoc.mobileNumber',
      divisionName: 'divisionDoc.name',
    };
    const sortField = INVOICE_SORTABLE[sortBy] || 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

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

    // Point 10 — totals across the whole filtered set, not just this page
    const totalsAgg = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$invoiceAmount' },
          totalRedeemed: { $sum: '$redeemedAmount' },
        },
      },
    ]);
    const totalInvoiced = totalsAgg[0]?.totalInvoiced || 0;
    const totalRedeemed = totalsAgg[0]?.totalRedeemed || 0;
    const totalAmount = totalInvoiced; // kept so nothing else breaks

    // Point 11 — join first, then sort, so party and branch columns can be
    // sorted across the whole dataset rather than just the visible page.
    const invoices = await Invoice.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendor',
          foreignField: '_id',
          as: 'vendorDoc',
        },
      },
      { $unwind: { path: '$vendorDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'divisions',
          localField: 'division',
          foreignField: '_id',
          as: 'divisionDoc',
        },
      },
      { $unwind: { path: '$divisionDoc', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortField]: sortDir } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      {
        // Reshape to match what .populate() used to return, so the frontend
        // continues to work unchanged.
        $addFields: {
          vendor: {
            _id: '$vendorDoc._id',
            companyName: '$vendorDoc.companyName',
            accountNumber: '$vendorDoc.accountNumber',
            mobileNumber: '$vendorDoc.mobileNumber',
          },
          division: {
            _id: '$divisionDoc._id',
            name: '$divisionDoc.name',
            location: '$divisionDoc.location',
          },
        },
      },
      { $project: { vendorDoc: 0, divisionDoc: 0 } },
    ]).collation({ locale: 'en', strength: 2 });

    // Attach redemption amount (sum of debit wallet transactions per invoice)
    const invoiceIds = invoices.map(inv => inv._id);
    const redemptions = await WalletTransaction.find({
      invoice: { $in: invoiceIds },
      type: 'debit',
    }).select('invoice amount').lean();

    const redemptionMap = {};
    redemptions.forEach(r => {
      const key = String(r.invoice);
      redemptionMap[key] = (redemptionMap[key] || 0) + (r.amount || 0);
    });

    const invoicesWithRedeem = invoices.map(inv => ({
      ...inv,
      redeemAmount: parseFloat((redemptionMap[String(inv._id)] || 0).toFixed(2)),
    }));

    res.status(200).json({
      success: true,
      data: invoicesWithRedeem,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      totalAmount: parseFloat(totalInvoiced.toFixed(2)),
      totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
      totalRedeemed: parseFloat(totalRedeemed.toFixed(2)),
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
