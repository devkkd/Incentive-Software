/**
 * Groups a party's wallet transactions so each invoice appears ONCE.
 *
 * A redemption split across wallets is stored as one debit per wallet, and a
 * later wallet change (reassignment) adds a reversal credit + a new debit, all
 * linked to the same invoice. Shown raw, that is several rows repeating the
 * same invoice number and invoice amount.
 *
 * Input:  transactions as returned by GET /api/vendors/:id/transactions
 *         (newest first, balanceAfter = running balance)
 * Output: rows, newest first. Invoice rows look like:
 *   { kind: 'redemption', _id, createdAt, invoice, amount, wallets: [{label, amount}], balanceAfter }
 * Credits not tied to an invoice are passed through as:
 *   { kind: 'credit' | 'debit', ...originalTransaction, wallets: [{label, amount}] }
 */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function walletNameOf(trx) {
  return trx.walletName || trx.walletLabel || 'Unassigned (old entry)';
}

export function groupLedgerByInvoice(transactions = []) {
  const chronological = [...transactions].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const groups = new Map();
  const rows = [];

  for (const t of chronological) {
    const invId = t.invoice?._id || (typeof t.invoice === 'string' ? t.invoice : null);
    if (!invId) {
      rows.push({
        kind: t.type,
        ...t,
        wallets: [{ label: walletNameOf(t), amount: r2(t.amount) }],
      });
      continue;
    }

    let g = groups.get(String(invId));
    if (!g) {
      g = {
        kind: 'redemption',
        _id: `inv-${invId}`,
        createdAt: t.createdAt,
        invoice: t.invoice,
        amount: 0,
        buckets: new Map(),
        balanceAfter: t.balanceAfter,
        reassigned: false,
        location: t.location,
      };
      groups.set(String(invId), g);
      rows.push(g);
    }

    const label = walletNameOf(t);
    const signed = t.type === 'debit' ? (t.amount || 0) : -(t.amount || 0);
    g.buckets.set(label, (g.buckets.get(label) || 0) + signed);
    g.amount += signed;
    if (t.isReassignment) g.reassigned = true;
    // Balance after the original redemption — reassignments net to zero and
    // happen later, so they must not move this row's closing balance.
    if (!t.isReassignment) g.balanceAfter = t.balanceAfter;
  }

  for (const g of groups.values()) {
    g.amount = r2(g.amount);
    g.wallets = [...g.buckets.entries()]
      .map(([label, amount]) => ({ label, amount: r2(amount) }))
      .filter((w) => Math.abs(w.amount) >= 0.01);
    delete g.buckets;
  }

  return rows.reverse();
}

/**
 * Party statement rows — one row per invoice (with its wallets), one per
 * incentive credit. Replaces the old "Invoice / Bill" row + one "Wallet
 * Redemption" row per wallet, which repeated the invoice amount on every row.
 *
 * Each row: { _id, date, type, particulars, invoiceNo, invoiceAmount, debit,
 *             credit, wallets, walletsText, division, location, balanceAfter, isCredit }
 */
export function buildStatementRows({ invoices = [], transactions = [], vendor = null, sanitize = (s) => String(s || '') }) {
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const walletsText = (ws) => (ws && ws.length ? ws.map((w) => `${w.label}: Rs. ${fmt(w.amount)}`).join(' | ') : '—');

  const grouped = groupLedgerByInvoice(transactions);
  const coveredInvoiceIds = new Set(
    grouped.filter((g) => g.kind === 'redemption').map((g) => String(g.invoice?._id || g.invoice))
  );

  const rows = grouped.map((g) => {
    if (g.kind === 'redemption') {
      const inv = g.invoice || {};
      return {
        _id: g._id,
        date: new Date(g.createdAt),
        type: 'Wallet Redemption',
        particulars: inv.referenceNo ? `Ref: ${inv.referenceNo}` : 'Wallet Redeemed',
        invoiceNo: inv.invoiceNumber ? sanitize(inv.invoiceNumber) : null,
        invoiceAmount: inv.invoiceAmount ?? null,
        debit: g.amount,
        credit: null,
        wallets: g.wallets,
        walletsText: walletsText(g.wallets),
        reassigned: g.reassigned,
        division: inv.division?.name || vendor?.division?.name || '—',
        location: inv.location || '—',
        balanceAfter: g.balanceAfter,
        isCredit: false,
      };
    }
    const isCredit = g.kind === 'credit';
    return {
      _id: g._id,
      date: new Date(g.createdAt),
      type: isCredit
        ? (/^Refund /.test(g.description || '') ? 'Refund (Invoice Deleted)' : 'Incentive Credited')
        : 'Wallet Redemption',
      particulars: sanitize(g.description || (isCredit ? 'Incentive Credited' : 'Wallet Redeemed')),
      invoiceNo: null,
      invoiceAmount: null,
      debit: isCredit ? null : g.amount,
      credit: isCredit ? g.amount : null,
      wallets: g.wallets,
      walletsText: walletsText(g.wallets),
      division: vendor?.division?.name || '—',
      location: '—',
      balanceAfter: g.balanceAfter,
      isCredit,
    };
  });

  // Invoices with no wallet entries at all (very old records) still appear
  invoices
    .filter((inv) => !coveredInvoiceIds.has(String(inv._id)))
    .forEach((inv) => {
      rows.push({
        _id: inv._id,
        date: new Date(inv.invoiceDate),
        type: 'Invoice / Bill',
        particulars: inv.referenceNo ? `Ref: ${inv.referenceNo}` : '—',
        invoiceNo: sanitize(inv.invoiceNumber),
        invoiceAmount: inv.invoiceAmount,
        debit: null,
        credit: null,
        wallets: [],
        walletsText: '—',
        division: inv.division?.name || vendor?.division?.name || '—',
        location: inv.location || '—',
        balanceAfter: '—',
        isCredit: null,
      });
    });

  rows.sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
    if (a.type === 'Invoice / Bill' && b.type !== 'Invoice / Bill') return -1;
    if (a.type !== 'Invoice / Bill' && b.type === 'Invoice / Bill') return 1;
    return 0;
  });

  // Rows without a balance carry forward the last known one
  let last = null;
  return rows.map((row) => {
    if (row.balanceAfter != null && row.balanceAfter !== '—') {
      last = Number(row.balanceAfter);
      return row;
    }
    return { ...row, balanceAfter: last };
  });
}
