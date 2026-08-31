const express = require('express');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const WalletTransaction = require('../models/WalletTransaction');
const Invoice = require('../models/Invoice');
const IncentiveUpload = require('../models/IncentiveUpload');
const DeletedParty = require('../models/DeletedParty');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * POINT 20.9 — EXCEPTION REPORT
 *
 * Everything in the data that should not exist.
 *
 * READ ONLY. This route performs no writes of any kind. It is safe to run
 * against production at any time, including during trading hours.
 *
 * Build this before the other reports: it measures the health of the data
 * every other report depends on. A liability ageing report built on drifted
 * data gives precise, confident, wrong answers.
 */

const round = (n) => parseFloat((n || 0).toFixed(2));
const sum = (arr, f) => round(arr.reduce((a, c) => a + (c[f] || 0), 0));

// @route   GET /api/exceptions
// @desc    Every data integrity problem, with counts and values
// @access  Admin only
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const startedAt = new Date();

    // ── Every party that still exists ────────────────────────────────────────
    const liveVendorIds = new Set(
      (await Vendor.find().select('_id').lean()).map((v) => String(v._id))
    );

    // ── 1. NEGATIVE BALANCES ────────────────────────────────────────────────
    // A wallet below zero means it has been deducted more than it held.
    const negativeWallets = await MonthlyWallet.find({ balance: { $lt: 0 } })
      .populate('vendor', 'companyName accountNumber')
      .lean();

    const negativeBalances = {
      count: negativeWallets.length,
      value: sum(negativeWallets, 'balance'),
      rows: negativeWallets.map((mw) => ({
        partyCode: mw.vendor?.accountNumber || '(party deleted)',
        partyName: mw.vendor?.companyName || '(party deleted)',
        wallet: mw.label,
        balance: round(mw.balance),
        creditedAmount: round(mw.creditedAmount),
      })),
    };

    // ── 2. DELETED PARTIES ──────────────────────────────────────────────────
    // Deletion keeps no record, so the party's name cannot be recovered.
    // What can be recovered is everything that still points at them.
    const orphanWallets = (
      await MonthlyWallet.find().select('vendor balance creditedAmount label').lean()
    ).filter((mw) => !mw.vendor || !liveVendorIds.has(String(mw.vendor)));

    const orphanTxns = (
      await WalletTransaction.find().select('vendor amount type createdAt').lean()
    ).filter((wt) => !wt.vendor || !liveVendorIds.has(String(wt.vendor)));

    const orphanInvoices = (
      await Invoice.find().select('vendor invoiceAmount redeemedAmount invoiceNumber createdAt').lean()
    ).filter((inv) => !inv.vendor || !liveVendorIds.has(String(inv.vendor)));

    // Group everything by the missing party so each deleted party is one row
    const deletedMap = new Map();
    const touch = (id) => {
      const k = String(id);
      if (!deletedMap.has(k)) {
        deletedMap.set(k, {
          vendorId: k,
          walletCount: 0, walletBalance: 0, creditedTotal: 0, wallets: [],
          txnCount: 0, invoiceCount: 0, invoiceValue: 0, redeemedValue: 0,
          lastActivity: null,
        });
      }
      return deletedMap.get(k);
    };

    for (const mw of orphanWallets) {
      if (!mw.vendor) continue;
      const e = touch(mw.vendor);
      e.walletCount += 1;
      e.walletBalance += mw.balance || 0;
      e.creditedTotal += mw.creditedAmount || 0;
      if (mw.label) e.wallets.push(mw.label);
    }
    for (const wt of orphanTxns) {
      if (!wt.vendor) continue;
      const e = touch(wt.vendor);
      e.txnCount += 1;
      const d = new Date(wt.createdAt);
      if (!e.lastActivity || d > e.lastActivity) e.lastActivity = d;
    }
    for (const inv of orphanInvoices) {
      if (!inv.vendor) continue;
      const e = touch(inv.vendor);
      e.invoiceCount += 1;
      e.invoiceValue += inv.invoiceAmount || 0;
      e.redeemedValue += inv.redeemedAmount || 0;
      const d = new Date(inv.createdAt);
      if (!e.lastActivity || d > e.lastActivity) e.lastActivity = d;
    }

    // Attach identity where we have it. Parties deleted since the DeletedParty
    // record was introduced can be named; older ones cannot.
    const deletedRecords = await DeletedParty.find({
      vendorId: { $in: [...deletedMap.keys()].map((k) => new mongoose.Types.ObjectId(k)) },
    }).lean();
    const identityMap = new Map(deletedRecords.map((d) => [String(d.vendorId), d]));

    const unnamed = [...deletedMap.keys()].filter((k) => !identityMap.has(k)).length;

    const deletedParties = {
      count: deletedMap.size,
      value: round([...deletedMap.values()].reduce((a, e) => a + e.walletBalance, 0)),
      note:
        unnamed > 0
          ? `${unnamed} of these were deleted before party details were being recorded, ` +
            'so their code and name cannot be recovered. Parties deleted from now on will be named.'
          : null,
      rows: [...deletedMap.values()]
        .map((e) => {
          const id = identityMap.get(e.vendorId);
          return {
          partyCode: id?.accountNumber || '(not recorded)',
          partyName: id?.companyName || '(not recorded)',
          mobileNumber: id?.mobileNumber || null,
          location: id?.divisionName || null,
          deletedOn: id?.createdAt || null,
          deletedBy: id?.deletedByName || null,
          ...e,
          walletBalance: round(e.walletBalance),
          creditedTotal: round(e.creditedTotal),
          invoiceValue: round(e.invoiceValue),
          redeemedValue: round(e.redeemedValue),
          wallets: [...new Set(e.wallets)].join(', '),
          };
        })
        .sort((a, b) => b.walletBalance - a.walletBalance),
    };

    // ── 3. LEDGER MISMATCHES ────────────────────────────────────────────────
    // The master balance on the party record versus the sum of their month
    // wallets. These are two records of the same money and must agree.
    const allVendors = await Vendor.find().select('_id companyName accountNumber walletBalance status').lean();
    const walletsByVendor = new Map();
    for (const mw of await MonthlyWallet.find().select('vendor balance').lean()) {
      const k = String(mw.vendor);
      walletsByVendor.set(k, (walletsByVendor.get(k) || 0) + (mw.balance || 0));
    }

    const mismatchRows = [];
    for (const v of allVendors) {
      const subTotal = round(walletsByVendor.get(String(v._id)) || 0);
      const master = round(v.walletBalance || 0);
      const gap = round(subTotal - master);
      if (Math.abs(gap) > 0.01) {
        mismatchRows.push({
          partyCode: v.accountNumber,
          partyName: v.companyName,
          status: v.status,
          masterBalance: master,
          subWalletTotal: subTotal,
          gap,
          direction: gap > 0 ? 'Sub-wallets higher' : 'Master higher',
        });
      }
    }

    const ledgerMismatches = {
      count: mismatchRows.length,
      value: round(mismatchRows.reduce((a, r) => a + Math.abs(r.gap), 0)),
      rows: mismatchRows.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)),
    };

    // ── 4. BALANCE EXCEEDS CREDITED ─────────────────────────────────────────
    // A wallet cannot hold more than was ever put into it.
    const overCredited = (
      await MonthlyWallet.find().populate('vendor', 'companyName accountNumber').lean()
    ).filter((mw) => (mw.balance || 0) > (mw.creditedAmount || 0) + 0.01);

    const balanceExceedsCredited = {
      count: overCredited.length,
      value: round(overCredited.reduce((a, mw) => a + ((mw.balance || 0) - (mw.creditedAmount || 0)), 0)),
      rows: overCredited.map((mw) => ({
        partyCode: mw.vendor?.accountNumber || '(party deleted)',
        partyName: mw.vendor?.companyName || '(party deleted)',
        wallet: mw.label,
        creditedAmount: round(mw.creditedAmount),
        balance: round(mw.balance),
        excess: round((mw.balance || 0) - (mw.creditedAmount || 0)),
      })),
    };

    // ── 5. UNATTRIBUTED DEBITS ──────────────────────────────────────────────
    // Redemptions never tied to a month wallet. These cannot be traced to a
    // scheme, so scheme-level figures will not reconcile.
    const looseDebits = await WalletTransaction.find({ type: 'debit', monthlyWallet: null })
      .populate('vendor', 'companyName accountNumber')
      .select('vendor amount createdAt description invoice')
      .sort({ createdAt: -1 })
      .lean();

    const unattributedDebits = {
      count: looseDebits.length,
      value: sum(looseDebits, 'amount'),
      rows: looseDebits.slice(0, 500).map((wt) => ({
        date: wt.createdAt,
        partyCode: wt.vendor?.accountNumber || '(party deleted)',
        partyName: wt.vendor?.companyName || '(party deleted)',
        amount: round(wt.amount),
        description: wt.description || '—',
      })),
    };

    // ── 6. HOLDS WITH NO REASON ─────────────────────────────────────────────
    const heldNoReason = await MonthlyWallet.find({
      isHold: true,
      $or: [{ holdReason: null }, { holdReason: '' }],
    })
      .populate('vendor', 'companyName accountNumber')
      .lean();

    const holdsWithoutReason = {
      count: heldNoReason.length,
      value: sum(heldNoReason, 'balance'),
      rows: heldNoReason.map((mw) => ({
        partyCode: mw.vendor?.accountNumber || '(party deleted)',
        partyName: mw.vendor?.companyName || '(party deleted)',
        wallet: mw.label,
        balance: round(mw.balance),
      })),
    };

    // ── 7. WALLETS WITH NO SCHEME ATTACHED ──────────────────────────────────
    const noScheme = await MonthlyWallet.find({ wallet: null })
      .populate('vendor', 'companyName accountNumber')
      .lean();

    const walletsWithoutScheme = {
      count: noScheme.length,
      value: sum(noScheme, 'balance'),
      rows: noScheme.map((mw) => ({
        partyCode: mw.vendor?.accountNumber || '(party deleted)',
        partyName: mw.vendor?.companyName || '(party deleted)',
        label: mw.label || '(no label)',
        balance: round(mw.balance),
      })),
    };

    // ── 8. DUPLICATE INVOICE NUMBERS ────────────────────────────────────────
    const dupes = await Invoice.aggregate([
      { $group: { _id: '$invoiceNumber', count: { $sum: 1 }, total: { $sum: '$invoiceAmount' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const duplicateInvoices = {
      count: dupes.length,
      value: round(dupes.reduce((a, d) => a + (d.total || 0), 0)),
      rows: dupes.map((d) => ({ invoiceNumber: d._id, occurrences: d.count, totalValue: round(d.total) })),
    };

    // ── 9. UPLOADS THAT NEVER CREATED WALLETS ───────────────────────────────
    const uploads = await IncentiveUpload.find({ 'items.0': { $exists: true } })
      .select('fileName walletLabel month year totalAmount items createdAt')
      .lean();

    const uploadsWithoutWallets = [];
    for (const up of uploads) {
      const vendorIds = up.items.map((i) => i.vendor).filter(Boolean);
      if (!vendorIds.length) continue;
      const existing = await MonthlyWallet.countDocuments({
        vendor: { $in: vendorIds },
        month: up.month,
        year: up.year,
      });
      if (existing === 0) {
        uploadsWithoutWallets.push({
          fileName: up.fileName,
          scheme: up.walletLabel,
          month: up.month,
          year: up.year,
          itemCount: up.items.length,
          totalAmount: round(up.totalAmount),
          uploadedOn: up.createdAt,
        });
      }
    }

    const uploadsNoWallets = {
      count: uploadsWithoutWallets.length,
      value: round(uploadsWithoutWallets.reduce((a, u) => a + u.totalAmount, 0)),
      rows: uploadsWithoutWallets,
    };

    // ── HEADLINE ────────────────────────────────────────────────────────────
    const sections = {
      negativeBalances,
      deletedParties,
      ledgerMismatches,
      balanceExceedsCredited,
      unattributedDebits,
      holdsWithoutReason,
      walletsWithoutScheme,
      duplicateInvoices,
      uploadsNoWallets,
    };

    // Value at risk — deliberately excludes duplicate invoices and holds
    // without reason, which are process problems rather than money adrift.
    const valueAtRisk = round(
      Math.abs(negativeBalances.value) +
        deletedParties.value +
        ledgerMismatches.value +
        balanceExceedsCredited.value +
        unattributedDebits.value +
        uploadsNoWallets.value
    );

    const totalIssues = Object.values(sections).reduce((a, s) => a + s.count, 0);

    res.status(200).json({
      success: true,
      generatedAt: startedAt,
      tookMs: Date.now() - startedAt.getTime(),
      headline: {
        totalIssues,
        valueAtRisk,
        cleanSections: Object.values(sections).filter((s) => s.count === 0).length,
        totalSections: Object.keys(sections).length,
      },
      sections,
    });
  } catch (error) {
    console.error('[exceptions]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
