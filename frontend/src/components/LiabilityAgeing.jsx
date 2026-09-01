'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const short = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

const VIEWS = [
  { id: 'byParty',  label: 'By Party' },
  { id: 'byScheme', label: 'By Scheme' },
  { id: 'byBranch', label: 'By Branch' },
];

// Older money is shown in warmer colours — the further right, the more concerning
const BUCKET_TONE = {
  b0_3:   'text-gray-900',
  b3_6:   'text-gray-900',
  b6_12:  'text-amber-700',
  b12_24: 'text-orange-700',
  b24:    'text-red-700 font-semibold',
};

export default function LiabilityAgeing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('byParty');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/analytics/liability-ageing`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setData(json);
      else setError(json.message || 'Could not load the report');
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = data?.[view] || [];

  const firstCol = {
    byParty:  [['partyCode', 'Party Code'], ['partyName', 'Party Name']],
    byScheme: [['scheme', 'Scheme']],
    byBranch: [['location', 'Location']],
  }[view];

  const extraCols = {
    byParty:  [['salesPerson', 'Salesperson'], ['status', 'Status']],
    byScheme: [['parties', 'Parties']],
    byBranch: [['parties', 'Parties']],
  }[view];

  const downloadCsv = () => {
    if (!data) return;
    const head = [
      ...firstCol.map(([, l]) => l),
      ...data.buckets.map((b) => b.label),
      'Total',
      ...extraCols.map(([, l]) => l),
    ].join(',');
    const lines = rows.map((r) =>
      [
        ...firstCol.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`),
        ...data.buckets.map((b) => r[b.key] ?? 0),
        r.total ?? 0,
        ...extraCols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`),
      ].join(',')
    );
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liability_ageing_${view}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Incentive Liability Ageing</h2>
          <p className="text-sm text-gray-500 mt-1">
            How old the money owed to parties is. Age is measured from the month
            each credit belongs to.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={downloadCsv} disabled={!data || !rows.length}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
            Download CSV
          </button>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      )}

      {loading && !data && <p className="py-12 text-center text-sm text-gray-500">Calculating…</p>}

      {data && (
        <>
          {/* Bucket summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {data.buckets.map((b) => {
              const v = data.summary.totals[b.key] || 0;
              const pct = data.summary.redeemableTotal > 0
                ? (v / data.summary.redeemableTotal) * 100 : 0;
              return (
                <div key={b.key} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{b.label}</p>
                  <p className={`text-lg font-bold mt-1 tabular-nums ${BUCKET_TONE[b.key]}`}>{short(v)}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-[#2B3B8A]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 tabular-nums">{pct.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>

          {/* Headline */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 px-1 text-[13px]">
            <span className="text-gray-600">
              Redeemable now:{' '}
              <strong className="text-gray-900 tabular-nums">{fmt(data.summary.redeemableTotal)}</strong>
            </span>
            {data.summary.heldTotal > 0 && (
              <span className="text-gray-600">
                On hold:{' '}
                <strong className="text-amber-700 tabular-nums">{fmt(data.summary.heldTotal)}</strong>
              </span>
            )}
            {data.summary.orphanTotal > 0 && (
              <span className="text-gray-600">
                Orphaned:{' '}
                <strong className="text-red-700 tabular-nums">{fmt(data.summary.orphanTotal)}</strong>
              </span>
            )}
            <span className={data.summary.over12Percent > 25 ? 'text-red-700 font-semibold' : 'text-gray-600'}>
              Older than 12 months:{' '}
              <strong className="tabular-nums">
                {fmt(data.summary.over12Months)} ({data.summary.over12Percent}%)
              </strong>
            </span>
          </div>

          {/* View switch */}
          <div className="flex gap-2 mb-4">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg cursor-pointer transition-colors ${
                  view === v.id
                    ? 'bg-[#2B3B8A] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[520px]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  {firstCol.map(([k, l]) => (
                    <th key={k} className="px-4 py-3 font-semibold whitespace-nowrap">{l}</th>
                  ))}
                  {data.buckets.map((b) => (
                    <th key={b.key} className="px-4 py-3 font-semibold text-right whitespace-nowrap">{b.label}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                  {extraCols.map(([k, l]) => (
                    <th key={k} className="px-4 py-3 font-semibold whitespace-nowrap">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">No outstanding balances</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    {firstCol.map(([k]) => (
                      <td key={k} className="px-4 py-2.5 max-w-[220px] truncate" title={String(r[k] ?? '')}>
                        {r[k] || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    {data.buckets.map((b) => (
                      <td key={b.key} className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${
                        r[b.key] ? BUCKET_TONE[b.key] : 'text-gray-300'
                      }`}>
                        {r[b.key] ? fmt(r[b.key]) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-bold text-gray-900">
                      {fmt(r.total)}
                    </td>
                    {extraCols.map(([k]) => (
                      <td key={k} className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                        {r[k] ?? <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr className="border-t-2 border-gray-200 font-bold text-gray-900">
                    <td className="px-4 py-3" colSpan={firstCol.length}>
                      Total <span className="font-normal text-xs text-gray-500">({rows.length})</span>
                    </td>
                    {data.buckets.map((b) => (
                      <td key={b.key} className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {fmt(rows.reduce((a, r) => a + (r[b.key] || 0), 0))}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {fmt(rows.reduce((a, r) => a + (r.total || 0), 0))}
                    </td>
                    {extraCols.map(([k]) => <td key={k} className="px-4 py-3" />)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="text-[12px] text-gray-500 mt-3">
            Held balances are excluded from the ageing buckets — they cannot be
            redeemed, so ageing them would overstate what is actually available.
          </p>
        </>
      )}
    </div>
  );
}
