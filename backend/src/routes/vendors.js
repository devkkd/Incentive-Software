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
      .populate('division', 'name location');

    res.status(200).json({
      success: true,
      data: vendors,
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
    const { companyName, personName, mobileNumber, email, address, status, salesPerson, partyCity, partyType } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { companyName, personName, mobileNumber, email, address, status, salesPerson, partyCity, partyType },
      { new: true, runValidators: true }
    );

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

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
    const transactions = await WalletTransaction.find({ vendor: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('invoice', 'invoiceNumber referenceNo invoiceDate invoiceAmount location remark');

    res.status(200).json({ success: true, data: transactions });
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

module.exports = router;
