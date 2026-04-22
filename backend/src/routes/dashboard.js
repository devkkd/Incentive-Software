const express = require('express');
const Vendor = require('../models/Vendor');
const Invoice = require('../models/Invoice');
const WalletTransaction = require('../models/WalletTransaction');
const IncentiveUpload = require('../models/IncentiveUpload');
const Division = require('../models/Division');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const COLORS = ['#2B3B8A', '#D97706', '#059669', '#0088FE', '#9CA3AF', '#E74C3C', '#8B5CF6'];

// @route   GET /api/dashboard/stats
// @access  Admin only
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    // --- KPI Row 1: Incentive totals ---
    const allCredits = await WalletTransaction.aggregate([
      { $match: { type: 'credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalIncentives = allCredits[0]?.total || 0;

    // Weekly (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const prevWeekAgo = new Date(); prevWeekAgo.setDate(prevWeekAgo.getDate() - 14);

    const thisWeek = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const lastWeek = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: prevWeekAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const weeklyTotal = thisWeek[0]?.total || 0;
    const prevWeeklyTotal = lastWeek[0]?.total || 0;
    const weeklyChange = prevWeeklyTotal > 0 ? ((weeklyTotal - prevWeeklyTotal) / prevWeeklyTotal * 100).toFixed(1) : 0;

    // Monthly (this month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

    const thisMonth = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const lastMonth = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlyTotal = thisMonth[0]?.total || 0;
    const prevMonthlyTotal = lastMonth[0]?.total || 0;
    const monthlyChange = prevMonthlyTotal > 0 ? ((monthlyTotal - prevMonthlyTotal) / prevMonthlyTotal * 100).toFixed(1) : 0;

    // Yearly
    const yearStart = new Date(parseInt(year), 0, 1);
    const prevYearStart = new Date(parseInt(year) - 1, 0, 1);
    const prevYearEnd = new Date(parseInt(year) - 1, 11, 31);

    const thisYear = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const lastYear = await WalletTransaction.aggregate([
      { $match: { type: 'credit', createdAt: { $gte: prevYearStart, $lte: prevYearEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const yearlyTotal = thisYear[0]?.total || 0;
    const prevYearlyTotal = lastYear[0]?.total || 0;
    const yearlyChange = prevYearlyTotal > 0 ? ((yearlyTotal - prevYearlyTotal) / prevYearlyTotal * 100).toFixed(1) : 0;

    // --- KPI Row 2: Counts ---
    const totalInvoices = await Invoice.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalDivisions = await Division.countDocuments({ isActive: true });
    const totalUploads = await IncentiveUpload.countDocuments({ status: 'processed' });

    // --- Area Chart: Monthly incentives for selected year ---
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthlyData = await WalletTransaction.aggregate([
      {
        $match: {
          type: 'credit',
          createdAt: { $gte: new Date(parseInt(year), 0, 1), $lt: new Date(parseInt(year) + 1, 0, 1) }
        }
      },
      { $group: { _id: { $month: '$createdAt' }, value: { $sum: '$amount' } } },
      { $sort: { '_id': 1 } }
    ]);

    const areaData = months.map((name, i) => {
      const found = monthlyData.find(m => m._id === i + 1);
      return { name, value: found?.value || 0 };
    });

    // Peak month
    const peakMonth = areaData.reduce((max, m) => m.value > max.value ? m : max, areaData[0]);

    // --- Pie Chart: Division-wise incentives ---
    const divisions = await Division.find({ isActive: true });
    const divisionStats = await Promise.all(divisions.map(async (div, idx) => {
      const vendors = await Vendor.find({ division: div._id }).select('_id');
      const vendorIds = vendors.map(v => v._id);
      const result = await WalletTransaction.aggregate([
        { $match: { type: 'credit', vendor: { $in: vendorIds } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return { name: div.name, total: result[0]?.total || 0, color: COLORS[idx % COLORS.length] };
    }));

    const totalDivisionAmount = divisionStats.reduce((s, d) => s + d.total, 0);
    const pieData = divisionStats.map(d => ({
      name: d.name,
      value: totalDivisionAmount > 0 ? Math.round((d.total / totalDivisionAmount) * 100) : 0,
      amount: d.total,
      color: d.color,
    }));

    res.status(200).json({
      success: true,
      data: {
        kpi1: {
          totalIncentives,
          weeklyTotal, weeklyChange: parseFloat(weeklyChange),
          monthlyTotal, monthlyChange: parseFloat(monthlyChange),
          yearlyTotal, yearlyChange: parseFloat(yearlyChange),
        },
        kpi2: { totalInvoices, totalVendors, totalDivisions, totalUploads },
        areaData,
        peakMonth,
        pieData,
        totalDivisionAmount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
