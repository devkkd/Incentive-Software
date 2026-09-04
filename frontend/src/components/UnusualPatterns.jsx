'use client';

import React, { useState, useEffect } from 'react';
import SortableTh from '@/components/SortableTh';
import useClientSort from '@/components/useClientSort';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CONTROLS = [
  { key: 'days',                label: 'Look back (days)',            min: 7,  max: 365 },
  { key: 'ratioPercent',        label: 'Flag above % of invoice',     min: 5,  max: 100 },
  { key: 'sameDayCount',        label: 'Redemptions in one day above', min: 1, max: 10 },
  { key: 'largeMultiple',       label: 'Times their own average',     min: 1.5, max: 10, step: 0.5 },
  { key: 'repeatedAmountCount', label: 'Same amount repeated',        min: 2,  max: 10 },
  { key: 'rapidDrainHours',     label: 'Drained within (hours)',      min: 1,  max: 168 },
];

export default function UnusualPatterns() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cfg, setCfg] = useState({
    days: 90, ratioPercent: 40, sameDayCount: 2,
    largeMultiple: 3, repeatedAmountCount: 3, rapidDrainHours: 48,
  });
  const [filter, setFilter] = useState('');

  const load = async (c = cfg) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams(c).toString();
      const res = await fetch(`${API}/api/analytics/unusual-patterns?${qs}`, {
        headers: authHeaders(), credentials: 'include',
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

  const rawFlags = (data?.flags || []).filter((f) => !filter || f.pattern === filter);

  // Point 11
  const { sort, setSort, sorted: flags } = useClientSort(rawFlags, {
    date: (r) => r.date, pattern: (r) => r.pattern,
    partyCode: (r) => r.partyCode, partyName: (r) => r.partyName,
    branch: (r) => r.branch, amount: (r) => r.amount, detail: (r) => r.detail,
  });

  const downloadCsv = () => {
    const cols = [
      ['date', 'Date'], ['pattern', 'Pattern'], ['partyCode', 'Party Code'],
      ['partyName', 'Party Name'], ['branch', 'Branch'], ['amount', 'Amount'],
      ['invoiceNumber', 'Invoice Number'], ['detail', 'Detail'],
    ];
    const head = cols.map(([, l]) => l).join(',');
    const lines = flags.map((f) =>
      cols.map(([k]) => {
        const v = k === 'date' ? new Date(f[k]).toLocaleString('en-IN') : f[k];
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',')
    );
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unusual_patterns_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Unusual Patterns</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Redemptions worth a second look. These are flags for review, not
            evidence of anything — what matters is a pattern that repeats.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={downloadCsv} disabled={!flags.length}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
            Download CSV
          </button>
          <button onClick={() => load()} disabled={loading}
            className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
            {loading ? 'Checking…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Thresholds — adjustable, because a rule that fires constantly gets ignored */}
      <details className="mb-6 rounded-xl border border-gray-100 bg-gray-50">
        <summary className="px-4 py-3 text-[13px] font-semibold text-gray-700 cursor-pointer select-none">
          Thresholds
        </summary>
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONTROLS.map((c) => (
            <div key={c.key}>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                {c.label}
              </label>
              <input
                type="number" min={c.min} max={c.max} step={c.step || 1}
                value={cfg[c.key]}
                onChange={(e) => setCfg({ ...cfg, [c.key]: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#2B3B8A]"
              />
            </div>
          ))}
        </div>
      </details>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      )}
      {loading && !data && <p className="py-12 text-center text-sm text-gray-500">Checking…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className={`rounded-xl border px-4 py-3 ${
              data.summary.totalFlags === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Flags</p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${
                data.summary.totalFlags === 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}>{data.summary.totalFlags}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Value flagged</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmt(data.summary.totalValue)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Patterns triggered</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{data.summary.patternCount}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Redemptions checked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{data.summary.invoicesChecked}</p>
            </div>
          </div>

          {/* Pattern filter */}
          {data.byPattern.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setFilter('')}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg cursor-pointer ${
                  !filter ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                All ({data.summary.totalFlags})
              </button>
              {data.byPattern.map((p) => (
                <button key={p.pattern} onClick={() => setFilter(p.pattern)}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg cursor-pointer ${
                    filter === p.pattern ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {p.pattern} ({p.count})
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[520px]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <SortableTh field="date" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Date</SortableTh>
                  <SortableTh field="pattern" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Pattern</SortableTh>
                  <SortableTh field="partyCode" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Party Code</SortableTh>
                  <SortableTh field="partyName" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Party Name</SortableTh>
                  <SortableTh field="branch" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Branch</SortableTh>
                  <SortableTh field="amount" sort={sort} setSort={setSort} align="right" className="px-4 py-3 font-semibold whitespace-nowrap">Amount</SortableTh>
                  <SortableTh field="detail" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Detail</SortableTh>
                </tr>
              </thead>
              <tbody>
                {flags.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nothing flagged in this period
                  </td></tr>
                ) : flags.map((f, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                      {new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                        {f.pattern}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-900">{f.partyCode}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate" title={f.partyName}>{f.partyName}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{f.branch || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold">{fmt(f.amount)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">{data.note}</p>
        </>
      )}
    </div>
  );
}
