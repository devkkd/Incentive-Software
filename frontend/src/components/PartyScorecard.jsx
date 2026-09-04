'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateStr = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function PartyScorecard() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audit, setAudit] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/vendors/search?q=${encodeURIComponent(query.trim())}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || 'No party found for that search');
        return;
      }
      // Single vendor object, not an array
      const list = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
      if (list.length === 0) {
        setError('No party found for that search');
        return;
      }
      setResults(list);
      if (list.length === 1) loadCard(list[0]._id);
    } catch {
      setError('Could not reach the server');
    } finally {
      setSearching(false);
    }
  };

  const loadCard = async (vendorId) => {
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch(`${API}/api/analytics/scorecard/${vendorId}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setData({ ...json, vendorId });
      else setError(json.message || 'Could not load the scorecard');
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (vendorId) => {
    try {
      const res = await fetch(`${API}/api/analytics/audit/${vendorId}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      if (json.success) { setAudit(json); setAuditOpen(true); }
    } catch { /* the scorecard still works without it */ }
  };

  const EVENT_LABEL = {
    'party.created': 'Party created', 'party.updated': 'Details changed',
    'party.blocked': 'Blocked', 'party.unblocked': 'Unblocked', 'party.deleted': 'Deleted',
    'incentive.credited': 'Incentive credited', 'incentive.topup': 'Top-up',
    'incentive.replaced': 'Amount corrected', 'reconciliation.adjusted': 'Reconciliation',
    'redemption': 'Redemption', 'redemption.adminOverride': 'Admin override',
    'redemption.reassigned': 'Wallet reassigned', 'invoice.deleted': 'Invoice deleted',
    'wallet.held': 'Wallet held', 'wallet.released': 'Wallet released',
    'wallet.renamed': 'Wallet renamed',
  };

  const Field = ({ label, value }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-[13px] text-gray-900 mt-0.5">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #scorecard, #scorecard * { visibility: visible; }
          #scorecard { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 no-print">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Party Scorecard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Everything about one party on one page. This is what you hand a party
            who asks where their incentive went.
          </p>
        </div>
        {data && (
          <div className="flex gap-2 shrink-0">
          <button onClick={() => loadAudit(data.vendorId)}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl cursor-pointer">
            Audit trail
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl cursor-pointer">
            Print
          </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6 no-print">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Party Code, name or mobile number"
          className="flex-1 max-w-md px-4 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]"
        />
        <button onClick={search} disabled={searching || !query.trim()}
          className="px-5 py-2 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {results.length > 1 && (
        <div className="mb-6 border border-gray-100 rounded-xl overflow-hidden no-print">
          {results.map((v) => (
            <button key={v._id} onClick={() => loadCard(v._id)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
              <span className="font-semibold text-gray-900 text-[13px]">{v.accountNumber}</span>
              <span className="text-gray-600 text-[13px] ml-3">{v.companyName}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 no-print">{error}</div>
      )}
      {loading && <p className="py-12 text-center text-sm text-gray-500">Loading…</p>}

      {auditOpen && audit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 no-print"
             onClick={() => setAuditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-bold text-gray-900">Audit trail</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">
                  {audit.party.partyName} · {audit.summary.totalEvents} events
                  {audit.summary.reconstructedEvents > 0 &&
                    ` (${audit.summary.reconstructedEvents} rebuilt from older records)`}
                </p>
              </div>
              <button onClick={() => setAuditOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                &times;
              </button>
            </div>

            <div className="overflow-auto flex-1 divide-y divide-gray-100">
              {audit.events.map((e) => (
                <div key={e._id} className={`px-5 py-3 ${e.reconstructed ? 'bg-gray-50/60' : ''}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-gray-900">
                      {EVENT_LABEL[e.eventType] || e.eventType}
                      {e.reconstructed && (
                        <span className="ml-2 text-[10px] font-normal text-gray-400 uppercase tracking-wide">
                          rebuilt
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-gray-500 tabular-nums">
                      {new Date(e.createdAt).toLocaleString('en-IN')}
                      {e.actorName && ` · ${e.actorName}`}
                    </span>
                  </div>

                  {e.summary && <p className="text-[13px] text-gray-600 mt-0.5">{e.summary}</p>}

                  {e.changes?.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {e.changes.map((c, i) => (
                        <p key={i} className="text-[12px] text-gray-500">
                          <span className="font-medium text-gray-700">{c.field}</span>:{' '}
                          <span className="line-through text-red-600">{String(c.from ?? '—')}</span>
                          {' → '}
                          <span className="text-emerald-700">{String(c.to ?? '—')}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {e.reason && (
                    <p className="text-[12px] text-amber-700 mt-1">Reason: {e.reason}</p>
                  )}
                </div>
              ))}
            </div>

            {audit.note && (
              <p className="px-5 py-3 border-t border-gray-100 text-[12px] text-gray-500 leading-relaxed">
                {audit.note}
              </p>
            )}
          </div>
        </div>
      )}

      {data && (
        <div id="scorecard">
          {/* Header */}
          <div className="border border-gray-200 rounded-xl p-5 mb-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-[20px] font-bold text-gray-900">{data.party.partyName}</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">{data.party.partyCode}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                data.party.status === 'blocked' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'
              }`}>{data.party.status}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Contact Person" value={data.party.contactPerson} />
              <Field label="Mobile Number" value={data.party.mobileNumber} />
              <Field label="Party City" value={data.party.partyCity} />
              <Field label="Party Type" value={data.party.partyType} />
              <Field label="Location" value={data.party.location} />
              <Field label="Salesperson" value={data.party.salesPerson} />
              <Field label="Generated" value={new Date(data.generatedAt).toLocaleString('en-IN')} />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              ['Total Credited', fmt(data.summary.totalCredited)],
              ['Total Redeemed', fmt(data.summary.totalRedeemed)],
              ['Current Balance', fmt(data.summary.currentBalance)],
              ['Redemption Rate', `${data.summary.redemptionRate}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{l}</p>
                <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          {Math.abs(data.summary.discrepancy) > 0.01 && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              <strong>Balance discrepancy of {fmt(data.summary.discrepancy)}.</strong>{' '}
              The party record says {fmt(data.summary.currentBalance)} but the wallets
              below total {fmt(data.summary.subWalletTotal)}. These should agree.
            </div>
          )}

          {/* Wallets */}
          <h4 className="text-[14px] font-bold text-gray-900 mb-2">Wallets</h4>
          <div className="overflow-x-auto border border-gray-100 rounded-xl mb-5">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Scheme</th>
                  <th className="px-4 py-2.5 font-semibold">Period</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Credited</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Redeemed</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Age</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.wallets.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No wallets</td></tr>
                ) : data.wallets.map((w, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">{w.scheme}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{w.month} {w.year}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(w.creditedAmount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(w.redeemed)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(w.balance)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                      {w.ageMonths !== null ? `${w.ageMonths}m` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {w.isHold
                        ? <span className="text-amber-700 text-[11px] font-medium" title={w.holdReason || ''}>
                            On hold ({w.holdLevel})
                          </span>
                        : <span className="text-gray-400 text-[11px]">Available</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="border-t-2 border-gray-200 font-bold">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmt(data.wallets.reduce((a, w) => a + w.creditedAmount, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmt(data.wallets.reduce((a, w) => a + w.redeemed, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(data.summary.subWalletTotal)}</td>
                  <td className="px-4 py-2.5" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Ledger */}
          <h4 className="text-[14px] font-bold text-gray-900 mb-2">Statement</h4>
          <div className="overflow-x-auto border border-gray-100 rounded-xl mb-5 max-h-[420px]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Particulars</th>
                  <th className="px-4 py-2.5 font-semibold">Wallet</th>
                  <th className="px-4 py-2.5 font-semibold">Invoice</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Credit</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Debit</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No transactions</td></tr>
                ) : data.ledger.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 whitespace-nowrap">{dateStr(l.date)}</td>
                    <td className="px-4 py-2.5 max-w-[260px] truncate" title={l.particulars}>{l.particulars}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{l.wallet || '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{l.invoiceNumber || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                      {l.credit ? fmt(l.credit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600">
                      {l.debit ? fmt(l.debit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(l.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trend */}
          <h4 className="text-[14px] font-bold text-gray-900 mb-2">Last 12 months</h4>
          <div className="flex flex-wrap gap-2">
            {data.trend.map((t) => (
              <div key={t.month} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 min-w-[92px]">
                <p className="text-[10px] text-gray-500">{t.month}</p>
                <p className="text-[11px] text-emerald-700 tabular-nums">+{fmt(t.credited)}</p>
                <p className="text-[11px] text-red-600 tabular-nums">−{fmt(t.redeemed)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
