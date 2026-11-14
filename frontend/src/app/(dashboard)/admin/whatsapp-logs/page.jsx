'use client';

import React, { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const PURPOSE_LABEL = {
  otp: 'Redemption OTP',
  redemption_confirm: 'Redemption confirmation',
  incentive_credit: 'Incentive credit notice',
  test: 'Test OTP',
};
const STATUS_STYLE = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  dev: 'bg-gray-100 text-gray-600 border-gray-200',
};
const STATUS_LABEL = { sent: 'Accepted', failed: 'Failed', dev: 'Dev (not sent)' };
const n = (v) => Number(v || 0).toLocaleString('en-IN');

export default function WhatsAppLogsPage() {
  const [tab, setTab] = useState('logs'); // logs | numbers

  // Stats
  const [stats, setStats] = useState(null);

  // Logs
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState(null);

  // Test
  const [testMobile, setTestMobile] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  // Invalid numbers
  const [badNumbers, setBadNumbers] = useState(null);

  const loadStats = useCallback(() => {
    fetch(`${API}/api/messages/stats?days=7`, { headers: authHeaders(), credentials: 'include' })
      .then((r) => r.json()).then((d) => d.success && setStats(d.data)).catch(() => {});
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 25 });
      if (status) p.append('status', status);
      if (purpose) p.append('purpose', purpose);
      if (q) p.append('q', q);
      if (from) p.append('from', from);
      if (to) p.append('to', to);
      const res = await fetch(`${API}/api/messages/logs?${p}`, { headers: authHeaders(), credentials: 'include' });
      const d = await res.json();
      if (res.ok) { setRows(d.data); setPagination(d.pagination); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [status, purpose, q, from, to]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLogs(1); }, [loadLogs]);

  useEffect(() => {
    if (tab === 'numbers' && badNumbers === null) {
      fetch(`${API}/api/messages/invalid-mobiles`, { headers: authHeaders(), credentials: 'include' })
        .then((r) => r.json()).then((d) => setBadNumbers(d.success ? d.data : [])).catch(() => setBadNumbers([]));
    }
  }, [tab, badNumbers]);

  const sendTest = async (e) => {
    e.preventDefault();
    setTestBusy(true); setTestError(''); setTestResult(null);
    try {
      const res = await fetch(`${API}/api/messages/test`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ mobile: testMobile }),
      });
      const d = await res.json();
      if (!res.ok) { setTestError(d.message || 'Test failed'); return; }
      setTestResult(d.data);
      loadLogs(1); loadStats();
    } catch { setTestError('Could not reach the server'); }
    finally { setTestBusy(false); }
  };

  const failRate = stats && (stats.totals.sent + stats.totals.failed) > 0
    ? Math.round((stats.totals.failed / (stats.totals.sent + stats.totals.failed)) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 md:p-10 max-w-[1500px] mx-auto space-y-6">
      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">WhatsApp Logs</h1>
        <p className="text-[13px] text-gray-500 mt-1 max-w-3xl">
          Every WhatsApp message the system tries to send — OTPs, redemption confirmations and incentive notices.
          <strong> Accepted</strong> means BhashSMS took the message; whether WhatsApp then delivered it is not
          reported back.
        </p>
      </div>

      {/* Summary + test */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[12px] text-gray-500">Accepted (7 days)</p>
            <p className="text-[24px] font-bold text-emerald-600">{stats ? n(stats.totals.sent) : '…'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[12px] text-gray-500">Failed (7 days)</p>
            <p className="text-[24px] font-bold text-red-600">{stats ? n(stats.totals.failed) : '…'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[12px] text-gray-500">Failure rate</p>
            <p className="text-[24px] font-bold text-gray-900">{stats ? `${failRate}%` : '…'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[12px] text-gray-500">Provider</p>
            <p className="text-[18px] font-bold text-[#2B3B8A] mt-1 uppercase">{stats?.provider || '…'}</p>
          </div>
          <div className="col-span-2 md:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[13px] font-semibold text-gray-800 mb-2">Most common failure reasons (7 days)</p>
            {!stats ? <p className="text-[12px] text-gray-400">Loading…</p>
              : stats.topErrors.length === 0 ? <p className="text-[12px] text-gray-400">No failures in the last 7 days.</p>
              : (
                <ul className="space-y-1.5">
                  {stats.topErrors.map((e, i) => (
                    <li key={i} className="flex items-start justify-between gap-4 text-[13px]">
                      <span className="text-gray-700">{e.reason}</span>
                      <span className="shrink-0 font-semibold text-red-600">{n(e.count)}×</span>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>

        {/* Test OTP service */}
        <form onSubmit={sendTest} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Test OTP Service</h2>
            <p className="text-[12px] text-gray-500">Sends a test OTP through the live WhatsApp service and shows the full reply.</p>
          </div>
          <div className="flex gap-2">
            <input value={testMobile} onChange={(e) => setTestMobile(e.target.value)} placeholder="10-digit mobile number"
              inputMode="tel"
              className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-[#2B3B8A]" />
            <button type="submit" disabled={testBusy || !testMobile.trim()}
              className="px-4 py-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl">
              {testBusy ? 'Sending…' : 'Send test'}
            </button>
          </div>
          {testError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{testError}</div>}
          {testResult && (
            <div className={`rounded-xl border px-3 py-3 text-[13px] space-y-1.5 ${testResult.sent ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <p className={`font-bold ${testResult.sent ? 'text-emerald-700' : 'text-red-700'}`}>
                {testResult.dev ? 'Dev mode — nothing was sent (SMS_PROVIDER is empty)'
                  : testResult.sent ? `Accepted by ${String(testResult.provider).toUpperCase()}` : 'Failed'}
              </p>
              {testResult.error && <p className="text-red-700">{testResult.error}</p>}
              <p className="text-gray-600">To: {testResult.mobile || '—'} · Test code: <span className="font-mono font-semibold">{testResult.otp}</span> · {testResult.durationMs} ms</p>
              {testResult.providerResponse && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Provider reply</p>
                  <pre className="mt-1 p-2 bg-white border border-gray-200 rounded-lg text-[11px] whitespace-pre-wrap break-all max-h-32 overflow-auto">{testResult.providerResponse}</pre>
                </div>
              )}
              {testResult.sent && !testResult.dev && (
                <p className="text-[12px] text-gray-500">Check the phone: if the code does not arrive, the problem is after BhashSMS (number not on WhatsApp, template paused, etc.).</p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Tabs */}
      <div className="inline-flex p-1 bg-gray-100 rounded-xl">
        {[['logs', 'Message Log'], ['numbers', 'Invalid Mobile Numbers']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold ${tab === k ? 'bg-white text-[#2B3B8A] shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'logs' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white">
                <option value="">All</option><option value="sent">Accepted</option><option value="failed">Failed</option><option value="dev">Dev</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white">
                <option value="">All</option>
                {Object.entries(PURPOSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-[13px]" />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); }} className="flex gap-2">
              <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Mobile, party code, name, invoice…"
                className="w-64 px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
              <button className="px-4 py-2 bg-[#2B3B8A] text-white text-[13px] font-semibold rounded-xl">Search</button>
            </form>
            {(status || purpose || q || from || to) && (
              <button onClick={() => { setStatus(''); setPurpose(''); setQ(''); setQInput(''); setFrom(''); setTo(''); }}
                className="px-3 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">Clear</button>
            )}
            <span className="ml-auto text-[12px] text-gray-500">{n(pagination.total)} messages</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reason / Reply</th>
                  <th className="py-3 px-4">By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">No messages found.</td></tr>
                ) : rows.map((r) => (
                  <React.Fragment key={r._id}>
                    <tr onClick={() => setExpanded(expanded === r._id ? null : r._id)}
                      className="border-b border-gray-50 hover:bg-[#F8FAFF] cursor-pointer">
                      <td className="py-2.5 px-4 text-gray-600">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4">{PURPOSE_LABEL[r.purpose] || r.purpose}</td>
                      <td className="py-2.5 px-4">
                        {r.partyCode ? <><span className="font-mono text-[#2B3B8A]">{r.partyCode}</span> · {r.partyName}</> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{r.mobile || r.mobileRaw || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${STATUS_STYLE[r.status] || ''}`}>{STATUS_LABEL[r.status] || r.status}</span>
                      </td>
                      <td className="py-2.5 px-4 max-w-[380px] truncate" title={r.error || r.providerResponse || ''}>
                        {r.error ? <span className="text-red-700">{r.error}</span> : <span className="text-gray-500">{r.providerMessageId ? `ID ${r.providerMessageId}` : r.providerResponse || '—'}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">{r.triggeredByName || '—'}</td>
                    </tr>
                    {expanded === r._id && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={7} className="px-4 py-3 text-[12px] text-gray-700 whitespace-normal">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            <p><strong>Provider:</strong> {r.provider || '—'} · <strong>Template:</strong> {r.template || '—'}</p>
                            <p><strong>Mobile on record:</strong> {r.mobileRaw || '—'} · <strong>Sent to:</strong> {r.mobile || '—'}</p>
                            <p><strong>Reference:</strong> {r.reference || '—'}</p>
                            <p><strong>HTTP:</strong> {r.httpStatus ?? '—'} · <strong>Time taken:</strong> {r.durationMs ?? '—'} ms</p>
                          </div>
                          {r.providerResponse && (
                            <pre className="mt-2 p-2 bg-white border border-gray-200 rounded-lg text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-auto">{r.providerResponse}</pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-end gap-2 border-t border-gray-100 text-[13px]">
              <button disabled={pagination.page <= 1} onClick={() => loadLogs(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40">‹ Prev</button>
              <span className="text-gray-600">Page {pagination.page} of {pagination.pages}</span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => loadLogs(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40">Next ›</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <p className="text-[13px] text-gray-600">
              Parties whose mobile number is not a clean 10-digit number. <strong>Cannot send</strong> rows will never
              receive an OTP until corrected in Party List → Edit. <strong>Sends after cleaning</strong> rows work, but
              saving the party once will store the clean number.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-3 px-4">Party Code</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Mobile on record</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Problem</th>
                </tr>
              </thead>
              <tbody>
                {badNumbers === null ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Checking all parties…</td></tr>
                ) : badNumbers.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Every party has a valid mobile number.</td></tr>
                ) : badNumbers.map((b) => (
                  <tr key={b.vendorId} className="border-b border-gray-50">
                    <td className="py-2.5 px-4 font-mono text-[#2B3B8A]">{b.accountNumber}</td>
                    <td className="py-2.5 px-4">{b.companyName}</td>
                    <td className="py-2.5 px-4">{b.branch}</td>
                    <td className="py-2.5 px-4 font-mono">{b.mobileNumber || <span className="text-gray-300">empty</span>}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${b.fixable ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {b.fixable ? 'Sends after cleaning' : 'Cannot send'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{b.reason}{b.cleaned ? ` → ${b.cleaned}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
