const express = require('express');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const Division = require('../models/Division');
const WalletTransaction = require('../models/WalletTransaction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/invoices
// @desc    Create invoice only — no wallet credit
// @access  Branch only
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
      return res.status(400).json({ success: false, message: 'Branch user ka division set nahi hai. Re-login karo.' });
    }

    const division = req.user.division; // already populated from middleware
    const divisionId = division._id;
    if (!division) return res.status(400).json({ success: false, message: 'Division not found' });

    // Prefix invoice number with location code
    const prefixedInvoiceNumber = `${division.locationCode}-${invoiceNumber}`;

    // Check duplicate invoice number
    const existing = await Invoice.findOne({ invoiceNumber: prefixedInvoiceNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Ye invoice number already exist karta hai' });
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

// @route   POST /api/invoices/redeem
// @desc    Redeem wallet amount — debit from wallet, save transaction
// @access  Branch only
router.post('/redeem', protect, authorize('branch'), async (req, res) => {
  try {
    const { vendorId, redeemAmount, invoiceId } = req.body;

    if (!vendorId || !redeemAmount) {
      return res.status(400).json({ success: false, message: 'Vendor ID aur redeem amount required hai' });
    }

    const amount = parseFloat(redeemAmount);
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount 0 se zyada hona chahiye' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Insufficient balance check
    if (amount > vendor.walletBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! Wallet mein sirf ₹${vendor.walletBalance.toFixed(2)} available hai`,
      });
    }

    const newBalance = parseFloat((vendor.walletBalance - amount).toFixed(2));

    // Debit wallet
    await Vendor.findByIdAndUpdate(vendorId, {
      walletBalance: newBalance,
      lastRedemptionAmount: amount,
      lastRedemptionDate: new Date(),
    });

    // Save transaction
    await WalletTransaction.create({
      vendor: vendorId,
      invoice: invoiceId || null,
      type: 'debit',
      amount,
      balanceAfter: newBalance,
      description: `Wallet redemption of ₹${amount}`,
      processedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: 'Redemption successful',
      data: { newWalletBalance: newBalance, redeemedAmount: amount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/invoices/all  (admin — all divisions, with filters)
// @access  Admin only
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { q, location, startDate, endDate, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (startDate && endDate) {
      filter.invoiceDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (q) {
      // Search by invoice number or vendor fields via populate
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

// @route   GET /api/invoices
// @access  Branch, Admin
router.get('/', protect, async (req, res) => {
  try {
    const { vendorId, page = 1, limit = 10, q, location, startDate, endDate } = req.query;
    const filter = {};

    if (vendorId) filter.vendor = vendorId;
    // Branch sees only their division
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
