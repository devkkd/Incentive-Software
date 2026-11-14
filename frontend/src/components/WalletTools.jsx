'use client';

import React, { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────────────────────
// Search a party → their wallets with credited / redeemed / balance left
// ─────────────────────────────────────────────────────────────────────────────
export function PartyWalletSearch({ wallets, onChanged }) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [transfer, setTransfer] = useState(null); // { party, wallet }

  const run = async (query = q, all = showAll) => {
    const term = query.trim();
    if (term.length < 2) { setError('Type at least 2 characters of the party code or name'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/api/wallets/party-search?q=${encodeURIComponent(term)}${all ? '&all=1' : ''}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Search failed'); return; }
      setResults(data);
      setLastQuery(term);
    } catch { setError('Could not reach the server'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-bold text-gray-900">Find a party&rsquo;s wallets</h2>
          <p className="text-[12px] text-gray-500">Search by party code or name to see every wallet they hold money in.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Party code or name…"
            className="w-64 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-[#2B3B8A]" />
          <label className="flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showAll}
              onChange={(e) => { setShowAll(e.target.checked); if (lastQuery) run(lastQuery, e.target.checked); }}
              className="accent-[#2B3B8A]" />
            Include used-up wallets
          </label>
          <button type="submit" disabled={busy}
            className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl">
            {busy ? 'Searching…' : 'Search'}
          </button>
          {results && (
            <button type="button" onClick={() => { setResults(null); setQ(''); setLastQuery(''); }}
              className="px-3 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">Clear</button>
          )}
        </form>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{error}</div>}

      {results && (
        results.data.length === 0 ? (
          <p className="text-center text-[13px] text-gray-400 py-4">No party matches &ldquo;{lastQuery}&rdquo;.</p>
        ) : (
          <div className="space-y-4">
            {results.truncated && (
              <p className="text-[12px] text-amber-700">Showing the first 25 matches — type more of the code or name to narrow it down.</p>
            )}
            {results.data.map((p) => (
              <div key={p.vendorId} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#F4F7FB]">
                  <div className="text-[13px]">
                    <span className="font-mono font-bold text-[#2B3B8A]">{p.accountNumber}</span>
                    <span className="font-semibold text-gray-900"> · {p.companyName}</span>
                    <span className="text-gray-500"> · {p.branch || '—'} · {p.mobileNumber || 'no mobile'}</span>
                    {p.status !== 'active' && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{p.status}</span>
                    )}
                  </div>
                  <div className="text-[13px] text-gray-600">Total balance <span className="font-bold text-gray-900">{inr(p.walletBalance)}</span></div>
                </div>
                {p.wallets.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-gray-400">
                    No wallet with a balance{showAll ? '' : ' — tick "Include used-up wallets" to see all'}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100 text-[11px] uppercase tracking-wide">
                          <th className="py-2 px-4 font-semibold">Wallet</th>
                          <th className="py-2 px-4 font-semibold text-right">Credited</th>
                          <th className="py-2 px-4 font-semibold text-right">Redeemed</th>
                          <th className="py-2 px-4 font-semibold text-right">Balance Left</th>
                          <th className="py-2 px-4" />
                        </tr>
                      </thead>
                      <tbody>
                        {p.wallets.map((w) => (
                          <tr key={w.monthlyWalletId} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 px-4 font-medium text-gray-900">
                              {w.name}
                              {w.isHold && <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">On hold</span>}
                              {w.isHidden && <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Hidden</span>}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-gray-600">{inr(w.credited)}</td>
                            <td className="py-2 px-4 text-right tabular-nums text-[#E74C3C]">{inr(w.redeemed)}</td>
                            <td className="py-2 px-4 text-right tabular-nums font-bold text-gray-900">{inr(w.balance)}</td>
                            <td className="py-2 px-4 text-right">
                              {w.balance > 0 && (
                                <button onClick={() => setTransfer({ party: p, wallet: w })}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#2B3B8A]/20 text-[#2B3B8A] bg-[#EEF2FF] hover:bg-[#2B3B8A] hover:text-white transition-colors">
                                  Transfer
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                          <td className="py-2 px-4">Total</td>
                          <td className="py-2 px-4 text-right tabular-nums">{inr(p.totals.credited)}</td>
                          <td className="py-2 px-4 text-right tabular-nums text-[#E74C3C]">{inr(p.totals.redeemed)}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{inr(p.totals.balance)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {transfer && (
        <TransferModal
          party={transfer.party}
          source={transfer.wallet}
          wallets={wallets}
          onClose={() => setTransfer(null)}
          onDone={() => { setTransfer(null); run(lastQuery, showAll); onChanged?.(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Move a party's balance from one wallet to another
// ─────────────────────────────────────────────────────────────────────────────
export function TransferModal({ party, source, wallets, onClose, onDone }) {
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState(String(source.balance));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const targets = wallets.filter((w) => w._id !== source.walletId);
  const amt = parseFloat(amount);
  const valid = toWalletId && amt > 0 && amt <= source.balance + 0.001 && reason.trim().length >= 5;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/api/wallets/transfer`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ fromMonthlyWalletId: source.monthlyWalletId, toWalletId, amount: amt, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Transfer failed'); return; }
      onDone?.(data);
    } catch { setError('Could not reach the server. Nothing was moved.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-[18px] font-bold text-gray-900">Transfer balance</h3>
          <p className="text-[13px] text-gray-500 mt-1">
            <span className="font-mono">{party.accountNumber}</span> · {party.companyName}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-[13px]">
          From <span className="font-semibold text-gray-900">{source.name}</span> — available{' '}
          <span className="font-semibold">{inr(source.balance)}</span>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Move to wallet</label>
          <select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] bg-white focus:outline-none focus:border-[#2B3B8A]">
            <option value="">Select a wallet…</option>
            {targets.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}{w.isHidden ? ' (hidden)' : ''}{w.isHold ? ' (on hold)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-[14px] tabular-nums focus:outline-none focus:border-[#2B3B8A]" />
            <button type="button" onClick={() => setAmount(String(source.balance))}
              className="px-3 py-2 text-[12px] font-semibold border border-gray-200 rounded-xl hover:border-[#2B3B8A]">Full</button>
          </div>
          {amt > source.balance + 0.001 && <p className="text-[11px] text-red-600 mt-1">More than the available balance</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reason — recorded</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Credited to the wrong scheme"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
        </div>

        <p className="text-[12px] text-gray-500">
          The party&rsquo;s total balance does not change. Their statement shows a matching transfer out and transfer in.
        </p>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={submit} disabled={busy || !valid}
            className="px-5 py-2 text-[13px] font-semibold text-white bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-40 rounded-xl">
            {busy ? 'Moving…' : `Move ${amt > 0 ? inr(amt) : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a wallet — remaining balances are written off
// ─────────────────────────────────────────────────────────────────────────────
export function DeleteWalletModal({ wallet, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/wallets/${wallet._id}/delete-preview`, { headers: authHeaders(), credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setPreview(d.data) : setLoadError(d.message || 'Could not load')))
      .catch(() => setLoadError('Could not reach the server'));
  }, [wallet._id]);

  const downloadList = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      [`Write-off list — wallet "${wallet.name}"`],
      [`Generated ${new Date().toLocaleString('en-IN')}`],
      [],
      ['Party Code', 'Party Name', 'Branch', 'Credited (Rs)', 'Balance to write off (Rs)'],
      ...preview.parties.map((p) => [p.accountNumber, p.companyName, p.branch, p.credited, p.balance]),
      [],
      ['', '', 'Total', '', preview.totalWriteOff],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Write-off');
    XLSX.writeFile(wb, `writeoff_${wallet.name.replace(/[^\w-]+/g, '_')}.xlsx`);
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/api/wallets/${wallet._id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ confirmName, reason: reason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Delete failed'); return; }
      onDone?.(data);
    } catch { setError('Could not reach the server. Nothing was deleted.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-bold text-gray-900">Delete wallet &ldquo;{wallet.name}&rdquo;</h3>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{loadError}</div>
        ) : !preview ? (
          <p className="text-[13px] text-gray-400">Checking balances…</p>
        ) : (
          <>
            {preview.partyCount > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 space-y-1">
                <p className="font-bold">
                  {inr(preview.totalWriteOff)} will be written off from {preview.partyCount.toLocaleString('en-IN')} part
                  {preview.partyCount === 1 ? 'y' : 'ies'}.
                </p>
                <p>Their balances go down by these amounts and they lose this money. Each gets a &ldquo;Write-off&rdquo; line on their statement.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-700">
                No party holds a balance in this wallet — nothing will be written off.
              </div>
            )}

            {preview.partyCount > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-[12px]">
                  <span className="font-semibold text-gray-600">Parties affected</span>
                  <button onClick={downloadList} className="font-semibold text-[#2B3B8A] hover:underline">Download list</button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {preview.parties.map((p, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 font-mono">{p.accountNumber}</td>
                          <td className="px-3 py-1.5 truncate max-w-[180px]">{p.companyName}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{inr(p.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[12px] text-gray-500">
              Past invoices and statements keep showing this wallet&rsquo;s name. This cannot be undone from the app.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reason (optional)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scheme lapsed on 31 Oct"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Type <span className="font-mono normal-case text-gray-800">{wallet.name}</span> to confirm
              </label>
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono focus:outline-none focus:border-red-400" />
            </div>
          </>
        )}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={submit} disabled={busy || !preview || confirmName.trim() !== wallet.name}
            className="px-5 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl">
            {busy ? 'Deleting…' : preview?.partyCount > 0 ? `Delete & write off ${inr(preview.totalWriteOff)}` : 'Delete wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
