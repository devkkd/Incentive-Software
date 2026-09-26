/**
 * Party code cleanup + duplicate party merge.
 *
 * 1. Code cleanup — every party code has its branch prefixes stripped
 *    ("WSG-WSG-123123" → "123123"). Only parties whose cleaned code is unique
 *    are renamed; clashes are left untouched and reported as duplicates.
 *
 * 2. Merge — combines duplicate accounts into the one that is kept:
 *      • month/scheme balances are added together (same scheme + month)
 *      • invoices and wallet transactions move to the kept account
 *      • upload history is re-pointed
 *      • the kept account keeps its own mobile number, branch and status
 *      • the merged account is archived in DeletedParty (with "merged into")
 *        and removed, so it no longer appears anywhere
 *    Everything happens in one database transaction — it completes fully or
 *    not at all.
 */
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const Invoice = require('../models/Invoice');
const MonthlyWallet = require('../models/MonthlyWallet');
const WalletTransaction = require('../models/WalletTransaction');
const IncentiveUpload = require('../models/IncentiveUpload');
const DeletedParty = require('../models/DeletedParty');
const { audit } = require('./audit');
const { getDivisionNames, stripPrefixes, findCodeConflict } = require('./partyCode');

const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

/** Activity figures per party, used to suggest which account to keep. */
async function partyStats(vendorIds) {
  const [inv, txn] = await Promise.all([
    Invoice.aggregate([
      { $match: { vendor: { $in: vendorIds } } },
      { $group: { _id: '$vendor', invoiceCount: { $sum: 1 }, lastInvoiceAt: { $max: '$createdAt' } } },
    ]),
    WalletTransaction.aggregate([
      { $match: { vendor: { $in: vendorIds } } },
      {
        $group: {
          _id: '$vendor',
          lastActivityAt: { $max: '$createdAt' },
          lastRedemptionAt: { $max: { $cond: [{ $eq: ['$type', 'debit'] }, '$createdAt', null] } },
          totalCredited: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
          totalDebited: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
        },
      },
    ]),
  ]);
  const map = new Map();
  for (const id of vendorIds) map.set(String(id), {});
  inv.forEach((r) => Object.assign(map.get(String(r._id)) || {}, r));
  txn.forEach((r) => Object.assign(map.get(String(r._id)) || {}, r));
  return map;
}

/** Pick the account "where transactions are happening". */
function suggestKeep(parties) {
  const t = (d) => (d ? new Date(d).getTime() : 0);
  return [...parties].sort((a, b) =>
    t(b.lastRedemptionAt) - t(a.lastRedemptionAt) ||
    (b.invoiceCount || 0) - (a.invoiceCount || 0) ||
    t(b.lastActivityAt) - t(a.lastActivityAt) ||
    (b.walletBalance || 0) - (a.walletBalance || 0) ||
    t(a.createdAt) - t(b.createdAt)
  )[0];
}

/**
 * Preview: which codes would be cleaned, and which parties are duplicates.
 * Writes nothing.
 */
async function buildCodeReport() {
  const names = await getDivisionNames();
  const vendors = await Vendor.find()
    .select('_id accountNumber companyName personName mobileNumber partyCity status walletBalance division createdAt')
    .populate('division', 'name location')
    .lean();

  const groups = new Map();
  for (const v of vendors) {
    const clean = stripPrefixes(v.accountNumber, names);
    if (!groups.has(clean)) groups.set(clean, []);
    groups.get(clean).push({ ...v, cleanCode: clean });
  }

  const renames = [];
  const dupGroups = [];
  for (const [code, list] of groups) {
    if (list.length === 1) {
      const v = list[0];
      if (v.accountNumber !== code) {
        renames.push({
          vendorId: v._id, from: v.accountNumber, to: code,
          companyName: v.companyName, branch: v.division?.name || '',
        });
      }
    } else {
      dupGroups.push({ code, list });
    }
  }

  // Activity stats only for the duplicate parties
  const dupIds = dupGroups.flatMap((g) => g.list.map((v) => v._id));
  const stats = dupIds.length ? await partyStats(dupIds) : new Map();

  const duplicates = dupGroups
    .map(({ code, list }) => {
      const parties = list.map((v) => {
        const s = stats.get(String(v._id)) || {};
        return {
          vendorId: v._id,
          accountNumber: v.accountNumber,
          companyName: v.companyName,
          mobileNumber: v.mobileNumber,
          partyCity: v.partyCity,
          status: v.status,
          branch: v.division?.name || '',
          walletBalance: round2(v.walletBalance),
          invoiceCount: s.invoiceCount || 0,
          lastInvoiceAt: s.lastInvoiceAt || null,
          lastRedemptionAt: s.lastRedemptionAt || null,
          lastActivityAt: s.lastActivityAt || null,
          totalCredited: round2(s.totalCredited),
          totalRedeemed: round2(s.totalDebited),
          createdAt: v.createdAt,
        };
      });
      const keep = suggestKeep(parties);
      return {
        code,
        parties,
        suggestedKeepId: keep.vendorId,
        combinedBalance: round2(parties.reduce((a, p) => a + p.walletBalance, 0)),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    totalParties: vendors.length,
    renames: renames.sort((a, b) => a.to.localeCompare(b.to)),
    duplicates,
  };
}

/**
 * Rename every party whose cleaned code is unique. Duplicates are skipped —
 * they get their clean code when they are merged.
 */
async function applyCodeCleanup(actor = null) {
  const { renames, duplicates } = await buildCodeReport();
  let renamed = 0;
  const skipped = [];

  for (const r of renames) {
    // Re-check at write time — something may have changed since the preview
    const conflict = await findCodeConflict(r.to, r.vendorId);
    if (conflict) { skipped.push({ ...r, reason: `Clashes with ${conflict.accountNumber}` }); continue; }

    const res = await Vendor.updateOne({ _id: r.vendorId, accountNumber: r.from }, { $set: { accountNumber: r.to } });
    if (res.modifiedCount === 1) {
      renamed++;
      audit({
        vendorId: r.vendorId, partyCode: r.to, partyName: r.companyName,
        eventType: 'party.codeCleaned', actor, source: actor ? 'admin' : 'system',
        changes: [{ field: 'accountNumber', from: r.from, to: r.to }],
        summary: `Party code cleaned: ${r.from} → ${r.to}`,
      });
    } else {
      skipped.push({ ...r, reason: 'Changed since preview' });
    }
  }

  return { renamed, skipped, duplicatesRemaining: duplicates.length };
}

/**
 * Merge mergeIds into keepId.
 */
async function mergeParties({ keepId, mergeIds, actor = null, reason = null }) {
  const ids = [...new Set((mergeIds || []).map(String))].filter((id) => id !== String(keepId));
  if (!keepId || ids.length === 0) throw new Error('Choose the account to keep and at least one account to merge into it');
  if (![keepId, ...ids].every((id) => mongoose.isValidObjectId(id))) throw new Error('Invalid party id');

  const session = await mongoose.startSession();
  const summary = { moved: [], keep: null };

  try {
    await session.withTransaction(async () => {
      summary.moved = [];
      const keep = await Vendor.findById(keepId).session(session);
      if (!keep) throw new Error('Account to keep was not found');

      let lastRedemptionDate = keep.lastRedemptionDate;
      let lastRedemptionAmount = keep.lastRedemptionAmount;

      for (const mid of ids) {
        const m = await Vendor.findById(mid).populate('division', 'name').session(session);
        if (!m) throw new Error(`Party ${mid} was not found — it may already have been merged`);

        const info = {
          vendorId: m._id, accountNumber: m.accountNumber, companyName: m.companyName,
          balance: round2(m.walletBalance), walletsCombined: 0, walletsMoved: 0,
          invoices: 0, transactions: 0,
        };

        // 1. Month / scheme wallets
        const mws = await MonthlyWallet.find({ vendor: m._id }).session(session);
        for (const mw of mws) {
          const target = await MonthlyWallet.findOne({
            vendor: keep._id, month: mw.month, year: mw.year, wallet: mw.wallet || null,
          }).session(session);

          if (target) {
            target.balance = round2((target.balance || 0) + (mw.balance || 0));
            target.creditedAmount = round2((target.creditedAmount || 0) + (mw.creditedAmount || 0));
            if (mw.isHold && !target.isHold) {
              target.isHold = true;
              target.holdReason = mw.holdReason || 'Held on merged account';
            }
            await target.save({ session });
            await WalletTransaction.updateMany(
              { monthlyWallet: mw._id }, { $set: { monthlyWallet: target._id } }, { session }
            );
            await MonthlyWallet.deleteOne({ _id: mw._id }, { session });
            info.walletsCombined++;
          } else {
            await MonthlyWallet.updateOne({ _id: mw._id }, { $set: { vendor: keep._id } }, { session });
            info.walletsMoved++;
          }
        }

        // 2. Ledger + invoices
        info.transactions = (await WalletTransaction.updateMany(
          { vendor: m._id }, { $set: { vendor: keep._id } }, { session }
        )).modifiedCount;
        info.invoices = (await Invoice.updateMany(
          { vendor: m._id }, { $set: { vendor: keep._id } }, { session }
        )).modifiedCount;

        // 3. Upload history
        await IncentiveUpload.updateMany(
          { 'items.vendor': m._id },
          { $set: { 'items.$[it].vendor': keep._id } },
          { arrayFilters: [{ 'it.vendor': m._id }], session }
        );

        // 4. Balance
        keep.walletBalance = round2((keep.walletBalance || 0) + (m.walletBalance || 0));
        if (m.lastRedemptionDate && (!lastRedemptionDate || m.lastRedemptionDate > lastRedemptionDate)) {
          lastRedemptionDate = m.lastRedemptionDate;
          lastRedemptionAmount = m.lastRedemptionAmount;
        }

        // 5. Archive who they were, then remove the duplicate
        await DeletedParty.create([{
          vendorId: m._id,
          accountNumber: m.accountNumber,
          companyName: m.companyName,
          personName: m.personName,
          mobileNumber: m.mobileNumber,
          partyCity: m.partyCity,
          partyType: m.partyType,
          salesPerson: m.salesPerson,
          divisionName: m.division?.name || null,
          status: m.status,
          walletBalanceAtDeletion: m.walletBalance || 0,
          deletedBy: actor?._id || null,
          deletedByName: actor?.name || null,
          deletionReason: `Merged into ${keep.accountNumber} (${keep.companyName})${reason ? ` — ${reason}` : ''}`,
          mergedIntoVendorId: keep._id,
          mergedIntoCode: keep.accountNumber,
          mergedIntoName: keep.companyName,
        }], { session });
        await Vendor.deleteOne({ _id: m._id }, { session });

        summary.moved.push(info);
      }

      keep.lastRedemptionDate = lastRedemptionDate;
      keep.lastRedemptionAmount = lastRedemptionAmount;
      await keep.save({ session });
    });
  } finally {
    await session.endSession();
  }

  // After the merge: give the kept account its clean code, if nothing else uses it
  const keep = await Vendor.findById(keepId);
  const names = await getDivisionNames();
  const clean = stripPrefixes(keep.accountNumber, names);
  let codeChange = null;
  if (clean !== keep.accountNumber && !(await findCodeConflict(clean, keep._id))) {
    codeChange = { from: keep.accountNumber, to: clean };
    keep.accountNumber = clean;
    await keep.save();
  }

  const totalMoved = round2(summary.moved.reduce((a, m) => a + m.balance, 0));
  audit({
    vendor: keep, eventType: 'party.merged', actor, source: actor ? 'admin' : 'system',
    amount: totalMoved, balanceAfter: round2(keep.walletBalance), reason,
    changes: codeChange ? [{ field: 'accountNumber', ...codeChange }] : [],
    summary: `Merged ${summary.moved.map((m) => m.accountNumber).join(', ')} into this account — ` +
      `₹${totalMoved.toFixed(2)} balance, ${summary.moved.reduce((a, m) => a + m.invoices, 0)} invoices moved`,
  });
  for (const m of summary.moved) {
    audit({
      vendorId: m.vendorId, partyCode: m.accountNumber, partyName: m.companyName,
      eventType: 'party.merged', actor, source: actor ? 'admin' : 'system',
      amount: m.balance, reason,
      summary: `Merged into ${keep.accountNumber} (${keep.companyName}); account removed`,
    });
  }

  return {
    keep: { vendorId: keep._id, accountNumber: keep.accountNumber, companyName: keep.companyName, walletBalance: round2(keep.walletBalance) },
    merged: summary.moved,
    codeChange,
  };
}

module.exports = { buildCodeReport, applyCodeCleanup, mergeParties, suggestKeep };
