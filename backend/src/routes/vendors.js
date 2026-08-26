const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Vendor = require('../models/Vendor');
const Division = require('../models/Division');
const Invoice = require('../models/Invoice');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(csv|xlsx|xls)$/i)) cb(null, true);
    else cb(new Error('Only CSV or Excel files are allowed'));
  },
});

// @route   POST /api/vendors
// @access  Admin only
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { companyName, personName, accountNumber, mobileNumber, email, address, salesPerson, partyCity, partyType } = req.body;

    if (!companyName || !accountNumber || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'Party Name, Party Code and Mobile Number are required' });
    }

    // personName defaults to companyName if not provided
    const resolvedPersonName = personName || companyName;

    // Get division for location code prefix
    const divisionId = req.user.role === 'branch'
      ? (req.user.division._id || req.user.division)
      : req.body.divisionId;
    const division = await Division.findById(divisionId);

    if (!division) {
      return res.status(400).json({ success: false, message: 'Division not found' });
    }

    // Prefix account number with branch code (name): AJM-12345
    const prefixedAccountNumber = `${division.name}-${accountNumber}`;

    // Check duplicate
    const existing = await Vendor.findOne({
      $or: [{ accountNumber: prefixedAccountNumber }, { mobileNumber }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.accountNumber === prefixedAccountNumber
          ? 'This account number already exists'
          : 'This mobile number is already registered',
      });
    }

    const vendor = await Vendor.create({
      companyName,
      personName: resolvedPersonName,
      accountNumber: prefixedAccountNumber,
      mobileNumber,
      email: email || null,
      address: address || '',
      salesPerson: salesPerson || null,
      partyCity: partyCity || null,
      partyType: partyType || null,
      division: divisionId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/vendors/bulk-import
// @desc    Import vendors from Excel with format: Loc, Cons Party Code, Cons Party Name, Cons Party City Desc, Party Type, Net Retail Qty, Mobile No, Sales Person
// @access  Admin only
router.post('/bulk-import', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in the file' });
    }

    const normalize = (obj) => {
      const result = {};
      for (const key of Object.keys(obj)) result[key.toLowerCase().replace(/\s+/g, ' ').trim()] = obj[key];
      return result;
    };

    const results = { success: [], failed: [] };

    for (const rawRow of rows) {
      const row = normalize(rawRow);

      const loc = String(row['location'] || row['loc'] || '').trim().toUpperCase();
      const consPartyCode = String(row['party code'] || row['cons party code'] || row['cons_party_code'] || '').trim();
      const consPartyName = String(row['party name'] || row['cons party name'] || row['cons_party_name'] || '').trim();
      const city = String(row['party city'] || row['cons party city desc'] || row['cons_party_city_desc'] || row['city'] || '').trim();
      const partyType = String(row['party type'] || row['party_type'] || '').trim();
      const mobileNumber = String(row['mobile no'] || row['mobile_no'] || row['mobile'] || '').trim();
      const salesPerson = String(row['sales person name'] || row['sales person'] || row['sales_person'] || '').trim();
      const email = String(row['email address'] || row['email'] || '').trim();
      const address = String(row['address'] || '').trim();

      if (!loc || !consPartyCode || !consPartyName) {
        results.failed.push({ row: consPartyCode || 'N/A', reason: 'Missing required fields: Loc, Cons Party Code, Cons Party Name' });
        continue;
      }

      if (!mobileNumber || !/^\d{10}$/.test(mobileNumber)) {
        results.failed.push({ row: consPartyCode, reason: 'Invalid or missing 10-digit mobile number' });
        continue;
      }

      // Find division by branch code (name field, e.g. AJM)
      const division = await Division.findOne({ name: loc });
      if (!division) {
        results.failed.push({ row: consPartyCode, reason: `Division not found for location code: ${loc}` });
        continue;
      }

      const prefixedAccountNumber = `${loc}-${consPartyCode}`;

      // Check duplicate
      const existing = await Vendor.findOne({
        $or: [{ accountNumber: prefixedAccountNumber }, { mobileNumber }],
      });

      if (existing) {
        results.failed.push({
          row: consPartyCode,
          reason: existing.accountNumber === prefixedAccountNumber
            ? 'Account number already exists'
            : 'Mobile number already registered',
        });
        continue;
      }

      try {
        const vendor = await Vendor.create({
          companyName: consPartyName,
          personName: consPartyName,
          accountNumber: prefixedAccountNumber,
          mobileNumber,
          address: address || city || '',
          partyCity: city || null,
          partyType: partyType || null,
          salesPerson: salesPerson || null,
          email: email || null,
          division: division._id,
          createdBy: req.user._id,
        });
        results.success.push({ accountNumber: prefixedAccountNumber, companyName: consPartyName });
      } catch (err) {
        results.failed.push({ row: consPartyCode, reason: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `${results.success.length} vendors imported, ${results.failed.length} failed`,
      data: { successCount: results.success.length, failedCount: results.failed.length, successList: results.success, failedList: results.failed },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors
// @access  Branch, Admin
router.get('/', protect, async (req, res) => {
  try {
    const { status, q, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Branch sees ALL vendors (no division filter)
    // Admin also sees all vendors

    if (status) filter.status = status;

    if (q) {
      filter.$or = [
        { companyName: { $regex: q, $options: 'i' } },
        { mobileNumber: { $regex: q, $options: 'i' } },
        { accountNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const total = await Vendor.countDocuments(filter);
    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('division', 'name location')
      .lean();

    // For branch users: calculate usableWalletBalance (excluding held wallets)
    // Admin sees actual walletBalance; branch sees only unheld balance
    const isBranch = req.user.role === 'branch';
    let vendorsWithUsable = vendors;

    if (isBranch) {
      const MonthlyWallet = require('../models/MonthlyWallet');
      const Wallet = require('../models/Wallet');
      const vendorIds = vendors.map(v => v._id);

      // Get all MonthlyWallets for these vendors
      const monthlyWallets = await MonthlyWallet.find({
        vendor: { $in: vendorIds },
        balance: { $gt: 0 },
      }).lean();

      // Get all master wallets to check hold status
      const walletIds = [...new Set(monthlyWallets.map(mw => mw.wallet).filter(Boolean).map(String))];
      const masterWallets = await Wallet.find({ _id: { $in: walletIds } }).select('_id isHold').lean();
      const masterWalletMap = {};
      masterWallets.forEach(w => { masterWalletMap[String(w._id)] = w.isHold; });

      // Group by vendor — sum only unheld balances
      const usableMap = {};
      monthlyWallets.forEach(mw => {
        const vid = String(mw.vendor);
        if (mw.isHold) return; // party-level hold
        if (mw.wallet && masterWalletMap[String(mw.wallet)]) return; // wallet-level hold
        usableMap[vid] = parseFloat(((usableMap[vid] || 0) + mw.balance).toFixed(2));
      });

      vendorsWithUsable = vendors.map(v => ({
        ...v,
        walletBalance: usableMap[String(v._id)] ?? 0, // show only usable balance to branch
      }));
    }

    res.status(200).json({
      success: true,
      data: vendorsWithUsable,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors/search?q=mobileOrAccount
// @access  Branch, Admin
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const trimmed = q.trim();

    // Build search conditions:
    // 1. Exact mobile number match
    // 2. Exact full account number match (e.g. ETY-TRJ020)
    // 3. Suffix match — account number ends with the query (e.g. TRJ020 matches ETY-TRJ020)
    let vendor = await Vendor.findOne({
      $or: [
        { mobileNumber: trimmed },
        { accountNumber: trimmed },
        { accountNumber: { $regex: `-${trimmed}$`, $options: 'i' } },
      ],
      status: { $ne: 'blocked' },
    }).populate('division', 'name location locationCode');

    if (!vendor) {
      const invoice = await Invoice.findOne({
        invoiceNumber: trimmed,
      }).populate({
        path: 'vendor',
        populate: { path: 'division', select: 'name location locationCode' },
      });

      if (!invoice) {
        const invoiceSuffix = await Invoice.findOne({
          invoiceNumber: { $regex: `${trimmed}$`, $options: 'i' },
        }).populate({
          path: 'vendor',
          populate: { path: 'division', select: 'name location locationCode' },
        });
        if (invoiceSuffix) vendor = invoiceSuffix.vendor;
      } else if (invoice.vendor && invoice.vendor.status !== 'blocked') {
        vendor = invoice.vendor;
      }

      if (invoice && invoice.vendor && invoice.vendor.status !== 'blocked') {
        vendor = invoice.vendor;
      }
    }

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors/:id
// @access  Branch, Admin
router.get('/:id', protect, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('division', 'name location locationCode');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/vendors/:id
// @access  Admin only
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { companyName, personName, mobileNumber, email, address, status, salesPerson, partyCity, partyType, accountNumber, divisionId } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // If divisionId or accountNumber provided, reconstruct prefixed accountNumber and check duplicates
    let updatedAccountNumber = vendor.accountNumber;
    let updatedDivision = vendor.division;

    if (divisionId || accountNumber) {
      const divId = divisionId || vendor.division;
      const division = await Division.findById(divId);
      if (!division) return res.status(400).json({ success: false, message: 'Division not found' });
      updatedDivision = division._id;
      const suffix = (accountNumber || '').toString().trim() || (vendor.accountNumber || '').toString().split('-').slice(1).join('-');
      updatedAccountNumber = `${division.name}-${suffix}`;

      // Check duplicates excluding current vendor
      const existing = await Vendor.findOne({
        $or: [{ accountNumber: updatedAccountNumber }, { mobileNumber }],
        _id: { $ne: vendor._id },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: existing.accountNumber === updatedAccountNumber ? 'This account number already exists' : 'This mobile number is already registered' });
      }
    }

    vendor.companyName = companyName !== undefined ? companyName : vendor.companyName;
    vendor.personName = personName !== undefined ? personName : vendor.personName;
    vendor.mobileNumber = mobileNumber !== undefined ? mobileNumber : vendor.mobileNumber;
    vendor.email = (email !== undefined) ? email : vendor.email;
    vendor.address = (address !== undefined) ? address : vendor.address;
    vendor.status = status !== undefined ? status : vendor.status;
    vendor.salesPerson = salesPerson !== undefined ? salesPerson : vendor.salesPerson;
    vendor.partyCity = partyCity !== undefined ? partyCity : vendor.partyCity;
    vendor.partyType = partyType !== undefined ? partyType : vendor.partyType;
    vendor.accountNumber = updatedAccountNumber;
    vendor.division = updatedDivision;

    await vendor.save();

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/vendors/:id/block
// @access  Branch, Admin
router.put('/:id/block', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { blockReason } = req.body;
    if (!blockReason?.trim()) {
      return res.status(400).json({ success: false, message: 'Block reason is required' });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { status: 'blocked', blockReason },
      { new: true }
    );

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/vendors/:id/transactions
// @access  Branch, Admin
router.get('/:id/transactions', protect, async (req, res) => {
  try {
    const WalletTransaction = require('../models/WalletTransaction');
    const Vendor = require('../models/Vendor');

    // Fetch transactions oldest-first so we can do a clean forward pass
    const [rawTransactions, vendor] = await Promise.all([
      WalletTransaction.find({ vendor: req.params.id })
        .sort({ createdAt: 1 })
        .populate({
          path: 'invoice',
          select: 'invoiceNumber referenceNo invoiceDate invoiceAmount location remark division',
          populate: { path: 'division', select: 'name location' }
        })
        .lean(),
      Vendor.findById(req.params.id).select('walletBalance').lean(),
    ]);

    if (!rawTransactions.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Forward-pass: recalculate balanceAfter for every transaction from scratch.
    // Start from 0, apply each credit/debit in chronological order.
    // This gives correct running balance regardless of what was stored in DB.
    // The final computed balance may differ from vendor.walletBalance if DB is stale,
    // but the running balance column will always be internally consistent.
    let running = 0;
    const corrected = rawTransactions.map(trx => {
      const amount = parseFloat((trx.amount || 0).toFixed(2));
      if (trx.type === 'credit') {
        running = parseFloat((running + amount).toFixed(2));
      } else {
        running = parseFloat((running - amount).toFixed(2));
      }
      return { ...trx, balanceAfter: running };
    });

    // Return newest-first as frontend expects
    corrected.reverse();

    res.status(200).json({ success: true, data: corrected });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/vendors/:id
// @access  Admin only
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/vendors/sync-wallet-balances
// @desc    Admin utility — recalculate every vendor's walletBalance from their
//          WalletTransaction records (forward pass: credits add, debits subtract).
//          This safely corrects stale walletBalance values in DB without touching
//          any transaction records. Safe to run multiple times (idempotent).
// @access  Admin only
router.post('/sync-wallet-balances', protect, authorize('admin'), async (req, res) => {
  try {
    const WalletTransaction = require('../models/WalletTransaction');

    // Get all unique vendor IDs that have transactions
    const vendorIds = await WalletTransaction.distinct('vendor');
    let updated = 0;
    let skipped = 0;
    const details = [];

    for (const vendorId of vendorIds) {
      const vendor = await Vendor.findById(vendorId).select('companyName walletBalance').lean();
      if (!vendor) continue;

      // Forward pass: oldest first, sum credits minus debits
      const transactions = await WalletTransaction.find({ vendor: vendorId })
        .sort({ createdAt: 1 })
        .select('type amount')
        .lean();

      let calculatedBalance = 0;
      for (const trx of transactions) {
        const amount = parseFloat((trx.amount || 0).toFixed(2));
        if (trx.type === 'credit') calculatedBalance += amount;
        else calculatedBalance -= amount;
      }
      calculatedBalance = parseFloat(calculatedBalance.toFixed(2));

      const currentBalance = parseFloat((vendor.walletBalance || 0).toFixed(2));

      if (Math.abs(calculatedBalance - currentBalance) < 0.01) {
        skipped++;
        continue; // already correct
      }

      // Update DB
      await Vendor.findByIdAndUpdate(vendorId, { walletBalance: calculatedBalance });
      details.push({
        vendorId,
        name: vendor.companyName,
        was: currentBalance,
        now: calculatedBalance,
        diff: parseFloat((calculatedBalance - currentBalance).toFixed(2)),
      });
      updated++;
    }

    res.status(200).json({
      success: true,
      message: `${updated} vendors updated, ${skipped} already correct`,
      data: { updated, skipped, details },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/vendors/manual-redeem-fix
// @desc    One-time admin fix — create missing debit WalletTransactions for
//          invoices that were created without redemption (old code bug).
//          Vendor: JOH-WRJ0218060 (SHREE RAM MARUTI), balance to set: 0
// @access  Admin only
router.post('/manual-redeem-fix', protect, authorize('admin'), async (req, res) => {
  try {
    const WalletTransaction = require('../models/WalletTransaction');

    const vendorId = '6a09a83816ace890a001aa4d'; // SHREE RAM MARUTI

    // Check vendor exists and current balance
    const vendor = await Vendor.findById(vendorId).select('companyName walletBalance');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // Find the 3 invoices by referenceNo
    const refs = ['13879219', '57299280', '86539963'];
    const invoices = await Invoice.find({
      vendor: vendorId,
      referenceNo: { $in: refs }
    }).lean();

    if (invoices.length !== 3) {
      return res.status(400).json({
        success: false,
        message: `Expected 3 invoices, found ${invoices.length}`,
        found: invoices.map(i => i.referenceNo)
      });
    }

    // Check if debit transactions already exist for these invoices
    const existingDebits = await WalletTransaction.find({
      vendor: vendorId,
      invoice: { $in: invoices.map(i => i._id) },
      type: 'debit'
    }).lean();

    if (existingDebits.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Debit transactions already exist for some of these invoices',
        existing: existingDebits.map(t => ({ invoice: t.invoice, amount: t.amount }))
      });
    }

    // Amounts: total must equal vendor.walletBalance (10600)
    // 13879219 → 1075, 57299280 → 4884, 86539963 → 4641 (adjusted -10 to match total)
    const redeemMap = {
      '13879219': 1075,
      '57299280': 4884,
      '86539963': 4641,
    };

    const totalRedeem = Object.values(redeemMap).reduce((s, v) => s + v, 0); // 10600

    if (totalRedeem !== vendor.walletBalance) {
      return res.status(400).json({
        success: false,
        message: `Total redeem (${totalRedeem}) !== vendor balance (${vendor.walletBalance}). Cannot proceed.`
      });
    }

    // Create debit transactions and set balanceAfter progressively
    let runningBalance = vendor.walletBalance;
    const created = [];

    // Sort invoices by date to maintain chronological order
    const sortedInvoices = invoices.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

    for (const inv of sortedInvoices) {
      const amount = redeemMap[inv.referenceNo];
      runningBalance = parseFloat((runningBalance - amount).toFixed(2));

      const trx = await WalletTransaction.create({
        vendor: vendorId,
        invoice: inv._id,
        type: 'debit',
        amount,
        balanceAfter: runningBalance,
        description: `Redemption Rs.${amount} from April 2026`,
        processedBy: req.user._id,
        walletLabel: 'April 2026',
      });

      created.push({ ref: inv.referenceNo, amount, balanceAfter: runningBalance, txnId: trx._id });
    }

    // Update vendor walletBalance to 0
    await Vendor.findByIdAndUpdate(vendorId, { walletBalance: 0 });

    res.status(200).json({
      success: true,
      message: `3 debit transactions created, vendor balance set to 0`,
      data: { vendorName: vendor.companyName, created }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
