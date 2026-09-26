/**
 * Which wallets an invoice was paid from, and how much from each.
 *
 * The invoice itself does not store this — every wallet deduction is its own
 * WalletTransaction (type 'debit', linked to the invoice). When a redemption
 * is later moved to another wallet (reassignment), a 'credit' reversal and a
 * new 'debit' are added, also linked to the invoice.
 *
 * So the amount taken from each wallet is:   debits − reversal credits
 * and the invoice total redeemed is the sum of those.
 */
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const WalletTransaction = require('../models/WalletTransaction');

const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

/**
 * @param {Array} invoiceIds
 * @returns {Map<string, {total:number, wallets:[{walletId,label,amount}]}>}
 */
async function getInvoiceWalletBreakdown(invoiceIds) {
  const result = new Map();
  if (!invoiceIds || invoiceIds.length === 0) return result;

  const txns = await WalletTransaction.find({ invoice: { $in: invoiceIds } })
    .select('invoice type amount monthlyWallet walletLabel createdAt')
    .sort({ createdAt: 1 })
    .lean();

  // Current names — a wallet may have been renamed since the redemption
  const mwIds = [...new Set(txns.map((t) => t.monthlyWallet).filter(Boolean).map(String))];
  const mws = mwIds.length
    ? await MonthlyWallet.find({ _id: { $in: mwIds } }).select('_id label wallet').lean()
    : [];
  const parentIds = [...new Set(mws.map((m) => m.wallet).filter(Boolean).map(String))];
  const parents = parentIds.length
    ? await Wallet.find({ _id: { $in: parentIds } }).select('_id name').lean()
    : [];
  const parentName = new Map(parents.map((w) => [String(w._id), w.name]));
  const mwInfo = new Map(
    mws.map((m) => [String(m._id), {
      walletId: m.wallet ? String(m.wallet) : null,
      label: (m.wallet && parentName.get(String(m.wallet))) || m.label,
    }])
  );

  const perInvoice = new Map(); // invoiceId -> Map(key -> {walletId,label,amount})
  for (const t of txns) {
    const inv = String(t.invoice);
    if (!perInvoice.has(inv)) perInvoice.set(inv, new Map());
    const buckets = perInvoice.get(inv);

    const info = t.monthlyWallet ? mwInfo.get(String(t.monthlyWallet)) : null;
    const label = info?.label || t.walletLabel || 'Unassigned (old entry)';
    const key = info?.walletId ? `w:${info.walletId}` : `l:${label}`;

    if (!buckets.has(key)) buckets.set(key, { walletId: info?.walletId || null, label, amount: 0 });
    const b = buckets.get(key);
    b.amount += t.type === 'debit' ? (t.amount || 0) : -(t.amount || 0);
  }

  for (const [inv, buckets] of perInvoice) {
    const wallets = [...buckets.values()]
      .map((b) => ({ ...b, amount: round2(b.amount) }))
      .filter((b) => Math.abs(b.amount) >= 0.01);
    result.set(inv, { total: round2(wallets.reduce((a, b) => a + b.amount, 0)), wallets });
  }
  return result;
}

/** "July 2026 MSGP: ₹1,500.00 | Aug 2026 MSGA: ₹500.00" — for exports. */
function formatBreakdown(wallets, { currency = '₹' } = {}) {
  if (!wallets || wallets.length === 0) return '—';
  return wallets
    .map((w) => `${w.label}: ${currency}${Number(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(' | ');
}

/**
 * Invoice ids that drew money from a given master wallet (net of any
 * reassignment away from it).
 */
async function invoiceIdsForWallet(walletId) {
  if (!mongoose.isValidObjectId(walletId)) return [];
  const wallet = await Wallet.findById(walletId).select('_id name').lean();
  if (!wallet) return [];

  const mwIds = (
    await MonthlyWallet.find({ $or: [{ wallet: wallet._id }, { label: wallet.name }] }).select('_id').lean()
  ).map((m) => m._id);

  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        invoice: { $ne: null },
        $or: [
          { monthlyWallet: { $in: mwIds } },
          // Older entries that were never linked to a month wallet
          { monthlyWallet: null, walletLabel: wallet.name },
        ],
      },
    },
    {
      $group: {
        _id: '$invoice',
        net: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', { $multiply: ['$amount', -1] }] } },
      },
    },
    { $match: { net: { $gt: 0.005 } } },
  ]);
  return rows.map((r) => r._id);
}

module.exports = { getInvoiceWalletBreakdown, formatBreakdown, invoiceIdsForWallet };
