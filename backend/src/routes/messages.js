const express = require('express');
const MessageLog = require('../models/MessageLog');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');
const { sendTestOtp } = require('../config/sms');
const { normalizeMobile } = require('../services/mobile');

const router = express.Router();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route   GET /api/messages/logs?status=&purpose=&q=&from=&to=&page=&limit=
// @desc    WhatsApp / SMS attempts, newest first
// @access  Admin
router.get('/logs', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, purpose, q, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 25));

    const filter = {};
    if (status) filter.status = status;
    if (purpose) filter.purpose = purpose;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`);
    }
    if (q && q.trim()) {
      const r = { $regex: esc(q.trim()), $options: 'i' };
      filter.$or = [{ mobile: r }, { mobileRaw: r }, { partyCode: r }, { partyName: r }, { reference: r }];
    }

    const [total, rows] = await Promise.all([
      MessageLog.countDocuments(filter),
      MessageLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);

    res.json({ success: true, data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/messages/stats?days=7
// @desc    Sent / failed counts and the most common failure reasons
// @access  Admin
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byStatus, topErrors] = await Promise.all([
      MessageLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { purpose: '$purpose', status: '$status' }, count: { $sum: 1 } } },
      ]),
      MessageLog.aggregate([
        { $match: { createdAt: { $gte: since }, status: 'failed' } },
        { $group: { _id: '$error', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const totals = { sent: 0, failed: 0, dev: 0 };
    const byPurpose = {};
    byStatus.forEach(({ _id, count }) => {
      totals[_id.status] = (totals[_id.status] || 0) + count;
      byPurpose[_id.purpose] = byPurpose[_id.purpose] || { sent: 0, failed: 0, dev: 0 };
      byPurpose[_id.purpose][_id.status] += count;
    });

    res.json({
      success: true,
      data: {
        days, totals, byPurpose,
        topErrors: topErrors.map((e) => ({ reason: e._id || 'Unknown', count: e.count, last: e.last })),
        provider: process.env.SMS_PROVIDER || 'dev',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/messages/test   { mobile }
// @desc    Send a test OTP through the live provider and return the raw reply
// @access  Admin
router.post('/test', protect, authorize('admin'), async (req, res) => {
  try {
    const mobile = String(req.body?.mobile || '').trim();
    if (!mobile) return res.status(400).json({ success: false, message: 'Enter a mobile number' });
    const r = await sendTestOtp(mobile, { user: req.user });
    res.json({
      success: true,
      data: {
        sent: r.success,
        dev: !!r.dev,
        provider: r.provider,
        mobile: r.mobile,
        otp: r.otp,                 // shown to the admin so they can match what arrives
        messageId: r.messageId || null,
        providerResponse: r.raw || null,
        error: r.error || null,
        durationMs: r.durationMs,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/messages/invalid-mobiles
// @desc    Parties whose mobile number cannot be messaged as stored
// @access  Admin
router.get('/invalid-mobiles', protect, authorize('admin'), async (req, res) => {
  try {
    const vendors = await Vendor.find()
      .select('accountNumber companyName mobileNumber status division')
      .populate('division', 'name')
      .lean();
    const data = [];
    for (const v of vendors) {
      const m = normalizeMobile(v.mobileNumber);
      if (!m.ok || m.mobile !== String(v.mobileNumber || '').trim()) {
        data.push({
          vendorId: v._id,
          accountNumber: v.accountNumber,
          companyName: v.companyName,
          branch: v.division?.name || '',
          status: v.status,
          mobileNumber: v.mobileNumber || '',
          // Fixable = it works once cleaned (e.g. "+91 98290 12345")
          fixable: m.ok,
          cleaned: m.ok ? m.mobile : null,
          reason: m.ok ? 'Stored with spaces, +91 or a leading 0 — sends fine after cleaning' : m.reason,
        });
      }
    }
    data.sort((a, b) => Number(a.fixable) - Number(b.fixable) || a.companyName.localeCompare(b.companyName));
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
