const express = require('express');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const OtpToken = require('../models/OtpToken');
const { protect, authorize } = require('../middleware/auth');
const { sendSmsOtp, sendRedemptionConfirmation } = require('../config/sms');

const router = express.Router();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/invoices/redeem/send-otp
// @desc    Send OTP to vendor's mobile for wallet redemption
// @access  Branch only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem/send-otp', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, redeemAmount } = req.body;

    if (!vendorId || !redeemAmount) {
      return res.status(400).json({ success: false, message: 'Vendor ID and redeem amount are required' });
    }

    const amount = parseFloat(redeemAmount);
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
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

    // Invalidate old OTPs for this branch user + redemption purpose
    await OtpToken.deleteMany({ user: req.user._id, purpose: 'redemption', used: false });

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
      if (result.dev) devOtp = otp; // dev mode — expose OTP to frontend
    } catch (smsErr) {
      console.log(`[DEV] SMS failed. OTP for ${vendor.mobileNumber}: ${otp}`);
      devOtp = otp;
    }

    const maskedMobile = vendor.mobileNumber.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2');

    res.status(200).json({
      success: true,
      message: smsSent && !devOtp
        ? `OTP sent to ${maskedMobile}`
        : `OTP generated (dev mode — shown below)`,
      maskedMobile,
      ...(devOtp ? { devOtp } : {}),
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
    const { vendorId, redeemAmount, invoiceId, otp } = req.body;

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
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
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

    // Send confirmation SMS (non-blocking — redemption already done)
    sendRedemptionConfirmation(
      vendor.mobileNumber,
      vendor.companyName,
      amount,
      newBalance
    ).catch(() => {});

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
// @desc    Create invoice only — no wallet credit
// @access  Branch only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, invoiceDate, invoiceNumber, invoiceAmount, location } = req.body;

    if (!vendorId || !invoiceDate || !invoiceNumber || !invoiceAmount || !location) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendor.status === 'blocked') return res.status(403).json({ success: false, message: 'Vendor is blocked' });

    if (!req.user.division) {
      return res.status(400).json({ success: false, message: 'Branch user division is not set. Please re-login.' });
    }

    const division = req.user.division;
    const divisionId = division._id;

    const prefixedInvoiceNumber = `${division.locationCode}/${invoiceNumber}`;

    const existing = await Invoice.findOne({ invoiceNumber: prefixedInvoiceNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This invoice number already exists' });
    }

    const invoice = await Invoice.create({
      vendor: vendorId,
      createdBy: req.user._id,
      division: divisionId,
      invoiceNumber: prefixedInvoiceNumber,
      invoiceDate: new Date(invoiceDate),
      invoiceAmount: parseFloat(invoiceAmount),
      location,
      status: 'processed',
    });

    res.status(201).json({ success: true, data: invoice });
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
    const { vendorId, page = 1, limit = 10, q, location, startDate, endDate } = req.query;
    const filter = {};

    if (vendorId) filter.vendor = vendorId;
    if (req.user.role === 'branch') filter.division = req.user.division._id || req.user.division;

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (startDate && endDate) filter.invoiceDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    if (q) filter.$or = [
      { invoiceNumber: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
    ];

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

module.exports = router;
