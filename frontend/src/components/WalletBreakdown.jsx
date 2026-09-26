'use client';

/**
 * Shows which wallets an invoice was paid from, and how much from each.
 * `wallets` = [{ label, amount }]
 */
const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatWalletBreakdown(wallets, { currency = '₹', separator = ' | ' } = {}) {
  if (!wallets || wallets.length === 0) return '—';
  return wallets.map((w) => `${w.label}: ${currency}${fmt(w.amount)}`).join(separator);
}

export default function WalletBreakdown({ wallets, compact = false }) {
  if (!wallets || wallets.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {wallets.map((w, i) => (
        <span
          key={`${w.label}-${i}`}
          className="inline-flex items-center justify-between gap-3 bg-[#EEF2FF] text-[#2B3B8A] text-[11px] font-semibold px-2 py-0.5 rounded-md border border-[#2B3B8A]/10 whitespace-nowrap"
        >
          <span>{w.label}</span>
          <span className="tabular-nums text-[#E74C3C]">₹{fmt(w.amount)}</span>
        </span>
      ))}
    </div>
  );
}
