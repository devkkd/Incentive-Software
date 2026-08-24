const express = require('express');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Ensure legacy MonthlyWallet labels have corresponding Wallet documents
 */
async function syncLegacyWallets() {
  const distinctLabels = await MonthlyWallet.distinct('label');
  for (const label of distinctLabels) {
    if (!label) continue;
    let wallet = await Wallet.findOne({ name: label });
    if (!wallet) {
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
    // Run legacy sync in background — don't await, don't block response
    syncLegacyWallets().catch(err => console.error('[syncLegacyWallets]', err.message));

    const wallets = await Wallet.find().sort({ createdAt: -1 }).lean();

    // ── System-wide totals from WalletTransaction (ground truth) ─────────────
    const creditAgg = await WalletTransaction.aggregate([
      { $match: { type: 'credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalCreditedFromTxn = parseFloat((creditAgg[0]?.total || 0).toFixed(2));

    const redeemAgg = await WalletTransaction.aggregate([
      { $match: { type: 'debit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRedeemed = parseFloat((redeemAgg[0]?.total || 0).toFixed(2));

    // Total System Balance = Credited - ALL Redeemed
    const trueSystemBalance = parseFloat((totalCreditedFromTxn - totalRedeemed).toFixed(2));

    // ── Per-wallet stats ──────────────────────────────────────────────────────
    const rawResult = await Promise.all(
      wallets.map(async (w) => {
        const filter = { $or: [{ wallet: w._id }, { label: w.name }] };
        const partyWallets = await MonthlyWallet.find(filter)
          .select('_id balance creditedAmount isHold')
          .lean();

        const totalCredited = parseFloat(partyWallets.reduce((acc, curr) => acc + (curr.creditedAmount || 0), 0).toFixed(2));
        const totalParties = partyWallets.length;
        const heldPartiesCount = partyWallets.filter((pw) => pw.isHold).length;
        const partiesWithBalance = partyWallets.filter((pw) => (pw.balance || 0) > 0).length;

        return { ...w, totalCredited, totalParties, heldPartiesCount, partiesWithBalance };
      })
    );

    // Distribute trueSystemBalance proportionally across wallets by creditedAmount
    const totalAllCredited = rawResult.reduce((s, w) => s + (w.totalCredited || 0), 0);
    const result = rawResult.map((w, i) => {
      const share = totalAllCredited > 0
        ? parseFloat(((w.totalCredited / totalAllCredited) * trueSystemBalance).toFixed(2))
        : 0;
      return { ...w, totalBalance: Math.max(0, share) };
    });

    // Fix rounding on last wallet so sum is exact
    if (result.length > 0) {
      const sumExceptLast = result.slice(0, -1).reduce((s, w) => s + w.totalBalance, 0);
      result[result.length - 1].totalBalance = Math.max(0, parseFloat((trueSystemBalance - sumExceptLast).toFixed(2)));
    }

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
      trueSystemBalance,
      totalCreditedFromTxn,
      totalRedeemed,
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
      .filter((mw) => mw.vendor)
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

// @route   GET /api/wallets/diagnostics
// @desc    Cross-check all balance sources to find mismatches
// @access  Admin only
router.get('/diagnostics', protect, authorize('admin'), async (req, res) => {
  try {
    const vendorAgg = await Vendor.aggregate([
      { $group: { _id: null, total: { $sum: '$walletBalance' }, count: { $sum: 1 } } }
    ]);
    const vendorBalanceSum = parseFloat((vendorAgg[0]?.total || 0).toFixed(2));
    const vendorCount = vendorAgg[0]?.count || 0;

    const creditAgg = await WalletTransaction.aggregate([
      { $match: { type: 'credit' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const totalCredits = parseFloat((creditAgg[0]?.total || 0).toFixed(2));
    const creditCount = creditAgg[0]?.count || 0;

    const debitAgg = await WalletTransaction.aggregate([
      { $match: { type: 'debit' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const totalDebits = parseFloat((debitAgg[0]?.total || 0).toFixed(2));
    const debitCount = debitAgg[0]?.count || 0;

    const expectedBalance = parseFloat((totalCredits - totalDebits).toFixed(2));

    const orphanDebits = await WalletTransaction.aggregate([
      { $match: { type: 'debit', monthlyWallet: null } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const orphanDebitTotal = parseFloat((orphanDebits[0]?.total || 0).toFixed(2));
    const orphanDebitCount = orphanDebits[0]?.count || 0;

    const newFlowDebitTotal = parseFloat((totalDebits - orphanDebitTotal).toFixed(2));
    const adjustedExpectedBalance = parseFloat((totalCredits - newFlowDebitTotal).toFixed(2));

    res.status(200).json({
      success: true,
      data: {
        vendorBalanceSum,
        vendorCount,
        totalCredits,
        creditCount,
        totalDebits,
        debitCount,
        expectedBalance,
        orphanDebitTotal,
        orphanDebitCount,
        newFlowDebitTotal,
        adjustedExpectedBalance,
        isReconciled: Math.abs(vendorBalanceSum - expectedBalance) < 1,
        wouldReconcileAfterCleanup: Math.abs(vendorBalanceSum - adjustedExpectedBalance) < 1,
        discrepancy: parseFloat((vendorBalanceSum - expectedBalance).toFixed(2)),
        discrepancyAfterCleanup: parseFloat((vendorBalanceSum - adjustedExpectedBalance).toFixed(2)),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
