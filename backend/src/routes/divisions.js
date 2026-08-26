const express = require('express');
const Division = require('../models/Division');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/divisions
router.get('/', protect, async (req, res) => {
  try {
    const divisions = await Division.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ success: true, data: divisions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/divisions — creates division only (no user)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, location, locationCode } = req.body;

    if (!name || !location || !locationCode) {
      return res.status(400).json({ success: false, message: 'Name, location and location code are required' });
    }

    const existingDiv = await Division.findOne({ 
      $or: [
        { locationCode: locationCode },
        { name: name.toUpperCase() }
      ]
    });
    if (existingDiv) {
      return res.status(409).json({ success: false, message: existingDiv.locationCode === locationCode ? 'This serial number already exists' : 'This branch code already exists' });
    }

    const division = await Division.create({ name: name.toUpperCase(), location, locationCode });

    res.status(201).json({ success: true, data: division });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/divisions/:id
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, location, isActive } = req.body;
    const division = await Division.findByIdAndUpdate(
      req.params.id, { name, location, isActive }, { new: true, runValidators: true }
    );
    if (!division) return res.status(404).json({ success: false, message: 'Division not found' });
    res.status(200).json({ success: true, data: division });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/divisions/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const division = await Division.findByIdAndDelete(req.params.id);
    if (!division) return res.status(404).json({ success: false, message: 'Division not found' });
    res.status(200).json({ success: true, message: 'Division deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
