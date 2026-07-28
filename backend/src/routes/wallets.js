const express = require('express');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Helper to ensure legacy MonthlyWallet labels have corresponding Wallet documents
 */
async function syncLegacyWallets() {
  const distinctLabels = await MonthlyWallet.distinct('label');
  for (const label of distinctLabels) {
    if (!label) continue;
    let wallet = await Wallet.findOne({ name: label });
    if (!wallet) {
      // Try to parse month/year from label if "Month Year" pattern
      let month = null;
      let year = null;
      const parts = label.split(' ');
      if (parts.length === 2) {
        const mIdx = MONTH_NAMES.findIndex(
          (m) => m.toLowerCase() === parts[0].toLowerCase()
        );
        if (mIdx !== -1) month = mIdx + 1;
        const parsedYear = parseInt(parts[1], 10);
        if (!isNaN(parsedYear)) year = parsedYear;
      }
      wallet = await Wallet.create({
        name: label,
        month,
        year,
        description: 'Auto-synchronized wallet',
      });
    }

    // Link unlinked MonthlyWallet records to this master Wallet
    await MonthlyWallet.updateMany(
      { label, wallet: null },
      { wallet: wallet._id }
    );
  }
}

// @route   GET /api/wallets
// @desc    Get all wallets with current balances, party counts, and hold status
// @access  Branch, Admin
router.get('/', protect, async (req, res) => {
  try {
    await syncLegacyWallets();

    const wallets = await Wallet.find().sort({ createdAt: -1 }).lean();

    // Calculate aggregated balances per wallet
    const result = await Promise.all(
      wallets.map(async (w) => {
        // Query by wallet ID or label for robustness
        const filter = {
          $or: [{ wallet: w._id }, { label: w.name }],
        };

        const partyWallets = await MonthlyWallet.find(filter).select('balance creditedAmount isHold').lean();

        const totalBalance = partyWallets.reduce((acc, curr) => acc + (curr.balance || 0), 0);
        const totalCredited = partyWallets.reduce((acc, curr) => acc + (curr.creditedAmount || 0), 0);
        const partiesWithBalance = partyWallets.filter((pw) => (pw.balance || 0) > 0).length;
        const totalParties = partyWallets.length;
        const heldPartiesCount = partyWallets.filter((pw) => pw.isHold).length;

        return {
          ...w,
          totalBalance: parseFloat(totalBalance.toFixed(2)),
          totalCredited: parseFloat(totalCredited.toFixed(2)),
          partiesWithBalance,
          totalParties,
          heldPartiesCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/wallets
// @desc    Create a new wallet
// @access  Branch, Admin
router.post('/', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { name, description, month, year } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Wallet name is required' });
    }

    const existing = await Wallet.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A wallet with this name already exists' });
    }

    const wallet = await Wallet.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      month: month ? parseInt(month, 10) : null,
      year: year ? parseInt(year, 10) : null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: wallet,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/wallets/:id/parties
// @desc    Get all parties having balances in a specific wallet
// @access  Branch, Admin
router.get('/:id/parties', protect, async (req, res) => {
  try {
    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) {
      return res.status(400).json({ success: false, message: 'Wallet not found' });
    }

    const filter = {
      $or: [{ wallet: wallet._id }, { label: wallet.name }],
    };

    const monthlyWallets = await MonthlyWallet.find(filter)
      .populate({
        path: 'vendor',
        select: 'companyName personName accountNumber mobileNumber partyCity partyType status walletBalance division',
        populate: { path: 'division', select: 'name code' },
      })
      .sort({ balance: -1 })
      .lean();

    const parties = monthlyWallets
      .filter((mw) => mw.vendor) // Ensure vendor exists
      .map((mw) => ({
        monthlyWalletId: mw._id,
        vendorId: mw.vendor._id,
        companyName: mw.vendor.companyName,
        personName: mw.vendor.personName,
        accountNumber: mw.vendor.accountNumber,
        mobileNumber: mw.vendor.mobileNumber,
        partyCity: mw.vendor.partyCity,
        partyType: mw.vendor.partyType,
        vendorStatus: mw.vendor.status,
        divisionName: mw.vendor.division?.name || 'N/A',
        totalVendorBalance: mw.vendor.walletBalance,
        creditedAmount: mw.creditedAmount || 0,
        balance: mw.balance || 0,
        isHold: !!mw.isHold,
        holdReason: mw.holdReason || null,
        walletIsHold: !!wallet.isHold,
      }));

    res.status(200).json({
      success: true,
      wallet: {
        _id: wallet._id,
        name: wallet.name,
        isHold: wallet.isHold,
        holdReason: wallet.holdReason,
      },
      count: parties.length,
      data: parties,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/wallets/:id/hold
// @desc    Hold or unhold an entire wallet
// @access  Branch, Admin
router.patch('/:id/hold', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { isHold, holdReason } = req.body;
    if (typeof isHold !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isHold boolean field is required' });
    }

    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.isHold = isHold;
    wallet.holdReason = isHold ? (holdReason || 'Wallet placed on hold by admin') : null;
    await wallet.save();

    res.status(200).json({
      success: true,
      message: isHold ? `Wallet "${wallet.name}" is now on hold` : `Wallet "${wallet.name}" released from hold`,
      data: wallet,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/wallets/party-hold
// @desc    Hold or unhold balance of an individual party in a wallet
// @access  Branch, Admin
router.patch('/party-hold', protect, authorize('branch', 'admin'), async (req, res) => {
  try {
    const { monthlyWalletId, isHold, holdReason } = req.body;

    if (!monthlyWalletId) {
      return res.status(400).json({ success: false, message: 'monthlyWalletId is required' });
    }
    if (typeof isHold !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isHold boolean field is required' });
    }

    const mw = await MonthlyWallet.findById(monthlyWalletId).populate('vendor', 'companyName');
    if (!mw) {
      return res.status(404).json({ success: false, message: 'Party wallet record not found' });
    }

    mw.isHold = isHold;
    mw.holdReason = isHold ? (holdReason || 'Party balance placed on hold') : null;
    await mw.save();

    res.status(200).json({
      success: true,
      message: isHold
        ? `Balance held for ${mw.vendor?.companyName || 'party'}`
        : `Balance released for ${mw.vendor?.companyName || 'party'}`,
      data: mw,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
