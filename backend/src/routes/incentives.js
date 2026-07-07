const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const MonthlyWallet = require('../models/MonthlyWallet');
const IncentiveUpload = require('../models/IncentiveUpload');
const OtpToken = require('../models/OtpToken');
const { protect, authorize } = require('../middleware/auth');
const { sendOtpEmail } = require('../config/email');
const { sendIncentiveCreditNotification } = require('../config/sms');

const router = express.Router();

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
// @access  Branch, Admin
router.post('/send-otp', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpToken.deleteMany({ user: req.user._id, purpose: 'upload', used: false });

    await OtpToken.create({
      user: req.user._id,
      email: process.env.EMAIL_USER,
      otpCode: otp,
      purpose: 'upload',
      expiresAt,
    });

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
      ...(process.env.NODE_ENV === 'development' && !emailSent ? { devOtp: otp } : {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/incentives/upload
// @desc    Verify OTP then parse CSV/Excel and credit monthly vendor wallets
// @access  Branch, Admin
// Body fields: otp, frequency, month (1-12), year (e.g. 2025)
router.post('/upload', protect, authorize('branch', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const { otp, frequency, month, year } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    if (!otp)      return res.status(400).json({ success: false, message: 'OTP is required' });

    // month/year required
    const uploadMonth = parseInt(month);
    const uploadYear  = parseInt(year);
    if (!uploadMonth || uploadMonth < 1 || uploadMonth > 12) {
      return res.status(400).json({ success: false, message: 'Valid month (1-12) is required' });
    }
    if (!uploadYear || uploadYear < 2020 || uploadYear > 2100) {
      return res.status(400).json({ success: false, message: 'Valid year is required' });
    }

    const walletLabel = `${MONTH_NAMES[uploadMonth - 1]} ${uploadYear}`;

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
      if (!vendor)                  { results.failed.push({ partCode, reason: 'Vendor not found' }); continue; }
      if (vendor.status === 'blocked') { results.failed.push({ partCode, reason: 'Vendor is blocked' }); continue; }

      // ── Credit monthly sub-wallet ──────────────────────────────────────
      const monthlyWallet = await MonthlyWallet.getOrCreate(vendor._id, uploadMonth, uploadYear);
      const newMonthBalance = parseFloat((monthlyWallet.balance + amount).toFixed(2));
      await MonthlyWallet.findByIdAndUpdate(monthlyWallet._id, {
        balance: newMonthBalance,
        $inc: { creditedAmount: amount },
      });

      // ── Credit main vendor wallet ──────────────────────────────────────
      const newBalance = parseFloat((vendor.walletBalance + amount).toFixed(2));
      await Vendor.findByIdAndUpdate(vendor._id, { walletBalance: newBalance });

      // ── WalletTransaction record ───────────────────────────────────────
      await WalletTransaction.create({
        vendor: vendor._id,
        type: 'credit',
        amount,
        balanceAfter: newBalance,
        description: remark || `Incentive credited — ${walletLabel}`,
        processedBy: req.user._id,
        monthlyWallet: monthlyWallet._id,
        walletLabel,
      });

      // Send WhatsApp (non-blocking)
      if (vendor.mobileNumber) {
        sendIncentiveCreditNotification(
          vendor.mobileNumber,
          vendor.companyName,
          amount,
          remark || `Incentive — ${walletLabel}`
        ).catch((err) => console.error(`[CREDIT NOTIFY FAILED] ${vendor.mobileNumber}: ${err.message}`));
      }

      totalAmount += amount;
      results.success.push({ partCode, vendorId: vendor._id, vendorName: vendor.companyName, amount, newBalance, walletLabel });
    }

    // Save upload history
    const divisionId = req.user.division?._id || req.user.division || null;
    await IncentiveUpload.create({
      division: divisionId,
      uploadedBy: req.user._id,
      fileName: req.file.originalname,
      totalAmount,
      frequency: frequency || 'monthly',
      month: uploadMonth,
      year: uploadYear,
      walletLabel,
      status: 'processed',
      items: results.success.map((r) => ({ vendor: r.vendorId, amount: r.amount })),
    });

    res.status(200).json({
      success: true,
      message: `${results.success.length} vendors credited, ${results.failed.length} failed`,
      data: {
        totalAmount,
        walletLabel,
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

// @route   GET /api/incentives/monthly-wallets/:vendorId
// @desc    Get all monthly sub-wallets for a vendor.
//          If a MonthlyWallet document exists → return it as-is.
//          If IncentiveUpload has items for this vendor but MonthlyWallet is
//          missing → auto-create the MonthlyWallet document now (on first fetch)
//          so it shows up immediately without any manual admin action.
// @access  Branch, Admin
router.get('/monthly-wallets/:vendorId', protect, async (req, res) => {
  try {
    const vendorId = req.params.vendorId;

    // 0. Check vendor's main wallet balance first.
    //    If it's 0 (fully redeemed), there's nothing to redeem — return empty immediately.
    const vendorCheck = await Vendor.findById(vendorId).select('walletBalance').lean();
    if (!vendorCheck || parseFloat(vendorCheck.walletBalance || 0) <= 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 1. Fetch all existing MonthlyWallet docs for this vendor
    const existingWallets = await MonthlyWallet.find({ vendor: vendorId })
      .sort({ year: -1, month: -1 })
      .lean();

    // Build a set of month+year combos already covered
    const covered = new Set(existingWallets.map(w => `${w.year}-${w.month}`));

    // 2. Find all IncentiveUpload records that contain this vendor in items
    const uploads = await IncentiveUpload.find({ 'items.vendor': vendorId }).lean();

    const newlyCreated = [];

    for (const upload of uploads) {
      // Derive month/year from upload fields, fallback to createdAt
      const month = upload.month || (new Date(upload.createdAt).getMonth() + 1);
      const year  = upload.year  || new Date(upload.createdAt).getFullYear();
      const key   = `${year}-${month}`;

      if (covered.has(key)) continue; // wallet already exists for this month

      // Find this vendor's amount in the upload items
      const item = upload.items.find(i => String(i.vendor) === String(vendorId));
      if (!item || !item.amount) continue;

      const label = upload.walletLabel || `${MONTH_NAMES[month - 1]} ${year}`;

      // Fetch current vendor balance to set correct sub-wallet balance
      // For old uploads: the vendor's walletBalance IS the remaining balance
      // creditedAmount = what was originally uploaded, balance = what's left now
      const vendor = await Vendor.findById(vendorId).select('walletBalance').lean();
      const currentVendorBalance = vendor ? parseFloat((vendor.walletBalance || 0).toFixed(2)) : 0;

      // Auto-create MonthlyWallet — no vendor balance change, no transaction
      // Only create if the credited amount would result in a positive balance
      if (currentVendorBalance <= 0) {
        covered.add(key); // mark as handled — don't show a zero-balance wallet
        continue;
      }

      const created = await MonthlyWallet.create({
        vendor: vendorId,
        month,
        year,
        label,
        creditedAmount: item.amount,
        balance: Math.min(item.amount, currentVendorBalance), // cap at vendor's remaining balance
      });

      // Also patch the IncentiveUpload with month/year/label if missing
      if (!upload.month || !upload.year) {
        await IncentiveUpload.findByIdAndUpdate(upload._id, { month, year, walletLabel: label });
      }

      covered.add(key);
      newlyCreated.push(created.toObject());
    }

    // 3. Re-fetch all wallets (including newly created ones)
    //    Only return wallets with balance > 0 — zero balance wallets are hidden.
    //    Also cap sub-wallet balances so their total never exceeds vendor.walletBalance
    //    (handles legacy data where sub-wallets weren't decremented on redemption).
    const mainBalance = parseFloat((vendorCheck.walletBalance || 0).toFixed(2));
    const rawWallets = await MonthlyWallet.find({ vendor: vendorId, balance: { $gt: 0 } })
      .sort({ year: 1, month: 1 }) // oldest first for FIFO cap
      .lean();

    let remaining = mainBalance;
    const allWallets = [];
    for (const mw of rawWallets) {
      if (remaining <= 0) break;
      const cappedBalance = parseFloat(Math.min(mw.balance, remaining).toFixed(2));
      allWallets.push({ ...mw, balance: cappedBalance });
      remaining = parseFloat((remaining - cappedBalance).toFixed(2));
    }

    // Sort newest first for display
    allWallets.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

    res.status(200).json({ success: true, data: allWallets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/incentives/uploads-without-wallets
// @desc    Returns all IncentiveUpload records that have items but no
//          corresponding MonthlyWallet documents — read-only, no data change
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/uploads-without-wallets', protect, authorize('admin'), async (req, res) => {
  try {
    // All uploads that have items
    const uploads = await IncentiveUpload.find({ 'items.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .lean();

    const result = [];

    for (const upload of uploads) {
      // For each upload, check if any vendor in items is missing a MonthlyWallet
      // Use upload.month/year if set, otherwise use createdAt month/year
      const month = upload.month || (new Date(upload.createdAt).getMonth() + 1);
      const year  = upload.year  || new Date(upload.createdAt).getFullYear();
      const label = upload.walletLabel || `${MONTH_NAMES[month - 1]} ${year}`;

      const vendorIds = upload.items.map(i => i.vendor);
      const existingWallets = await MonthlyWallet.find({
        vendor: { $in: vendorIds },
        month,
        year,
      }).select('vendor').lean();

      const existingVendorIds = new Set(existingWallets.map(w => String(w.vendor)));
      const missingCount = vendorIds.filter(id => !existingVendorIds.has(String(id))).length;

      result.push({
        _id: upload._id,
        fileName: upload.fileName,
        createdAt: upload.createdAt,
        month,
        year,
        label,
        totalVendors: vendorIds.length,
        walletsExist: existingWallets.length,
        walletsMissing: missingCount,
        totalAmount: upload.totalAmount,
        walletLabelStored: upload.walletLabel || null,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/incentives/create-wallets-from-upload/:uploadId
// @desc    Takes an existing IncentiveUpload record and creates MonthlyWallet
//          documents for each item that doesn't already have one.
//          Does NOT touch vendor.walletBalance or WalletTransaction records.
//          Body: { month, year }  — override month/year if upload has null
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-wallets-from-upload/:uploadId', protect, authorize('admin'), async (req, res) => {
  try {
    const uploadRecord = await IncentiveUpload.findById(req.params.uploadId).lean();
    if (!uploadRecord) {
      return res.status(404).json({ success: false, message: 'Upload record not found' });
    }

    // Determine month/year — from body override, then from upload, then from createdAt
    const month = parseInt(req.body.month) || uploadRecord.month || (new Date(uploadRecord.createdAt).getMonth() + 1);
    const year  = parseInt(req.body.year)  || uploadRecord.year  || new Date(uploadRecord.createdAt).getFullYear();

    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Valid month required (1-12)' });
    }
    if (!year || year < 2020 || year > 2100) {
      return res.status(400).json({ success: false, message: 'Valid year required' });
    }

    const walletLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    let created = 0;
    let skipped = 0;
    const details = [];

    for (const item of uploadRecord.items) {
      const vendorId = item.vendor;
      const amount   = item.amount;

      // Check if wallet already exists — skip if yes
      const existing = await MonthlyWallet.findOne({ vendor: vendorId, month, year });
      if (existing) {
        skipped++;
        details.push({ vendorId, status: 'skipped', reason: `${walletLabel} wallet already exists (balance: ₹${existing.balance})` });
        continue;
      }

      // Create MonthlyWallet ONLY — no vendor balance, no transaction
      await MonthlyWallet.create({
        vendor: vendorId,
        month,
        year,
        label: walletLabel,
        creditedAmount: amount,
        balance: amount,
      });

      created++;
      details.push({ vendorId, status: 'created', amount, walletLabel });
    }

    // Also patch the upload record's month/year/label if they were null
    if (!uploadRecord.month || !uploadRecord.year) {
      await IncentiveUpload.findByIdAndUpdate(uploadRecord._id, { month, year, walletLabel });
    }

    res.status(200).json({
      success: true,
      message: `${created} wallets created, ${skipped} already existed`,
      data: { walletLabel, created, skipped, total: uploadRecord.items.length, details },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/incentives/sync-wallet-balances
// @desc    Admin utility — for each vendor's MonthlyWallet documents, if the
//          total MonthlyWallet balances exceed vendor.walletBalance (meaning
//          vendor already redeemed but sub-wallet wasn't deducted), cap the
//          sub-wallet balances proportionally to match vendor.walletBalance.
//          Safe to run multiple times. No WalletTransaction created.
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync-wallet-balances', protect, authorize('admin'), async (req, res) => {
  try {
    // Get all vendors who have MonthlyWallet documents
    const walletVendorIds = await MonthlyWallet.distinct('vendor');
    let fixed = 0;
    let ok = 0;
    const details = [];

    for (const vendorId of walletVendorIds) {
      const vendor = await Vendor.findById(vendorId).select('walletBalance companyName').lean();
      if (!vendor) continue;

      const actualBalance = parseFloat((vendor.walletBalance || 0).toFixed(2));
      const subWallets = await MonthlyWallet.find({ vendor: vendorId, balance: { $gt: 0 } })
        .sort({ year: 1, month: 1 }).lean();

      const subTotal = parseFloat(subWallets.reduce((s, w) => s + w.balance, 0).toFixed(2));

      if (subTotal <= actualBalance) {
        ok++;
        continue; // already in sync or sub-wallets under-represent (fine)
      }

      // Sub-wallets over-represent — need to reduce
      // Strategy: drain from oldest wallets first (FIFO), set excess to 0
      let remaining = actualBalance;
      for (const mw of subWallets) {
        const newBal = parseFloat(Math.min(mw.balance, remaining).toFixed(2));
        await MonthlyWallet.findByIdAndUpdate(mw._id, { balance: newBal });
        remaining = parseFloat((remaining - newBal).toFixed(2));
      }

      fixed++;
      details.push({
        vendorId,
        vendorName: vendor.companyName,
        actualBalance,
        wasSubTotal: subTotal,
      });
    }

    res.status(200).json({
      success: true,
      message: `${fixed} vendors synced, ${ok} already correct`,
      data: { fixed, ok, details },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
