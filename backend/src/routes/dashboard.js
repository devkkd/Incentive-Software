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

    // ── POINT 8 — REDEEMED totals ──────────────────────────────────────────
    // Week  = calendar week, Monday to Sunday
    // Month = calendar month
    // Year  = financial year, 1 April to 31 March
    // Comparisons are like-for-like: the same elapsed span in the prior period,
    // never a part-period against a full one.

    const now = new Date();

    // Monday of the current calendar week (00:00)
    const mondayOf = (d) => {
      const x = new Date(d);
      const day = x.getDay();               // 0 = Sunday
      const diff = day === 0 ? 6 : day - 1; // days back to Monday
      x.setDate(x.getDate() - diff);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    // Start of the financial year containing d (1 April)
    const fyStartOf = (d) => {
      const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return new Date(y, 3, 1, 0, 0, 0, 0);
    };

    const sumDebits = async (from, to) => {
      const match = { type: 'debit', createdAt: { $gte: from } };
      if (to) match.createdAt.$lt = to;
      const r = await WalletTransaction.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      return r[0]?.total || 0;
    };

    const pctChange = (current, previous) =>
      previous > 0 ? parseFloat((((current - previous) / previous) * 100).toFixed(1)) : 0;

    // ── This week (Mon-Sun) vs the same weekday span last week ──────────────
    const weekStart = mondayOf(now);
    const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekCutoff = new Date(prevWeekStart);
    prevWeekCutoff.setTime(prevWeekCutoff.getTime() + (now.getTime() - weekStart.getTime()));

    const weeklyRedeemed = await sumDebits(weekStart, null);
    const prevWeeklyRedeemed = await sumDebits(prevWeekStart, prevWeekCutoff);
    const weeklyChange = pctChange(weeklyRedeemed, prevWeeklyRedeemed);

    // ── This month vs the same day-count last month ─────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthCutoff = new Date(prevMonthStart);
    prevMonthCutoff.setTime(prevMonthCutoff.getTime() + (now.getTime() - monthStart.getTime()));

    const monthlyRedeemed = await sumDebits(monthStart, null);
    const prevMonthlyRedeemed = await sumDebits(prevMonthStart, prevMonthCutoff);
    const monthlyChange = pctChange(monthlyRedeemed, prevMonthlyRedeemed);

    // ── This financial year vs the same point last financial year ───────────
    const fyStart = fyStartOf(now);
    const prevFyStart = new Date(fyStart.getFullYear() - 1, 3, 1, 0, 0, 0, 0);
    const prevFyCutoff = new Date(prevFyStart);
    prevFyCutoff.setTime(prevFyCutoff.getTime() + (now.getTime() - fyStart.getTime()));

    const yearlyRedeemed = await sumDebits(fyStart, null);
    const prevYearlyRedeemed = await sumDebits(prevFyStart, prevFyCutoff);
    const yearlyChange = pctChange(yearlyRedeemed, prevYearlyRedeemed);

    // Label for the year card, e.g. "FY 2026-27"
    const fyLabel = `FY ${fyStart.getFullYear()}-${String((fyStart.getFullYear() + 1) % 100).padStart(2, '0')}`;

    // --- KPI Row 2: Counts ---
    const totalInvoices = await Invoice.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalDivisions = await Division.countDocuments({ isActive: true });
    const totalUploads = await IncentiveUpload.countDocuments({ status: 'processed' });

    // ── POINT 9 — Weekly incentive REDEEMED, by branch ─────────────────────
    // Branch comes from the linked invoice's division, which is a real
    // reference. WalletTransaction.location is free text and often empty.
    const WEEKS_BACK = parseInt(req.query.weeks || 12, 10);

    const chartFrom = mondayOf(now);
    chartFrom.setDate(chartFrom.getDate() - (WEEKS_BACK - 1) * 7);

    const redemptionInvoices = await Invoice.find({
      createdAt: { $gte: chartFrom },
      redeemedAmount: { $gt: 0 },
    })
      .select('redeemedAmount createdAt division')
      .populate('division', 'name')
      .lean();

    // Build the week buckets first so empty weeks still appear on the chart
    const weekBuckets = [];
    for (let i = 0; i < WEEKS_BACK; i++) {
      const ws = new Date(chartFrom);
      ws.setDate(ws.getDate() + i * 7);
      weekBuckets.push({
        start: ws,
        // e.g. "4 Aug"
        name: `${ws.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ws.getMonth()]}`,
        total: 0,
      });
    }

    const branchNames = new Set();

    for (const inv of redemptionInvoices) {
      const idx = Math.floor((new Date(inv.createdAt) - chartFrom) / (7 * 24 * 60 * 60 * 1000));
      if (idx < 0 || idx >= weekBuckets.length) continue;

      const branch = inv.division?.name || 'Unassigned';
      branchNames.add(branch);

      const b = weekBuckets[idx];
      b.total += inv.redeemedAmount || 0;
      b[branch] = (b[branch] || 0) + (inv.redeemedAmount || 0);
    }

    const branches = [...branchNames].sort();

    // Fill missing branch keys with 0 so lines are continuous, not broken
    const weeklyRedemptionData = weekBuckets.map((b) => {
      const row = { name: b.name, total: parseFloat(b.total.toFixed(2)) };
      for (const br of branches) row[br] = parseFloat((b[br] || 0).toFixed(2));
      return row;
    });

    const branchTotals = branches
      .map((br) => ({
        name: br,
        total: parseFloat(
          weeklyRedemptionData.reduce((s, w) => s + (w[br] || 0), 0).toFixed(2)
        ),
      }))
      .sort((a, b) => b.total - a.total);

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
    // Only include divisions that have actual incentives distributed
    const pieData = divisionStats
      .filter(d => d.total > 0)
      .map(d => ({
        name: d.name,
        value: totalDivisionAmount > 0 ? Math.round((d.total / totalDivisionAmount) * 100) : 0,
        amount: d.total,
        color: d.color,
      }))
      .sort((a, b) => b.amount - a.amount); // highest first

    res.status(200).json({
      success: true,
      data: {
        kpi1: {
          totalIncentives,
          weeklyRedeemed, weeklyChange,
          monthlyRedeemed, monthlyChange,
          yearlyRedeemed, yearlyChange,
          fyLabel,
          weekStart, monthStart, fyStart,
        },
        kpi2: { totalInvoices, totalVendors, totalDivisions, totalUploads },
        weeklyRedemptionData,
        branches,
        branchTotals,
        pieData,
        totalDivisionAmount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
