const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const IncentiveUpload = require('../models/IncentiveUpload');
const OtpToken = require('../models/OtpToken');
const { protect, authorize } = require('../middleware/auth');
const { sendOtpEmail } = require('../config/email');
const { sendIncentiveCreditNotification } = require('../config/sms');

const router = express.Router();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// Multer — memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(csv|xlsx|xls)$/i)) cb(null, true);
    else cb(new Error('Only CSV or Excel files are allowed'));
  },
});

// @route   POST /api/incentives/send-otp
// @desc    Send OTP to EMAIL_USER before upload
// @access  Branch, Admin
router.post('/send-otp', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Invalidate old OTPs
    await OtpToken.deleteMany({ user: req.user._id, purpose: 'upload', used: false });

    // Save OTP first — always
    await OtpToken.create({
      user: req.user._id,
      email: process.env.EMAIL_USER,
      otpCode: otp,
      purpose: 'upload',
      expiresAt,
    });

    // Try to send email — if fails, log OTP in dev mode
    let emailSent = false;
    try {
      await sendOtpEmail(process.env.EMAIL_USER, otp, 'upload');
      emailSent = true;
    } catch (emailErr) {
      console.log(`[DEV] Email send failed. OTP for upload: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? `OTP sent to ${process.env.EMAIL_USER}`
        : `Email send failed. Check backend console for OTP (dev mode).`,
      email: process.env.EMAIL_USER,
      // Only expose OTP in development if email failed
      ...(process.env.NODE_ENV === 'development' && !emailSent ? { devOtp: otp } : {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/incentives/upload
// @desc    Verify OTP then parse CSV/Excel and credit vendor wallets
// @access  Branch, Admin
router.post('/upload', protect, authorize('branch', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const { otp, frequency } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    // Verify OTP
    const otpRecord = await OtpToken.findOne({
      user: req.user._id,
      otpCode: otp,
      purpose: 'upload',
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark OTP used
    otpRecord.used = true;
    await otpRecord.save();

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in the file' });
    }

    const normalize = (obj) => {
      const result = {};
      for (const key of Object.keys(obj)) result[key.toLowerCase().trim()] = obj[key];
      return result;
    };

    const results = { success: [], failed: [] };
    let totalAmount = 0;

    for (const rawRow of rows) {
      const row = normalize(rawRow);
      const partCode = String(
        row['party_code'] || row['partcode'] || row['account_no'] || row['accountno'] || row['part code'] || ''
      ).trim();
      const amount = parseFloat(row['amount'] || row['incentive_amount'] || 0);
      const remark = String(row['remark'] || row['remarks'] || '').trim();

      if (!partCode || isNaN(amount) || amount <= 0) {
        results.failed.push({ partCode: partCode || 'N/A', reason: 'Invalid part code or amount' });
        continue;
      }

      const vendor = await Vendor.findOne({
        $or: [
          { accountNumber: partCode },
          { accountNumber: { $regex: `-${partCode}$`, $options: 'i' } },
        ]
      });
      if (!vendor) { results.failed.push({ partCode, reason: 'Vendor not found' }); continue; }
      if (vendor.status === 'blocked') { results.failed.push({ partCode, reason: 'Vendor is blocked' }); continue; }

      const newBalance = parseFloat((vendor.walletBalance + amount).toFixed(2));
      await Vendor.findByIdAndUpdate(vendor._id, { walletBalance: newBalance });
      await WalletTransaction.create({
        vendor: vendor._id,
        type: 'credit',
        amount,
        balanceAfter: newBalance,
        description: remark || 'Incentive credited via upload',
        processedBy: req.user._id,
      });

      // Send WhatsApp notification to vendor (non-blocking)
      if (vendor.mobileNumber) {
        sendIncentiveCreditNotification(
          vendor.mobileNumber,
          vendor.companyName,
          amount,
          remark || 'Incentive upload'
        ).catch((err) => console.error(`[CREDIT NOTIFY FAILED] ${vendor.mobileNumber}: ${err.message}`));
      }

      totalAmount += amount;
      results.success.push({ partCode, vendorId: vendor._id, vendorName: vendor.companyName, amount, newBalance });
    }

    // Save history — admin has no division, use null
    const divisionId = req.user.division?._id || req.user.division || null;
    await IncentiveUpload.create({
      division: divisionId,
      uploadedBy: req.user._id,
      fileName: req.file.originalname,
      totalAmount,
      frequency: frequency || 'monthly',
      status: 'processed',
      items: results.success.map((r) => ({ vendor: r.vendorId, amount: r.amount })),
    });

    res.status(200).json({
      success: true,
      message: `${results.success.length} vendors credited, ${results.failed.length} failed`,
      data: {
        totalAmount,
        successCount: results.success.length,
        failedCount: results.failed.length,
        successList: results.success,
        failedList: results.failed,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/incentives/history
// @access  Branch, Admin
router.get('/history', protect, async (req, res) => {
  try {
    const divisionId = req.user.division?._id || req.user.division;
    const filter = req.user.role === 'branch'
      ? { $or: [{ division: divisionId }, { division: null }] }
      : {};

    const history = await IncentiveUpload.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('uploadedBy', 'name')
      .populate('division', 'name');

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
