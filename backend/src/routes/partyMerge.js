const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { buildCodeReport, applyCodeCleanup, mergeParties } = require('../services/partyMerge');

const router = express.Router();

// @route   GET /api/party-merge/report
// @desc    Preview: codes that will be cleaned + groups of duplicate parties
// @access  Admin
router.get('/report', protect, authorize('admin'), async (req, res) => {
  try {
    const data = await buildCodeReport();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/party-merge/cleanup-codes
// @desc    Strip branch prefixes from every party code that is unique
// @access  Admin
router.post('/cleanup-codes', protect, authorize('admin'), async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, message: 'Confirmation required' });
    }
    const data = await applyCodeCleanup(req.user);
    res.status(200).json({
      success: true,
      message: `${data.renamed} party code${data.renamed === 1 ? '' : 's'} cleaned`,
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/party-merge/merge
// @body    { keepId, mergeIds: [], reason }
// @desc    Combine duplicate parties into the one being kept
// @access  Admin
router.post('/merge', protect, authorize('admin'), async (req, res) => {
  try {
    const { keepId, mergeIds, reason } = req.body || {};
    const data = await mergeParties({
      keepId, mergeIds, actor: req.user, reason: reason ? String(reason).trim() : null,
    });
    res.status(200).json({ success: true, message: 'Parties merged', data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
