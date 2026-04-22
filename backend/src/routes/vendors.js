const express = require('express');
const Vendor = require('../models/Vendor');
const Division = require('../models/Division');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/vendors
// @access  Branch, Admin
router.post('/', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { companyName, personName, accountNumber, mobileNumber, email, address } = req.body;

    if (!companyName || !personName || !accountNumber || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'Company name, person name, account number aur mobile required hai' });
    }

    // Get division for location code prefix
    const divisionId = req.user.role === 'branch'
      ? (req.user.division._id || req.user.division)
      : req.body.divisionId;
    const division = await Division.findById(divisionId);

    if (!division) {
      return res.status(400).json({ success: false, message: 'Division not found' });
    }

    // Prefix account number with location code: JDH-12345
    const prefixedAccountNumber = `${division.locationCode}-${accountNumber}`;

    // Check duplicate
    const existing = await Vendor.findOne({
      $or: [{ accountNumber: prefixedAccountNumber }, { mobileNumber }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.accountNumber === prefixedAccountNumber
          ? 'Ye account number already exist karta hai'
          : 'Ye mobile number already registered hai',
      });
    }

    const vendor = await Vendor.create({
      companyName,
      personName,
      accountNumber: prefixedAccountNumber,
      mobileNumber,
      email: email || null,
      address: address || '',
      division: divisionId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors
// @access  Branch, Admin
router.get('/', protect, async (req, res) => {
  try {
    const { status, q, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Branch sees only their division's vendors
    if (req.user.role === 'branch' && req.user.division) {
      const divId = req.user.division._id || req.user.division;
      if (divId) filter.division = divId;
    }

    if (status) filter.status = status;

    if (q) {
      filter.$or = [
        { companyName: { $regex: q, $options: 'i' } },
        { mobileNumber: { $regex: q, $options: 'i' } },
        { accountNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const total = await Vendor.countDocuments(filter);
    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('division', 'name location');

    res.status(200).json({
      success: true,
      data: vendors,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/vendors/:id
// @access  Admin only
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { companyName, personName, mobileNumber, email, address, status } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { companyName, personName, mobileNumber, email, address, status },
      { new: true, runValidators: true }
    );

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/vendors/:id/block
// @access  Branch, Admin
router.put('/:id/block', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { blockReason } = req.body;
    if (!blockReason?.trim()) {
      return res.status(400).json({ success: false, message: 'Block reason required hai' });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { status: 'blocked', blockReason },
      { new: true }
    );

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors/search?q=mobileOrAccount
// @access  Branch, Admin
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const vendor = await Vendor.findOne({
      $or: [{ mobileNumber: q }, { accountNumber: q }],
      status: { $ne: 'blocked' },
    }).populate('division', 'name location locationCode');

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors/:id/transactions
// @access  Branch, Admin
router.get('/:id/transactions', protect, async (req, res) => {
  try {
    const WalletTransaction = require('../models/WalletTransaction');
    const transactions = await WalletTransaction.find({ vendor: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('invoice', 'invoiceNumber invoiceDate invoiceAmount location');

    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
