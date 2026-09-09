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

const dateStr = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function DormantParties() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(6);
  const [minBalance, setMinBalance] = useState(0);
  const [tab, setTab] = useState('never');

  const load = async (m = months, mb = minBalance) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API}/api/analytics/dormant-parties?months=${m}&minBalance=${mb}`,
        { headers: authHeaders(), credentials: 'include' }
      );
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

  const rawRows = data ? (tab === 'never' ? data.neverRedeemed : data.stoppedRedeeming) : [];

  // Point 11
  const { sort, setSort, sorted: rows } = useClientSort(rawRows, {
    partyCode: (r) => r.partyCode,
    partyName: (r) => r.partyName,
    mobileNumber: (r) => r.mobileNumber,
    partyCity: (r) => r.partyCity,
    salesPerson: (r) => r.salesPerson,
    currentBalance: (r) => r.currentBalance,
    lastRedemption: (r) => r.lastRedemption,
    daysSinceRedemption: (r) => r.daysSinceRedemption,
    lastInvoice: (r) => r.lastInvoice,
    status: (r) => r.status,
  });

  const downloadCsv = () => {
    if (!data) return;
    const cols = [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['mobileNumber', 'Mobile Number'], ['partyCity', 'Party City'],
      ['partyType', 'Party Type'], ['location', 'Location'],
      ['salesPerson', 'Salesperson'], ['currentBalance', 'Current Balance'],
      ['lastRedemption', 'Last Redemption'], ['daysSinceRedemption', 'Days Since'],
      ['lastInvoice', 'Last Invoice'], ['status', 'Status'],
    ];
    const head = cols.map(([, l]) => l).join(',');
    const lines = rows.map((r) =>
      cols.map(([k]) => {
        const v = r[k];
        if (k === 'lastRedemption' || k === 'lastInvoice') return `"${dateStr(v) || ''}"`;
        return `"${String(v ?? '').replace(/"/g, '""')}"`;
      }).join(',')
    );
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dormant_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Dormant Parties</h2>
          <p className="text-sm text-gray-500 mt-1">
            Parties sitting on a balance who have stopped redeeming. Every name
            here is a phone call worth making.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={downloadCsv} disabled={!rows.length}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer">
            Download call list
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            No redemption in
          </label>
          <div className="flex gap-1.5">
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => { setMonths(m); load(m, minBalance); }}
                className={`px-3 py-1.5 text-[13px] font-semibold rounded-lg cursor-pointer transition-colors ${
                  months === m ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {m} months
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Minimum balance
          </label>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={minBalance}
              onChange={(e) => setMinBalance(Number(e.target.value) || 0)}
              onKeyDown={(e) => e.key === 'Enter' && load(months, minBalance)}
              className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#2B3B8A]" />
            <button onClick={() => load(months, minBalance)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-semibold rounded-lg cursor-pointer">
              Apply
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      )}

      {loading && !data && <p className="py-12 text-center text-sm text-gray-500">Looking…</p>}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dormant parties</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{data.summary.totalParties}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Balance sitting idle</p>
              <p className="text-2xl font-bold text-[#2B3B8A] mt-1 tabular-nums">{fmt(data.summary.totalBalance)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Never redeemed at all</p>
              <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{data.summary.neverRedeemedCount}</p>
              <p className="text-[11px] text-amber-700 mt-0.5 tabular-nums">{fmt(data.summary.neverRedeemedValue)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTab('never')}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg cursor-pointer ${
                tab === 'never' ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              Never redeemed ({data.summary.neverRedeemedCount})
            </button>
            <button onClick={() => setTab('stopped')}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg cursor-pointer ${
                tab === 'stopped' ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              Stopped redeeming ({data.summary.stoppedCount})
            </button>
          </div>

          <p className="text-[12px] text-gray-500 mb-3">
            {tab === 'never'
              ? 'These parties have a balance but have never redeemed. They most likely do not know it exists.'
              : `These parties used to redeem and have not done so in ${data.window.months} months. Worth understanding why.`}
          </p>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[520px]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <SortableTh field="partyCode" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Party Code</SortableTh>
                  <SortableTh field="partyName" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Party Name</SortableTh>
                  <SortableTh field="mobileNumber" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Mobile Number</SortableTh>
                  <SortableTh field="partyCity" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Party City</SortableTh>
                  <SortableTh field="salesPerson" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Salesperson</SortableTh>
                  <SortableTh field="currentBalance" sort={sort} setSort={setSort} align="right" className="px-4 py-3 font-semibold whitespace-nowrap">Current Balance</SortableTh>
                  {tab === 'stopped' && (
                    <>
                      <SortableTh field="lastRedemption" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Last Redemption</SortableTh>
                      <SortableTh field="daysSinceRedemption" sort={sort} setSort={setSort} align="right" className="px-4 py-3 font-semibold whitespace-nowrap">Days Since</SortableTh>
                    </>
                  )}
                  <SortableTh field="lastInvoice" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Last Invoice</SortableTh>
                  <SortableTh field="status" sort={sort} setSort={setSort} className="px-4 py-3 font-semibold whitespace-nowrap">Status</SortableTh>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No parties in this group
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-900">{r.partyCode}</td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" title={r.partyName}>{r.partyName}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{r.mobileNumber}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{r.partyCity || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{r.salesPerson || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-bold text-gray-900">{fmt(r.currentBalance)}</td>
                    {tab === 'stopped' && (
                      <>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{dateStr(r.lastRedemption)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${
                          r.daysSinceRedemption > 365 ? 'text-red-700 font-semibold' : 'text-gray-600'
                        }`}>
                          {r.daysSinceRedemption}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                      {dateStr(r.lastInvoice) || <span className="text-gray-300">never</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        r.status === 'blocked' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By salesperson */}
          {data.bySalesperson.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[13px] font-bold text-gray-900 mb-2">By salesperson</h3>
              <div className="flex flex-wrap gap-2">
                {data.bySalesperson.map((s) => (
                  <div key={s.salesPerson} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[12px] font-semibold text-gray-900">{s.salesPerson}</p>
                    <p className="text-[11px] text-gray-500 tabular-nums">
                      {s.parties} part{s.parties === 1 ? 'y' : 'ies'} · {fmt(s.balance)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
