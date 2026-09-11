const express = require('express');
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const Vendor = require('../models/Vendor');
const WalletTransaction = require('../models/WalletTransaction');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../services/audit');

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
    // Current Balance = direct sum of MonthlyWallet.balance for that wallet.
    // This is the accurate remaining balance — no proportional estimation needed.
    const result = await Promise.all(
      wallets.map(async (w) => {
        const filter = { $or: [{ wallet: w._id }, { label: w.name }] };
        const partyWallets = await MonthlyWallet.find(filter)
          .select('_id balance creditedAmount isHold vendor')
          .lean();

        // ── POINT 1 + 17 ────────────────────────────────────────────────────
        // Only count wallets whose party still exists, so this total matches
        // the party list shown in the drawer. Also track which are active.
        const vendorDocs = await Vendor.find({ _id: { $in: partyWallets.map((p) => p.vendor) } })
          .select('_id status')
          .lean();
        const vendorMap = new Map(vendorDocs.map((v) => [String(v._id), v.status]));

        const live   = partyWallets.filter((pw) => pw.vendor && vendorMap.has(String(pw.vendor)));
        const orphan = partyWallets.filter((pw) => !pw.vendor || !vendorMap.has(String(pw.vendor)));

        const sum = (arr, f) => parseFloat(arr.reduce((a, c) => a + (c[f] || 0), 0).toFixed(2));

        const totalCredited = sum(live, 'creditedAmount');
        const totalBalance  = sum(live, 'balance'); // negatives no longer hidden

        // Held = the whole scheme is on hold, OR this party's wallet is on hold
        const heldBalance = sum(live.filter((pw) => w.isHold || pw.isHold), 'balance');
        const freeBalance = sum(live.filter((pw) => !w.isHold && !pw.isHold), 'balance');

        // Balance belonging to blocked parties — real money that cannot be spent
        const blockedBalance = sum(
          live.filter((pw) => vendorMap.get(String(pw.vendor)) === 'blocked'),
          'balance'
        );

        // Spendable today: not on hold, and the party is not blocked
        const activeBalance = sum(
          live.filter(
            (pw) =>
              !w.isHold &&
              !pw.isHold &&
              vendorMap.get(String(pw.vendor)) === 'active'
          ),
          'balance'
        );

        // Data-quality figures — surfaced, not silently folded into the total
        const orphanBalance   = sum(orphan, 'balance');
        const orphanCount     = orphan.length;
        const negativeBalance = sum(live.filter((pw) => (pw.balance || 0) < 0), 'balance');
        const negativeCount   = live.filter((pw) => (pw.balance || 0) < 0).length;

        const totalParties     = live.length;
        const heldPartiesCount = live.filter((pw) => w.isHold || pw.isHold).length;

        // Active = has balance, not on hold, and the party is not blocked
        const partiesWithBalance = live.filter(
          (pw) =>
            (pw.balance || 0) > 0 &&
            !w.isHold &&
            !pw.isHold &&
            vendorMap.get(String(pw.vendor)) === 'active'
        ).length;

        const blockedPartiesCount = live.filter(
          (pw) => vendorMap.get(String(pw.vendor)) === 'blocked'
        ).length;

        return {
          ...w,
          totalCredited, totalBalance, totalParties, heldPartiesCount, partiesWithBalance,
          blockedPartiesCount,
          heldBalance, freeBalance, activeBalance, blockedBalance,
          orphanBalance, orphanCount, negativeBalance, negativeCount,
        };
      })
    );

    // ── POINT 17 — top cards, every one derived from the list below them ────
    const t = (f) => parseFloat(result.reduce((a, w) => a + (w[f] || 0), 0).toFixed(2));

    const cardTotalCredited = t('totalCredited');
    const cardTotalBalance  = t('totalBalance');

    // Total Redeemed = everything credited that is no longer sitting in a wallet
    const cardTotalRedeemed = parseFloat((cardTotalCredited - cardTotalBalance).toFixed(2));

    // System Balance = Credited - Redeemed  (all money still on the books)
    const cardSystemBalance = parseFloat((cardTotalCredited - cardTotalRedeemed).toFixed(2));

    const cardHeldBalance    = t('heldBalance');
    // Count of held monthly wallets — one party held in two months counts twice
    const cardHeldWalletCount = result.reduce((a, w) => a + (w.heldPartiesCount || 0), 0);
    const cardBlockedPartyCount = result.reduce((a, w) => a + (w.blockedPartiesCount || 0), 0);
    const cardBlockedBalance = t('blockedBalance');

    // Active = System - Held - Blocked  (what a party could spend today)
    const cardActiveBalance = t('activeBalance');

    // Data-quality totals
    const cardOrphanBalance   = t('orphanBalance');
    const cardOrphanCount     = result.reduce((a, w) => a + (w.orphanCount || 0), 0);
    const cardNegativeBalance = t('negativeBalance');
    const cardNegativeCount   = result.reduce((a, w) => a + (w.negativeCount || 0), 0);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,

      // Point 17 cards
      cardTotalCredited,
      cardSystemBalance,
      cardTotalRedeemed,
      cardHeldBalance,
      cardHeldWalletCount,
      cardBlockedBalance,
      cardBlockedPartyCount,
      cardActiveBalance,
      cardTotalBalance,

      // Data quality
      cardOrphanBalance,
      cardOrphanCount,
      cardNegativeBalance,
      cardNegativeCount,

      // Ledger figures, kept for comparison against the card values above
      trueSystemBalance,
      totalCreditedFromTxn,
      totalRedeemed,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/wallets/:id/rename-preview
// @desc    What a rename would affect, before doing it (Point 18)
// @access  Admin
router.get('/:id/rename-preview', protect, authorize('admin'), async (req, res) => {
  try {
    const wallet = await Wallet.findById(req.params.id).lean();
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const byId = await MonthlyWallet.countDocuments({ wallet: wallet._id });
    // Legacy records linked only by the name string, with no ID reference
    const byLabelOnly = await MonthlyWallet.countDocuments({
      wallet: null, label: wallet.name,
    });
    const heldCount = await MonthlyWallet.countDocuments({
      $or: [{ wallet: wallet._id }, { wallet: null, label: wallet.name }],
      isHold: true,
    });

    res.status(200).json({
      success: true,
      data: {
        currentName: wallet.name,
        linkedById: byId,
        linkedByNameOnly: byLabelOnly,
        totalAffected: byId + byLabelOnly,
        heldWallets: heldCount,
        schemeOnHold: !!wallet.isHold,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/wallets/:id/rename
// @desc    Rename a wallet everywhere it appears (Point 18)
// @access  Admin
//
// ⚠️ Several places in this codebase find a wallet's parent scheme by NAME
// rather than by ID — including the hold checks in invoices.js and
// incentives.js. If a rename changed only Wallet.name, those lookups would
// stop finding the parent and money that was deliberately frozen would become
// redeemable.
//
// So this does three things, in one transaction:
//   1. Backfills the ID reference on any record linked only by the old name
//   2. Updates the label on every linked record
//   3. Renames the wallet itself
//
// After this, both ID-based and name-based lookups resolve correctly.
router.patch('/:id/rename', protect, authorize('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const newName = (req.body.name || '').trim();

    if (!newName) {
      return res.status(400).json({ success: false, message: 'A name is required' });
    }
    if (newName.length > 60) {
      return res.status(400).json({ success: false, message: 'Name must be 60 characters or fewer' });
    }

    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const oldName = wallet.name;
    if (oldName === newName) {
      return res.status(400).json({ success: false, message: 'That is already the name' });
    }

    // Names must stay unique — the name-based lookups depend on it
    const clash = await Wallet.findOne({ name: newName, _id: { $ne: wallet._id } });
    if (clash) {
      return res.status(400).json({
        success: false,
        message: `A wallet named "${newName}" already exists`,
      });
    }

    let backfilled = 0;
    let relabelled = 0;

    await session.withTransaction(async () => {
      // 1. Legacy records linked only by name — give them the ID reference now,
      //    before the name changes and the link is lost for good.
      const backfill = await MonthlyWallet.updateMany(
        { wallet: null, label: oldName },
        { $set: { wallet: wallet._id } },
        { session }
      );
      backfilled = backfill.modifiedCount || 0;

      // 2. Every linked record gets the new label
      const relabel = await MonthlyWallet.updateMany(
        { wallet: wallet._id },
        { $set: { label: newName } },
        { session }
      );
      relabelled = relabel.modifiedCount || 0;

      // 3. The wallet itself
      wallet.name = newName;
      await wallet.save({ session });
    });

    // Historical transaction descriptions are deliberately left alone — they
    // are a record of what was true at the time.
    audit({
      vendorId: null, eventType: 'wallet.renamed', actor: req.user, source: 'admin',
      walletLabel: newName,
      changes: [{ field: 'walletName', from: oldName, to: newName }],
      summary: `Wallet renamed from "${oldName}" to "${newName}" — ${relabelled} party wallets updated`,
    });

    res.status(200).json({
      success: true,
      message: `Renamed to "${newName}"`,
      data: {
        oldName,
        newName,
        walletsRelabelled: relabelled,
        legacyLinksRepaired: backfilled,
      },
    });
  } catch (error) {
    console.error('[wallet rename]', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
});

// @route   PATCH /api/wallets/:id/notice
// @desc    Set or clear the counter notice on a wallet (Point 22)
// @access  Admin
router.patch('/:id/notice', protect, authorize('admin'), async (req, res) => {
  try {
    const { noticeEnabled, noticeMessage, noticeExpiresOn, lapseDate } = req.body;

    if (noticeEnabled && !noticeMessage?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A message is required when the notice is switched on',
      });
    }
    if (noticeMessage && noticeMessage.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Message must be 120 characters or fewer so it fits the counter display',
      });
    }

    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.noticeEnabled = !!noticeEnabled;
    // Keep the text when switching off, so a recurring notice can be turned
    // back on without retyping it.
    if (noticeMessage !== undefined) wallet.noticeMessage = noticeMessage?.trim() || null;
    if (noticeExpiresOn !== undefined) wallet.noticeExpiresOn = noticeExpiresOn || null;
    if (lapseDate !== undefined) wallet.lapseDate = lapseDate || null;
    wallet.noticeUpdatedBy = req.user._id;
    wallet.noticeUpdatedAt = new Date();

    await wallet.save();

    res.status(200).json({
      success: true,
      message: noticeEnabled ? 'Notice is now showing at the counter' : 'Notice switched off',
      data: wallet,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/wallets/held-parties
// @desc    Every party wallet currently on hold, with the wallet it belongs to
// @access  Admin
router.get('/held-parties', protect, authorize('admin'), async (req, res) => {
  try {
    const heldWalletIds = (await Wallet.find({ isHold: true }).select('_id').lean())
      .map((w) => w._id);

    const monthlyWallets = await MonthlyWallet.find({
      $or: [{ isHold: true }, { wallet: { $in: heldWalletIds } }],
    })
      .populate('vendor', 'companyName accountNumber mobileNumber status')
      .populate('wallet', 'name isHold holdReason')
      .lean();

    const data = monthlyWallets
      .filter((mw) => mw.vendor)
      .map((mw) => ({
        monthlyWalletId: mw._id,
        partyCode: mw.vendor.accountNumber,
        partyName: mw.vendor.companyName,
        mobileNumber: mw.vendor.mobileNumber,
        partyStatus: mw.vendor.status,
        walletName: mw.wallet?.name || mw.label || '—',
        balance: mw.balance || 0,
        holdType: mw.isHold ? 'Party wallet' : 'Whole scheme',
        holdReason: mw.isHold ? mw.holdReason : mw.wallet?.holdReason || null,
      }))
      .sort((a, b) => b.balance - a.balance);

    res.status(200).json({
      success: true,
      count: data.length,
      totalBalance: parseFloat(data.reduce((s, d) => s + d.balance, 0).toFixed(2)),
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/wallets/blocked-parties
// @desc    Every blocked party and the balance they are sitting on
// @access  Admin
router.get('/blocked-parties', protect, authorize('admin'), async (req, res) => {
  try {
    const blocked = await Vendor.find({ status: 'blocked' })
      .select('_id companyName accountNumber mobileNumber blockReason partyCity')
      .populate('division', 'name')
      .lean();

    const wallets = await MonthlyWallet.find({ vendor: { $in: blocked.map((v) => v._id) } })
      .select('vendor balance label')
      .lean();

    const byVendor = new Map();
    for (const mw of wallets) {
      const k = String(mw.vendor);
      if (!byVendor.has(k)) byVendor.set(k, { total: 0, wallets: [] });
      const e = byVendor.get(k);
      e.total += mw.balance || 0;
      if ((mw.balance || 0) !== 0) e.wallets.push({ label: mw.label, balance: mw.balance });
    }

    const data = blocked
      .map((v) => {
        const e = byVendor.get(String(v._id)) || { total: 0, wallets: [] };
        return {
          vendorId: v._id,
          partyCode: v.accountNumber,
          partyName: v.companyName,
          mobileNumber: v.mobileNumber,
          partyCity: v.partyCity,
          location: v.division?.name || '—',
          blockReason: v.blockReason || '—',
          balance: parseFloat(e.total.toFixed(2)),
          wallets: e.wallets,
        };
      })
      .sort((a, b) => b.balance - a.balance);

    res.status(200).json({
      success: true,
      count: data.length,
      totalBalance: parseFloat(data.reduce((s, d) => s + d.balance, 0).toFixed(2)),
      data,
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

// ═════════════════════════════════════════════════════════════════════════════
// CORRECT A NEGATIVE WALLET
//
// A bug over-deducted from some wallets, leaving them negative. The money was
// taken from the wrong month — it should have come from a later one.
//
// This moves the shortfall: the negative wallet is brought back to zero, and
// the same amount is taken from the wallet it should have come from.
//
// The party's TOTAL balance does not change. Only which month it came from.
//
// Like a reassignment, this is never a silent edit — two visible transactions
// are written so the party statement explains itself.
// ═════════════════════════════════════════════════════════════════════════════

// @route   GET /api/wallets/negative-wallets
// @desc    Every wallet sitting below zero, with the party's other wallets
// @access  Admin
router.get('/negative-wallets', protect, authorize('admin'), async (req, res) => {
  try {
    const negatives = await MonthlyWallet.find({ balance: { $lt: 0 } })
      .populate('vendor', 'companyName accountNumber walletBalance status')
      .lean();

    const rows = [];
    for (const neg of negatives) {
      if (!neg.vendor) continue;

      // The party's other wallets — where the money should have come from
      const others = await MonthlyWallet.find({
        vendor: neg.vendor._id,
        _id: { $ne: neg._id },
      })
        .sort({ year: 1, month: 1 })
        .lean();

      const parents = await Wallet.find({
        _id: { $in: others.map((o) => o.wallet).filter(Boolean) },
      }).select('_id name isHold').lean();
      const parentById = new Map(parents.map((w) => [String(w._id), w]));

      rows.push({
        monthlyWalletId: neg._id,
        partyCode: neg.vendor.accountNumber,
        partyName: neg.vendor.companyName,
        partyStatus: neg.vendor.status,
        masterBalance: parseFloat((neg.vendor.walletBalance || 0).toFixed(2)),
        wallet: neg.label,
        balance: parseFloat((neg.balance || 0).toFixed(2)),
        shortfall: parseFloat(Math.abs(neg.balance || 0).toFixed(2)),
        creditedAmount: parseFloat((neg.creditedAmount || 0).toFixed(2)),
        candidates: others.map((o) => {
          const parent = o.wallet ? parentById.get(String(o.wallet)) : null;
          return {
            monthlyWalletId: o._id,
            label: parent?.name || o.label || '',
            balance: parseFloat((o.balance || 0).toFixed(2)),
            isHold: !!(o.isHold || parent?.isHold),
            canCover: (o.balance || 0) >= Math.abs(neg.balance || 0),
          };
        }),
      });
    }

    res.status(200).json({
      success: true,
      count: rows.length,
      totalShortfall: parseFloat(rows.reduce((a, r) => a + r.shortfall, 0).toFixed(2)),
      rows: rows.sort((a, b) => b.shortfall - a.shortfall),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/wallets/correct-negative
// @desc    Move a wallet's shortfall to the wallet it should have come from
// @access  Admin
router.patch('/correct-negative', protect, authorize('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { fromMonthlyWalletId, toMonthlyWalletId, reason } = req.body;

    if (!reason?.trim() || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'A reason of at least 10 characters is required — this is recorded.',
      });
    }
    if (!fromMonthlyWalletId || !toMonthlyWalletId) {
      return res.status(400).json({ success: false, message: 'Choose both wallets' });
    }

    const negative = await MonthlyWallet.findById(fromMonthlyWalletId)
      .populate('vendor', 'companyName accountNumber');
    if (!negative) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    if ((negative.balance || 0) >= 0) {
      return res.status(400).json({
        success: false,
        message: 'That wallet is not negative — nothing to correct',
      });
    }

    const shortfall = parseFloat(Math.abs(negative.balance).toFixed(2));

    const target = await MonthlyWallet.findById(toMonthlyWalletId);
    if (!target) return res.status(404).json({ success: false, message: 'Target wallet not found' });
    if (String(target.vendor) !== String(negative.vendor._id)) {
      return res.status(400).json({
        success: false,
        message: 'That wallet belongs to a different party',
      });
    }

    let fromLabel, toLabel;

    try {
      await session.withTransaction(async () => {
        // Bring the negative wallet back to zero
        const from = await MonthlyWallet.findByIdAndUpdate(
          fromMonthlyWalletId,
          { $inc: { balance: shortfall } },
          { new: true, session }
        );
        fromLabel = from.label;

        // Take it from where it should have come from — atomic, so this
        // cannot simply move the problem to another wallet
        const to = await MonthlyWallet.findOneAndUpdate(
          { _id: toMonthlyWalletId, balance: { $gte: shortfall } },
          { $inc: { balance: -shortfall } },
          { new: true, session }
        );
        if (!to) {
          throw new Error(
            `${target.label} does not hold ₹${shortfall.toFixed(2)}. ` +
            'Nothing has been changed — moving it there would only create a ' +
            'second negative wallet.'
          );
        }
        toLabel = to.label;

        const stamp = new Date().toLocaleDateString('en-IN');
        await WalletTransaction.create([
          {
            vendor: negative.vendor._id,
            type: 'credit',
            amount: shortfall,
            balanceAfter: null,
            description: `Correction — over-deduction of ₹${shortfall} returned to ${fromLabel} on ${stamp}`,
            processedBy: req.user._id,
            monthlyWallet: from._id,
            walletLabel: fromLabel,
            isReassignment: true,
          },
          {
            vendor: negative.vendor._id,
            type: 'debit',
            amount: shortfall,
            balanceAfter: null,
            description: `Correction — ₹${shortfall} moved from ${fromLabel} to ${toLabel} on ${stamp}`,
            processedBy: req.user._id,
            monthlyWallet: to._id,
            walletLabel: toLabel,
            isReassignment: true,
          },
        ], { session, ordered: true });
      });
    } catch (txErr) {
      await session.endSession();
      console.error('[correct-negative] rolled back —', txErr.message);
      return res.status(409).json({ success: false, message: txErr.message });
    }
    await session.endSession();

    audit({
      vendor: negative.vendor, eventType: 'reconciliation.adjusted',
      actor: req.user, source: 'admin',
      amount: shortfall, walletLabel: `${fromLabel} → ${toLabel}`,
      reason: reason.trim(),
      changes: [{ field: 'shortfallMovedFrom', from: fromLabel, to: toLabel }],
      summary: `Corrected ₹${shortfall.toFixed(2)} over-deduction — moved from ${fromLabel} to ${toLabel}`,
    });

    console.warn(
      `[CORRECTION] ${req.user.name} moved ₹${shortfall} from ${fromLabel} to ${toLabel} ` +
      `for ${negative.vendor.accountNumber}. Reason: ${reason.trim()}`
    );

    res.status(200).json({
      success: true,
      message: `Moved ₹${shortfall.toFixed(2)} from ${fromLabel} to ${toLabel}`,
      data: { shortfall, fromWallet: fromLabel, toWallet: toLabel },
    });
  } catch (error) {
    console.error('[correct-negative]', error);
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
