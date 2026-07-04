const express = require('express');
const Vendor = require('../models/Vendor');
const Invoice = require('../models/Invoice');
const WalletTransaction = require('../models/WalletTransaction');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Build date filter from startDate/endDate or timeline preset
const buildDateFilter = (timeline, startDate, endDate) => {
  // If explicit dates provided, use them directly
  if (startDate && endDate) {
    return { $gte: new Date(startDate), $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
  }

  // Fallback to timeline preset
  const now = new Date();
  let start, end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (timeline) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
    case 'last_3_months': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'last_6_months': start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case 'last_1_year': start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
    default: return null;
  }
  return { $gte: start, $lte: end };
};

// @route   GET /api/reports?type=vendors|invoices|incentives&timeline=&startDate=&endDate=&status=&q=
// @access  Branch, Admin
router.get('/', protect, async (req, res) => {
  try {
    const { type = 'vendors', timeline, startDate, endDate, status, q, divisionId } = req.query;
    const divisionFilter = req.user.role === 'branch'
      ? { division: req.user.division._id || req.user.division }
      : divisionId ? { division: divisionId } : {};

    const dateFilter = buildDateFilter(timeline, startDate, endDate);

    let data = [];

    // ---- VENDORS REPORT ----
    if (type === 'vendors') {
      const filter = { ...divisionFilter };
      if (status) filter.status = status;
      if (dateFilter) filter.createdAt = dateFilter;
      if (q) {
        filter.$or = [
          { companyName: { $regex: q, $options: 'i' } },
          { mobileNumber: { $regex: q, $options: 'i' } },
          { accountNumber: { $regex: q, $options: 'i' } },
        ];
      }
      data = await Vendor.find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate('division', 'name location');
    }

    // ---- INVOICES REPORT ----
    if (type === 'invoices') {
      const filter = { ...divisionFilter };
      if (dateFilter) filter.createdAt = dateFilter;
      if (q) {
        filter.$or = [
          { invoiceNumber: { $regex: q, $options: 'i' } },
          { location: { $regex: q, $options: 'i' } },
        ];
      }
      const invoices = await Invoice.find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate('vendor', 'companyName accountNumber mobileNumber')
        .populate('division', 'name location')
        .lean();

      // Attach redemption amount from linked wallet debit transactions (sum for split redemptions)
      const invoiceIds = invoices.map(inv => inv._id);
      const redemptions = await WalletTransaction.find({
        invoice: { $in: invoiceIds },
        type: 'debit',
      }).select('invoice amount').lean();

      // Sum all debit transactions per invoice (handles split multi-wallet redemptions)
      const redemptionMap = {};
      redemptions.forEach(r => {
        const key = String(r.invoice);
        redemptionMap[key] = (redemptionMap[key] || 0) + (r.amount || 0);
      });

      data = invoices.map(inv => ({
        ...inv,
        redeemAmount: parseFloat((redemptionMap[String(inv._id)] || 0).toFixed(2)),
      }));
    }

    // ---- INCENTIVES WALLET REPORT (wallet transactions) ----
    if (type === 'incentives') {
      const vendorFilter = { ...divisionFilter };
      // Get vendor IDs in this division first
      const vendorIds = (await Vendor.find(vendorFilter).select('_id')).map(v => v._id);

      const filter = { vendor: { $in: vendorIds } };
      if (dateFilter) filter.createdAt = dateFilter;

      data = await WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate('vendor', 'companyName accountNumber mobileNumber')
        .populate('invoice', 'invoiceNumber referenceNo');
    }

    res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
