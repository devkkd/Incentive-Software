'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SortableTh from '@/components/SortableTh';
import useClientSort from '@/components/useClientSort';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

/**
 * One component for the five aggregate reports — Points 20.2, 20.3, 20.5,
 * 20.6 and 20.8. They share the same shape: fetch, show summary cards, render
 * a table with totals, export to CSV. Config below rather than five files.
 */
const REPORTS = {
  movement: {
    title: 'Liability Movement',
    blurb: 'Opening + credited − redeemed = closing, month by month. The variance must be zero.',
    endpoint: 'liability-movement',
    rowsKey: 'rows',
    cols: [
      ['month', 'Month'],
      ['opening', 'Opening', 'money'],
      ['credited', 'Credited', 'money'],
      ['redeemed', 'Redeemed', 'money'],
      ['closing', 'Closing (calculated)', 'money'],
      ['actual', 'Actual', 'money'],
      ['variance', 'Variance', 'variance'],
    ],
    cards: (s) => [
      { label: 'Total credited', value: fmt(s.totalCredited) },
      { label: 'Total redeemed', value: fmt(s.totalRedeemed) },
      { label: 'Closing balance', value: fmt(s.closingActual) },
      {
        label: 'Reconciles', value: s.reconciles ? 'Yes' : `No — ${fmt(s.variance)}`,
        tone: s.reconciles ? 'good' : 'bad',
      },
    ],
  },

  scheme: {
    title: 'Scheme Performance',
    blurb: 'Did each scheme work? Redemption rate and party participation answer different questions — read both.',
    endpoint: 'scheme-performance',
    rowsKey: 'rows',
    cols: [
      ['scheme', 'Scheme'],
      ['period', 'Period'],
      ['partiesCredited', 'Parties', 'num'],
      ['totalCredited', 'Credited', 'money'],
      ['totalRedeemed', 'Redeemed', 'money'],
      ['outstanding', 'Outstanding', 'money'],
      ['redemptionRate', 'Redemption %', 'pct'],
      ['partiesRedeemed', 'Parties used', 'num'],
      ['participationRate', 'Participation %', 'pct'],
      ['medianDaysToRedeem', 'Median days', 'num'],
    ],
  },

  velocity: {
    title: 'Redemption Velocity',
    blurb: 'How long parties take to use their incentive. Trust the median, not the average.',
    endpoint: 'redemption-velocity',
    rowsKey: 'buckets',
    cols: [
      ['label', 'Time to redeem'],
      ['count', 'Redemptions', 'num'],
      ['percent', 'Share', 'pct'],
      ['value', 'Value', 'money'],
    ],
    cards: (s) => [
      { label: 'Median days', value: num(s.medianDays) },
      { label: 'Average days', value: num(s.averageDays) },
      { label: 'Redemptions measured', value: num(s.redemptions) },
      {
        label: 'Could not be measured',
        value: `${num(s.unattributedCount)} · ${fmt(s.unattributedValue)}`,
        tone: s.unattributedCount > 0 ? 'warn' : 'good',
      },
    ],
    extra: 'trend',
  },

  ratio: {
    title: 'Incentive-to-Purchase Ratio',
    blurb: 'How much of each party\u2019s buying is funded by incentive. Outliers are flagged for review, not accusation.',
    endpoint: 'incentive-ratio',
    rowsKey: 'rows',
    cols: [
      ['partyCode', 'Party Code'],
      ['partyName', 'Party Name'],
      ['location', 'Location'],
      ['invoiceValue', 'Invoice Value', 'money'],
      ['redeemed', 'Redeemed', 'money'],
      ['ratio', 'Ratio', 'pct'],
      ['invoiceCount', 'Invoices', 'num'],
      ['avgPerInvoice', 'Avg per invoice', 'money'],
    ],
    cards: (s) => [
      { label: 'Parties', value: num(s.parties) },
      { label: 'Median ratio', value: pct(s.medianRatio) },
      { label: 'Mean ratio', value: pct(s.meanRatio) },
      {
        label: 'Outliers', value: `${num(s.outlierCount)} above ${pct(s.outlierThreshold)}`,
        tone: s.outlierCount > 0 ? 'warn' : 'good',
      },
    ],
    highlight: (r) => r.outlier,
  },

  overrides: {
    title: 'Admin Override Report',
    blurb: 'Every redemption completed without the party approving by OTP. This report is what makes that feature safe to have — review it regularly.',
    endpoint: 'overrides',
    base: 'invoices',
    rowsKey: 'rows',
    cols: [
      ['date', 'Date', 'datetime'],
      ['adminUser', 'Admin'],
      ['partyCode', 'Party Code'],
      ['partyName', 'Party Name'],
      ['amount', 'Amount', 'money'],
      ['invoiceNumber', 'Invoice Number'],
      ['branch', 'Branch'],
      ['reason', 'Reason'],
      ['partyNotified', 'Party Notified', 'bool'],
    ],
    cards: (s) => [
      { label: 'Total overrides', value: num(s.total), tone: s.total > 0 ? 'warn' : 'good' },
      { label: 'Total value', value: fmt(s.totalValue) },
      { label: 'This month', value: `${num(s.thisMonth)} · ${fmt(s.thisMonthValue)}` },
      {
        label: 'Party not notified', value: num(s.notNotified),
        tone: s.notNotified > 0 ? 'bad' : 'good',
      },
    ],
  },

  reassignments: {
    title: 'Reassignment Report',
    blurb: 'Every invoice whose source wallet was changed after the fact. Each one added a reversal and a re-application rather than editing the original.',
    endpoint: 'reassignments',
    base: 'invoices',
    rowsKey: 'rows',
    cols: [
      ['date', 'Date', 'datetime'],
      ['adminUser', 'Admin'],
      ['partyCode', 'Party Code'],
      ['partyName', 'Party Name'],
      ['invoiceNumber', 'Invoice Number'],
      ['amount', 'Amount', 'money'],
      ['movedFrom', 'Moved From'],
      ['movedTo', 'Moved To'],
      ['reason', 'Reason'],
      ['timesReassigned', 'Times', 'num'],
    ],
    cards: (s) => [
      { label: 'Reassignments', value: num(s.total), tone: s.total > 0 ? 'warn' : 'good' },
      { label: 'Total value moved', value: fmt(s.totalValue) },
      { label: 'Invoices affected', value: num(s.invoicesAffected) },
      {
        label: 'Moved more than once', value: num(s.multipleReassignments),
        tone: s.multipleReassignments > 0 ? 'bad' : 'good',
      },
    ],
    highlight: (r) => r.timesReassigned > 1,
  },

  branch: {
    title: 'Branch Performance',
    blurb: 'Which branches are promoting the scheme. Read the caveat below before comparing.',
    endpoint: 'branch-performance',
    rowsKey: 'rows',
    cols: [
      ['location', 'Location'],
      ['locationCode', 'Code'],
      ['parties', 'Parties', 'num'],
      ['activeParties', 'Active', 'num'],
      ['invoices', 'Invoices', 'num'],
      ['invoiceValue', 'Invoice Value', 'money'],
      ['redeemed', 'Redeemed', 'money'],
      ['redemptionPercent', 'Redeemed %', 'pct'],
      ['outstandingBalance', 'Outstanding', 'money'],
    ],
  },
};

export default function AnalyticsReport({ type }) {
  const cfg = REPORTS[type];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/${cfg.base || 'analytics'}/${cfg.endpoint}`, {
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

  useEffect(() => { load(); }, [type]);

  const rawRows = data?.[cfg.rowsKey] || [];

  // Point 11 — every column in the config becomes sortable. These reports load
  // their full dataset, so sorting in the browser sorts everything.
  const accessors = useMemo(
    () => Object.fromEntries(cfg.cols.map(([k]) => [k, (r) => r[k]])),
    [cfg]
  );
  const { sort, setSort, sorted: rows } = useClientSort(rawRows, accessors);

  const render = (r, [key, , kind]) => {
    const v = r[key];
    if (v === null || v === undefined || v === '') return <span className="text-gray-300">—</span>;
    if (kind === 'money') return fmt(v);
    if (kind === 'pct') return pct(v);
    if (kind === 'num') return num(v);
    if (kind === 'datetime') return new Date(v).toLocaleString('en-IN');
    if (kind === 'bool') {
      return v
        ? <span className="text-emerald-700">Yes</span>
        : <span className="text-red-700 font-semibold">No</span>;
    }
    if (kind === 'variance') {
      const ok = Math.abs(Number(v)) < 0.01;
      return <span className={ok ? 'text-emerald-700 font-semibold' : 'text-red-700 font-bold'}>{fmt(v)}</span>;
    }
    return String(v);
  };

  const downloadCsv = () => {
    const head = cfg.cols.map(([, l]) => l).join(',');
    const lines = rows.map((r) =>
      cfg.cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cfg.endpoint}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isNumeric = (kind) => ['money', 'num', 'pct', 'variance'].includes(kind);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">{cfg.title}</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{cfg.blurb}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={downloadCsv} disabled={!rows.length}
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
          {cfg.cards && data.summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {cfg.cards(data.summary).map((c, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 ${
                  c.tone === 'bad' ? 'border-red-200 bg-red-50'
                  : c.tone === 'warn' ? 'border-amber-200 bg-amber-50'
                  : c.tone === 'good' ? 'border-emerald-200 bg-emerald-50'
                  : 'border-gray-100 bg-gray-50'
                }`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{c.label}</p>
                  <p className={`text-lg font-bold mt-1 tabular-nums ${
                    c.tone === 'bad' ? 'text-red-700'
                    : c.tone === 'warn' ? 'text-amber-700'
                    : c.tone === 'good' ? 'text-emerald-700'
                    : 'text-gray-900'
                  }`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[520px]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  {cfg.cols.map(([k, l, kind]) => (
                    <SortableTh key={k} field={k} sort={sort} setSort={setSort}
                      align={isNumeric(kind) ? 'right' : 'left'}
                      className="px-4 py-3 font-semibold whitespace-nowrap">
                      {l}
                    </SortableTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={cfg.cols.length} className="px-4 py-8 text-center text-gray-500">
                    No data yet
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className={`border-t border-gray-100 hover:bg-gray-50 ${
                    cfg.highlight?.(r) ? 'bg-amber-50/60' : ''
                  }`}>
                    {cfg.cols.map((c) => (
                      <td key={c[0]} className={`px-4 py-2.5 whitespace-nowrap ${
                        isNumeric(c[2]) ? 'text-right tabular-nums' : ''
                      } ${c[0] === 'partyName' || c[0] === 'scheme' ? 'max-w-[220px] truncate' : ''}`}
                        title={c[0] === 'partyName' || c[0] === 'scheme' ? String(r[c[0]] ?? '') : undefined}>
                        {render(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Velocity trend */}
          {cfg.extra === 'trend' && data.trend?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[13px] font-bold text-gray-900 mb-2">Median days to redeem, by month</h3>
              <div className="flex flex-wrap gap-2">
                {data.trend.map((t) => (
                  <div key={t.month} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] text-gray-500">{t.month}</p>
                    <p className="text-[15px] font-bold text-gray-900 tabular-nums">{t.medianDays}d</p>
                    <p className="text-[10px] text-gray-500 tabular-nums">{t.redemptions} redemptions</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.note && (
            <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">{data.note}</p>
          )}
        </>
      )}
    </div>
  );
}
