'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Each section: which key it lives under, its heading, what it means, and
 * which columns to show. Adding a new check on the server only needs a new
 * entry here.
 */
const SECTIONS = [
  {
    key: 'negativeBalances',
    title: 'Negative balances',
    why: 'A wallet below zero has been deducted more than it ever held. Someone has redeemed money that was not there.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'], ['wallet', 'Wallet'],
      ['creditedAmount', 'Credited', 'money'], ['balance', 'Balance', 'money'],
    ],
  },
  {
    key: 'deletedParties',
    title: 'Deleted parties',
    why: 'Records still pointing at a party that no longer exists. Deleting a party leaves their wallets, transactions and invoices behind.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['mobileNumber', 'Mobile Number'], ['location', 'Location'],
      ['wallets', 'Wallets held'], ['walletBalance', 'Balance left', 'money'],
      ['invoiceCount', 'Invoices'], ['redeemedValue', 'Redeemed', 'money'],
      ['deletedOn', 'Deleted on', 'date'], ['deletedBy', 'Deleted by'],
      ['lastActivity', 'Last activity', 'date'],
    ],
  },
  {
    key: 'ledgerMismatches',
    title: 'Ledger mismatches',
    why: 'The balance on the party record disagrees with the sum of their month wallets. These are two records of the same money and must agree.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['masterBalance', 'Master', 'money'], ['subWalletTotal', 'Sub-wallets', 'money'],
      ['gap', 'Gap', 'money'], ['direction', 'Direction'],
    ],
  },
  {
    key: 'balanceExceedsCredited',
    title: 'Balance higher than credited',
    why: 'A wallet holding more than was ever put into it. Money has appeared from nowhere.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'], ['wallet', 'Wallet'],
      ['creditedAmount', 'Credited', 'money'], ['balance', 'Balance', 'money'],
      ['excess', 'Excess', 'money'],
    ],
  },
  {
    key: 'unattributedDebits',
    title: 'Redemptions with no wallet',
    why: 'Money taken out but never tied to a month or scheme. Scheme-level figures cannot reconcile while these exist.',
    cols: [
      ['date', 'Date', 'date'], ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['amount', 'Amount', 'money'], ['description', 'Description'],
    ],
  },
  {
    key: 'holdsWithoutReason',
    title: 'Holds with no reason recorded',
    why: 'Money frozen with nothing explaining why. Nobody can safely release it.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['wallet', 'Wallet'], ['balance', 'Balance', 'money'],
    ],
  },
  {
    key: 'walletsWithoutScheme',
    title: 'Wallets with no scheme attached',
    why: 'These cannot be held, expired or reported on at scheme level.',
    cols: [
      ['partyCode', 'Party Code'], ['partyName', 'Party Name'],
      ['label', 'Label'], ['balance', 'Balance', 'money'],
    ],
  },
  {
    key: 'duplicateInvoices',
    title: 'Duplicate invoice numbers',
    why: 'The same invoice number used more than once. Redemption may have been taken twice against one sale.',
    cols: [
      ['invoiceNumber', 'Invoice Number'], ['occurrences', 'Times used'],
      ['totalValue', 'Combined value', 'money'],
    ],
  },
  {
    key: 'uploadsNoWallets',
    title: 'Uploads that created no wallets',
    why: 'An incentive file was processed but no wallets exist for it. Those parties never received their credit.',
    cols: [
      ['uploadedOn', 'Uploaded', 'date'], ['fileName', 'File'], ['scheme', 'Scheme'],
      ['itemCount', 'Parties'], ['totalAmount', 'Amount', 'money'],
    ],
  },
];

export default function ExceptionReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  // Correcting a wallet that a bug pushed negative
  const [negatives, setNegatives] = useState(null);
  const [fixRow, setFixRow] = useState(null);
  const [fixTarget, setFixTarget] = useState('');
  const [fixReason, setFixReason] = useState('');
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState('');

  const loadNegatives = async () => {
    try {
      const res = await fetch(`${API}/api/wallets/negative-wallets`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setNegatives(json);
    } catch (err) { console.error('[negatives]', err); }
  };

  const applyFix = async () => {
    setFixBusy(true); setFixError('');
    try {
      const res = await fetch(`${API}/api/wallets/correct-negative`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromMonthlyWalletId: fixRow.monthlyWalletId,
          toMonthlyWalletId: fixTarget,
          reason: fixReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFixRow(null); setFixTarget(''); setFixReason('');
        await loadNegatives();
        await load();
      } else setFixError(json.message);
    } catch { setFixError('Could not reach the server'); }
    finally { setFixBusy(false); }
  };

  const runBackup = async () => {
    setBackupRunning(true);
    setBackupResult(null);
    try {
      const res = await fetch(`${API}/api/exceptions/backup/run`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      setBackupResult(json);
    } catch {
      setBackupResult({ success: false, message: 'Could not reach the server' });
    } finally {
      setBackupRunning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/exceptions`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setData(json);
      else setError(json.message || 'Could not load the report');
    } catch (err) {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); loadNegatives(); }, []);

  const cell = (row, [key, , type]) => {
    const v = row[key];
    if (v === null || v === undefined || v === '') return <span className="text-gray-300">—</span>;
    if (type === 'money') {
      const neg = Number(v) < 0;
      return <span className={neg ? 'text-red-600 font-semibold' : ''}>{fmt(v)}</span>;
    }
    if (type === 'date') return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return String(v);
  };

  const downloadCsv = (section, cols) => {
    const header = cols.map(([, label]) => label).join(',');
    const lines = section.rows.map((r) =>
      cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exceptions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Exception Report</h2>
          <p className="text-sm text-gray-500 mt-1">
            Everything in the data that should not exist. This report only reads —
            it changes nothing.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={runBackup}
            disabled={backupRunning}
            title="Generate the Excel snapshot now and email it"
            className="px-4 py-2 bg-white border border-gray-200 hover:border-[#2B3B8A] text-gray-700 text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {backupRunning ? 'Backing up…' : 'Back up now'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Checking…' : 'Run again'}
          </button>
        </div>
      </div>

      {backupResult && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-[13px] ${
          backupResult.success
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <p className="font-semibold">{backupResult.message}</p>
          {backupResult.data && (
            <>
              <p className="mt-1 text-[12px]">{backupResult.data.fileName}</p>
              {backupResult.data.filePath && (
                <p className="mt-1 text-[12px] text-gray-600">
                  Kept on the server at {backupResult.data.filePath}
                </p>
              )}
              {backupResult.data.error && (
                <p className="mt-1 text-[12px] text-red-700 font-medium">
                  Email failed: {backupResult.data.error}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Negative wallets — correctable in place */}
      {negatives?.count > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-[15px] font-bold text-red-800">
              {negatives.count} wallet{negatives.count === 1 ? '' : 's'} below zero
              &nbsp;·&nbsp; {fmt(negatives.totalShortfall)}
            </h3>
            <p className="text-[12px] text-red-700 mt-1 leading-relaxed">
              More was taken from these wallets than they held — the money came
              from the wrong month. Moving the shortfall to the correct month
              fixes it. <strong>The party&rsquo;s total balance does not change.</strong>
            </p>
          </div>

          <div className="overflow-x-auto bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Party Code</th>
                  <th className="px-4 py-2.5 font-semibold">Party Name</th>
                  <th className="px-4 py-2.5 font-semibold">Wallet</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Shortfall</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Fix</th>
                </tr>
              </thead>
              <tbody>
                {negatives.rows.map((r) => (
                  <tr key={r.monthlyWalletId} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.partyCode}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate" title={r.partyName}>{r.partyName}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.wallet}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-700 font-semibold whitespace-nowrap">
                      {fmt(r.balance)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{fmt(r.shortfall)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => {
                          setFixRow(r);
                          setFixTarget(r.candidates.find((c) => c.canCover && !c.isHold)?.monthlyWalletId || '');
                          setFixReason('');
                          setFixError('');
                        }}
                        className="px-3 py-1.5 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[11px] font-bold rounded-lg cursor-pointer">
                        Move
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Move the shortfall */}
      {fixRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setFixRow(null)}>
          <div className="bg-white rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto max-w-lg p-6 space-y-4 overflow-auto"
               onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-[18px] font-bold text-gray-900">Move the shortfall</h3>
              <p className="text-[13px] text-gray-500 mt-1">
                {fixRow.partyName} · {fixRow.partyCode}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-[13px]">
              <div className="flex justify-between px-4 py-2">
                <span className="text-gray-500">Wallet in deficit</span>
                <span className="font-medium">{fixRow.wallet}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-gray-500">Its balance</span>
                <span className="font-medium text-red-700 tabular-nums">{fmt(fixRow.balance)}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-gray-500">Amount to move</span>
                <span className="font-bold tabular-nums">{fmt(fixRow.shortfall)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Take it from
              </label>
              <select value={fixTarget} onChange={(e) => setFixTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] cursor-pointer focus:outline-none focus:border-[#2B3B8A]">
                <option value="">Select the wallet it should have come from…</option>
                {fixRow.candidates.map((c) => (
                  <option key={c.monthlyWalletId} value={c.monthlyWalletId} disabled={!c.canCover}>
                    {c.label} — balance {fmt(c.balance)}
                    {c.isHold ? ' (on hold)' : ''}
                    {!c.canCover ? ' — not enough' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Only wallets holding at least {fmt(fixRow.shortfall)} can be used —
                otherwise this would just move the deficit elsewhere.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Reason — recorded on the party statement
              </label>
              <textarea value={fixReason} onChange={(e) => setFixReason(e.target.value)} rows={2}
                placeholder="e.g. Over-deducted from June by a system bug, should have come from July"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
            </div>

            {fixError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {fixError}
              </div>
            )}

            <p className="text-[11px] text-gray-500 leading-relaxed">
              Two entries are added to the party statement — the return and the
              re-application — so the correction is visible rather than silent.
              The party&rsquo;s total balance is unchanged.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setFixRow(null)} disabled={fixBusy}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={applyFix}
                disabled={fixBusy || !fixTarget || fixReason.trim().length < 10}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-[#2B3B8A] hover:bg-[#222f70] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl cursor-pointer">
                {fixBusy ? 'Moving…' : 'Move shortfall'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-gray-500 py-12 text-center">Checking the data…</p>
      )}

      {data && (
        <>
          {/* Headline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className={`rounded-2xl p-5 border shadow-sm ${
              data.headline.totalIssues === 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Issues found</p>
              <h3 className={`text-3xl font-bold mt-1 tabular-nums ${
                data.headline.totalIssues === 0 ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {data.headline.totalIssues}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                {data.headline.cleanSections} of {data.headline.totalSections} checks clean
              </p>
            </div>

            <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Value at risk</p>
              <h3 className="text-3xl font-bold text-[#2B3B8A] mt-1 tabular-nums">
                {fmt(data.headline.valueAtRisk)}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Money that cannot be accounted for</p>
            </div>

            <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Last checked</p>
              <h3 className="text-lg font-bold text-gray-900 mt-2">
                {new Date(data.generatedAt).toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Took {(data.tookMs / 1000).toFixed(1)}s</p>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {SECTIONS.map(({ key, title, why, cols }) => {
              const s = data.sections[key];
              if (!s) return null;
              const clean = s.count === 0;
              const isOpen = openKey === key;

              return (
                <div key={key} className={`rounded-2xl border shadow-sm overflow-hidden ${
                  clean ? 'border-gray-100 bg-white' : 'border-red-200 bg-white'
                }`}>
                  <button
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    disabled={clean}
                    className={`w-full text-left px-5 py-4 flex items-start gap-4 ${
                      clean ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    <span className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                      clean ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
                        <span className={`text-[13px] font-semibold tabular-nums ${
                          clean ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {clean ? 'None' : `${s.count} found`}
                        </span>
                        {!clean && s.value !== 0 && (
                          <span className="text-[13px] text-gray-600 tabular-nums">{fmt(s.value)}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{why}</p>
                      {s.note && (
                        <p className="text-[12px] text-amber-700 mt-1.5 leading-relaxed">{s.note}</p>
                      )}
                    </div>

                    {!clean && (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth={2} stroke="currentColor"
                        className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                  </button>

                  {isOpen && !clean && (
                    <div className="border-t border-gray-100">
                      <div className="px-5 py-2 flex justify-end">
                        <button
                          onClick={() => downloadCsv(s, cols)}
                          className="text-[12px] font-semibold text-[#2B3B8A] hover:underline cursor-pointer"
                        >
                          Download CSV
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[420px]">
                        <table className="w-full text-[13px]">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                              {cols.map(([k, label, type]) => (
                                <th key={k} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${
                                  type === 'money' ? 'text-right' : ''
                                }`}>{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.rows.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                                {cols.map((c) => (
                                  <td key={c[0]} className={`px-4 py-2.5 whitespace-nowrap ${
                                    c[2] === 'money' ? 'text-right tabular-nums' : ''
                                  }`}>
                                    {cell(row, c)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {s.rows.length < s.count && (
                        <p className="px-5 py-3 text-[12px] text-gray-500 border-t border-gray-100">
                          Showing the first {s.rows.length} of {s.count}. Download the CSV for all.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
