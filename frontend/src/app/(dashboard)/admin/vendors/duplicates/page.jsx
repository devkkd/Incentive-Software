'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

export default function DuplicatePartiesPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showRenames, setShowRenames] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Per group selection: { [code]: { keepId, mergeIds: Set } }
  const [selection, setSelection] = useState({});
  const [confirm, setConfirm] = useState(null); // { group, keep, merging }
  const [reason, setReason] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/party-merge/report`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Could not load duplicate report'); return; }
      setReport(data.data);
      const sel = {};
      data.data.duplicates.forEach((g) => {
        sel[g.code] = {
          keepId: String(g.suggestedKeepId),
          mergeIds: new Set(g.parties.map((p) => String(p.vendorId)).filter((id) => id !== String(g.suggestedKeepId))),
        };
      });
      setSelection(sel);
    } catch {
      setError('Server error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    if (!q) return report.duplicates;
    return report.duplicates.filter((g) =>
      g.code.toLowerCase().includes(q) ||
      g.parties.some((p) => `${p.accountNumber} ${p.companyName} ${p.mobileNumber} ${p.branch}`.toLowerCase().includes(q))
    );
  }, [report, search]);

  const setKeep = (code, id) => {
    setSelection((prev) => {
      const g = report.duplicates.find((x) => x.code === code);
      return {
        ...prev,
        [code]: { keepId: id, mergeIds: new Set(g.parties.map((p) => String(p.vendorId)).filter((x) => x !== id)) },
      };
    });
  };

  const toggleMerge = (code, id) => {
    setSelection((prev) => {
      const cur = prev[code];
      const next = new Set(cur.mergeIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [code]: { ...cur, mergeIds: next } };
    });
  };

  const openConfirm = (group) => {
    const sel = selection[group.code];
    const keep = group.parties.find((p) => String(p.vendorId) === sel.keepId);
    const mergingList = group.parties.filter((p) => sel.mergeIds.has(String(p.vendorId)));
    setReason(''); setMergeError('');
    setConfirm({ group, keep, merging: mergingList });
  };

  const doMerge = async () => {
    setMerging(true); setMergeError('');
    try {
      const res = await fetch(`${API}/api/party-merge/merge`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({
          keepId: confirm.keep.vendorId,
          mergeIds: confirm.merging.map((p) => p.vendorId),
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMergeError(data.message || 'Merge failed'); return; }
      const k = data.data.keep;
      setNotice(
        `Merged ${data.data.merged.map((m) => m.accountNumber).join(', ')} into ${k.accountNumber} (${k.companyName}). ` +
        `New balance ${inr(k.walletBalance)}.`
      );
      setConfirm(null);
      await load();
    } catch {
      setMergeError('Server error. Nothing was changed.');
    } finally {
      setMerging(false);
    }
  };

  const doCleanup = async () => {
    if (!window.confirm(
      `Clean ${report.renames.length} party codes? Branch prefixes will be removed (e.g. WSG-WSG-123 → 123).\n\n` +
      'Duplicates are not touched. Please make sure a database backup has been taken.'
    )) return;
    setCleaning(true); setError('');
    try {
      const res = await fetch(`${API}/api/party-merge/cleanup-codes`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Cleanup failed'); return; }
      setNotice(`${data.message}.${data.data.skipped.length ? ` ${data.data.skipped.length} skipped.` : ''}`);
      await load();
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">
      <div>
        <Link href="/admin/vendors" className="text-[13px] text-[#2B3B8A] font-semibold hover:underline">← Back to Party List</Link>
        <h1 className="text-[28px] font-bold text-black tracking-tight mt-2">Duplicate Parties</h1>
        <p className="text-[14px] text-gray-600 mt-1 max-w-3xl">
          Party codes no longer include the branch. Accounts that share the same code under different
          branches (for example <span className="font-mono">WSG-123</span> and <span className="font-mono">JOH-123</span>) are
          listed here to be merged into one.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800 flex justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-semibold">Dismiss</button>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}

      {loading && !report ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">Loading…</div>
      ) : report && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[13px] text-gray-500">Total parties</p>
              <p className="text-[26px] font-bold text-gray-900">{report.totalParties.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[13px] text-gray-500">Codes still carrying a branch prefix</p>
              <p className="text-[26px] font-bold text-[#2B3B8A]">{report.renames.length.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[13px] text-gray-500">Duplicate groups to merge</p>
              <p className="text-[26px] font-bold text-amber-600">{report.duplicates.length.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Step 1 — code cleanup */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">Step 1 — Clean party codes</h2>
                <p className="text-[13px] text-gray-600 mt-1">
                  Removes branch prefixes from codes that are unique (e.g. <span className="font-mono">WSG-WSG-123123 → 123123</span>).
                  Duplicates below keep their current code until they are merged.
                </p>
              </div>
              <div className="flex gap-2">
                {report.renames.length > 0 && (
                  <button onClick={() => setShowRenames((s) => !s)}
                    className="px-4 py-2 border border-gray-200 hover:border-[#2B3B8A] rounded-xl text-[13px] font-semibold text-gray-700">
                    {showRenames ? 'Hide list' : 'Preview list'}
                  </button>
                )}
                <button onClick={doCleanup} disabled={cleaning || report.renames.length === 0}
                  className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-40 text-white rounded-xl text-[13px] font-semibold">
                  {cleaning ? 'Cleaning…' : report.renames.length ? `Clean ${report.renames.length.toLocaleString('en-IN')} codes` : 'All codes clean'}
                </button>
              </div>
            </div>
            {showRenames && report.renames.length > 0 && (
              <div className="mt-4 max-h-80 overflow-auto border border-gray-100 rounded-xl">
                <table className="w-full text-[13px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-500">
                      <th className="py-2 px-3 font-semibold">Current code</th>
                      <th className="py-2 px-3 font-semibold">New code</th>
                      <th className="py-2 px-3 font-semibold">Party</th>
                      <th className="py-2 px-3 font-semibold">Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.renames.map((r) => (
                      <tr key={r.vendorId} className="border-t border-gray-100">
                        <td className="py-2 px-3 font-mono text-gray-500 line-through">{r.from}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-[#2B3B8A]">{r.to}</td>
                        <td className="py-2 px-3">{r.companyName}</td>
                        <td className="py-2 px-3">{r.branch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step 2 — duplicates */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-bold text-gray-900">Step 2 — Merge duplicates</h2>
                <p className="text-[13px] text-gray-600 mt-1">
                  The account with the most recent redemption is pre-selected to keep. Its mobile number, branch and
                  status stay. Balances (scheme by scheme), invoices and history move onto it; the other account is archived.
                </p>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, name, mobile…"
                className="w-full sm:w-72 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:bg-white focus:border-[#2B3B8A]" />
            </div>

            {groups.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-[14px]">
                {report.duplicates.length === 0 ? 'No duplicate parties found.' : 'No groups match your search.'}
              </div>
            ) : groups.map((g) => {
              const sel = selection[g.code];
              if (!sel) return null;
              const mergeCount = sel.mergeIds.size;
              return (
                <div key={g.code} className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#F4F7FB]">
                    <div className="text-[14px]">
                      Code <span className="font-mono font-bold text-[#2B3B8A]">{g.code}</span>
                      <span className="text-gray-500"> · {g.parties.length} accounts · combined balance </span>
                      <span className="font-semibold">{inr(g.combinedBalance)}</span>
                    </div>
                    <button onClick={() => openConfirm(g)} disabled={mergeCount === 0}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-[13px] font-semibold">
                      Merge {mergeCount} into kept account
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] whitespace-nowrap">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 px-3 font-semibold">Keep</th>
                          <th className="py-2 px-3 font-semibold">Merge</th>
                          <th className="py-2 px-3 font-semibold">Current code</th>
                          <th className="py-2 px-3 font-semibold">Party name</th>
                          <th className="py-2 px-3 font-semibold">Branch</th>
                          <th className="py-2 px-3 font-semibold">Mobile</th>
                          <th className="py-2 px-3 font-semibold text-right">Balance</th>
                          <th className="py-2 px-3 font-semibold text-right">Invoices</th>
                          <th className="py-2 px-3 font-semibold text-right">Redeemed</th>
                          <th className="py-2 px-3 font-semibold">Last redemption</th>
                          <th className="py-2 px-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.parties.map((p) => {
                          const id = String(p.vendorId);
                          const isKeep = sel.keepId === id;
                          return (
                            <tr key={id} className={`border-b border-gray-50 last:border-0 ${isKeep ? 'bg-green-50/60' : ''}`}>
                              <td className="py-2 px-3">
                                <input type="radio" name={`keep-${g.code}`} checked={isKeep}
                                  onChange={() => setKeep(g.code, id)} className="cursor-pointer accent-[#2B3B8A]" />
                              </td>
                              <td className="py-2 px-3">
                                <input type="checkbox" disabled={isKeep} checked={!isKeep && sel.mergeIds.has(id)}
                                  onChange={() => toggleMerge(g.code, id)} className="cursor-pointer accent-amber-500 disabled:opacity-30" />
                              </td>
                              <td className="py-2 px-3 font-mono">{p.accountNumber}</td>
                              <td className="py-2 px-3 font-medium text-gray-900">
                                {p.companyName}
                                {String(g.suggestedKeepId) === id && (
                                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Suggested</span>
                                )}
                              </td>
                              <td className="py-2 px-3">{p.branch}</td>
                              <td className="py-2 px-3">{p.mobileNumber}</td>
                              <td className="py-2 px-3 text-right tabular-nums font-semibold">{inr(p.walletBalance)}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{p.invoiceCount.toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{inr(p.totalRedeemed)}</td>
                              <td className="py-2 px-3">{fmtDate(p.lastRedemptionAt)}</td>
                              <td className="py-2 px-3 capitalize">{p.status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Confirm merge */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !merging && setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold text-gray-900">Confirm merge</h3>
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-[13px]">
              <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide">Keep</p>
              <p className="font-semibold text-gray-900">{confirm.keep.companyName}</p>
              <p className="text-gray-600">
                {confirm.keep.accountNumber} → <span className="font-mono font-semibold">{confirm.group.code}</span> · {confirm.keep.branch} · {confirm.keep.mobileNumber}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] space-y-1">
              <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide">Merge in and remove</p>
              {confirm.merging.map((p) => (
                <p key={p.vendorId}>
                  <span className="font-mono">{p.accountNumber}</span> · {p.companyName} · {p.branch} ·{' '}
                  <span className="font-semibold">{inr(p.walletBalance)}</span>, {p.invoiceCount} invoices
                </p>
              ))}
            </div>
            <p className="text-[13px] text-gray-700">
              Balance after merge:{' '}
              <span className="font-bold">
                {inr(confirm.keep.walletBalance + confirm.merging.reduce((a, p) => a + p.walletBalance, 0))}
              </span>
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reason (optional)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Same party created under two branches"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
            </div>
            <p className="text-[12px] text-gray-500">This cannot be undone from the app. It is recorded in the audit trail.</p>
            {mergeError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{mergeError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} disabled={merging}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={doMerge} disabled={merging}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl">
                {merging ? 'Merging…' : 'Merge accounts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
