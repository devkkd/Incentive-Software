const express = require('express');
const User = require('../models/User');
const Division = require('../models/Division');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/branches
// @access  Admin only
router.get('/branches', protect, authorize('admin'), async (req, res) => {
  try {
    const branches = await User.find({ role: 'branch' })
      .populate('division', 'name location locationCode')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: branches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/users/branches
// @access  Admin only
router.post('/branches', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, divisionId } = req.body;

    if (!name || !email || !password || !divisionId) {
      return res.status(400).json({ success: false, message: 'Name, email, password and division are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const division = await Division.findById(divisionId);
    if (!division) {
      return res.status(404).json({ success: false, message: 'Division not found' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'branch',
      division: divisionId,
    });

    res.status(201).json({
      success: true,
      message: 'Branch user created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        division: division.name,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/branches/:id
// @access  Admin only
router.put('/branches/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, divisionId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'branch') {
      return res.status(404).json({ success: false, message: 'Branch user not found' });
    }
    if (email && email !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (name) user.name = name;
    if (divisionId) user.division = divisionId;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/users/branches/:id
// @access  Admin only
router.delete('/branches/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'branch') {
      return res.status(404).json({ success: false, message: 'Branch user not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/branches/:id/toggle
// @access  Admin only
router.put('/branches/:id/toggle', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'branch') {
      return res.status(404).json({ success: false, message: 'Branch user not found' });
    }
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: { isActive: user.isActive } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
