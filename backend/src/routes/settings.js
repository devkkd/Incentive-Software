const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { protect } = require('../middleware/auth');
const { sendOtpEmail } = require('../config/email');

const router = express.Router();

// Generate 6-digit OTP
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// @route   POST /api/settings/forgot-password/send-otp
// @desc    Send OTP to email for password reset (no auth required)
// @access  Public
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email address' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpToken.deleteMany({ user: user._id, purpose: 'password_change', used: false });
    await OtpToken.create({ user: user._id, email: user.email, otpCode: otp, purpose: 'password_change', expiresAt });
    await sendOtpEmail(user.email, otp, 'password_change');

    res.status(200).json({ success: true, message: `OTP sent to ${user.email}`, email: user.email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/settings/forgot-password/verify-otp
// @desc    Verify OTP only (step 2) — does not reset password yet
// @access  Public
router.post('/forgot-password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otpRecord = await OtpToken.findOne({
      user: user._id, otpCode: otp, purpose: 'password_change', used: false, expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.status(200).json({ success: true, message: 'OTP verified' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @desc    Verify OTP and reset password (no auth required)
// @access  Public
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otpRecord = await OtpToken.findOne({ user: user._id, otpCode: otp, purpose: 'password_change', used: false, expiresAt: { $gt: new Date() } });
    if (!otpRecord) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    user.password = newPassword;
    await user.save();
    otpRecord.used = true;
    await otpRecord.save();

    res.status(200).json({ success: true, message: 'Password successfully reset' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @desc    Send OTP to user's email for password change
// @access  Private
router.post('/password/send-otp', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Invalidate old OTPs
    await OtpToken.deleteMany({ user: user._id, purpose: 'password_change', used: false });

    await OtpToken.create({
      user: user._id,
      email: user.email,
      otpCode: otp,
      purpose: 'password_change',
      expiresAt,
    });

    await sendOtpEmail(user.email, otp, 'password_change');

    res.status(200).json({
      success: true,
      message: `OTP sent to ${user.email}`,
      email: user.email,
    });
  } catch (error) {
    // If email sending fails, still return helpful message
    if (error.message?.includes('DNS') || error.message?.includes('ENOTFOUND') || error.code === 'ECONNREFUSED') {
      return res.status(500).json({
        success: false,
        message: 'Email send failed. Please check: 1) EMAIL_USER and EMAIL_PASS are correct in .env? 2) User email is valid?',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/settings/password/change
// @desc    Verify OTP and change password
// @access  Private
router.post('/password/change', protect, async (req, res) => {
  try {
    const { otp, oldPassword, newPassword } = req.body;

    if (!otp || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'OTP, old password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user._id).select('+password');

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    // Verify OTP
    const otpRecord = await OtpToken.findOne({
      user: user._id,
      otpCode: otp,
      purpose: 'password_change',
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Update password
    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    // Mark OTP as used
    otpRecord.used = true;
    await otpRecord.save();

    res.status(200).json({ success: true, message: 'Password successfully changed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/settings/me
// @desc    Get current user info
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('division', 'name location locationCode');
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
