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
 * POINT 14 — admin redemption, for when the OTP cannot reach the party.
 *
 * This spends a party's money without their approval, so the screen is
 * deliberately more work than the counter: a mandatory reason, a full
 * confirmation showing every figure, and the amount typed by hand.
 */
export default function AdminRedeemPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [divisions, setDivisions] = useState([]);

  const [form, setForm] = useState({
    invoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceAmount: '', redeemAmount: '', divisionId: '', remark: '',
  });
  const [splits, setSplits] = useState({});      // monthlyWalletId -> amount
  const [useSplit, setUseSplit] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [typedAmount, setTypedAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setDivisions(d.data || []); })
      .catch(() => {});
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setError('');
    setResults([]);
    try {
      const res = await fetch(`${API}/api/vendors/search?q=${encodeURIComponent(query.trim())}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || 'No party found for that search');
        return;
      }

      // This endpoint returns a SINGLE vendor object, not an array.
      const list = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
      if (list.length === 0) {
        setError('No party found for that search');
        return;
      }
      setResults(list);
      if (list.length === 1) pick(list[0]);
    } catch { setError('Could not reach the server'); }
  };

  const pick = async (v) => {
    setVendor(v);
    setResults([]);
    setSplits({});
    try {
      const res = await fetch(`${API}/api/incentives/monthly-wallets/${v._id}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      setWallets(json.data || []);
    } catch { setWallets([]); }
  };

  const splitTotal = Object.values(splits).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const redeemAmt = parseFloat(form.redeemAmount) || 0;
  const splitMismatch = useSplit && Math.abs(splitTotal - redeemAmt) > 0.01;

  const canProceed =
    vendor && form.invoiceNumber.trim() && form.invoiceDate &&
    parseFloat(form.invoiceAmount) > 0 && redeemAmt > 0 &&
    redeemAmt <= parseFloat(form.invoiceAmount) &&
    redeemAmt <= (vendor?.walletBalance || 0) &&
    form.divisionId && !splitMismatch;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const body = {
        vendorId: vendor._id,
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate,
        invoiceAmount: parseFloat(form.invoiceAmount),
        redeemAmount: redeemAmt,
        divisionId: form.divisionId,
        remark: form.remark,
        reason: reason.trim(),
        confirmAmount: parseFloat(typedAmount),
        redemptionList: useSplit
          ? Object.entries(splits)
              .filter(([, v]) => parseFloat(v) > 0)
              .map(([monthlyWalletId, amount]) => ({ monthlyWalletId, amount: parseFloat(amount) }))
          : undefined,
      };

      const res = await fetch(`${API}/api/invoices/admin-redeem`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setDone(json.data);
        setConfirmOpen(false);
        setVendor(null);
        setWallets([]);
        setForm({ invoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10),
          invoiceAmount: '', redeemAmount: '', divisionId: '', remark: '' });
        setSplits({});
        setReason('');
        setTypedAmount('');
      } else {
        setError(json.message || 'Could not complete the redemption');
      }
    } catch { setError('Could not reach the server'); }
    finally { setBusy(false); }
  };

  const Label = ({ children }) => (
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
  const input = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:border-[#2B3B8A]';

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-[1000px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Redemption</h1>
        <p className="text-sm text-gray-500 mt-1">
          For when the OTP cannot reach the party. Every use is recorded and reviewable.
        </p>
      </div>

      {/* This screen spends money without the party's approval. Say so. */}
      <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2}
          stroke="currentColor" className="w-6 h-6 text-amber-600 shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-[15px] font-bold text-amber-900">This bypasses party approval</p>
          <p className="text-[13px] text-amber-800 mt-1">
            Normally a party must supply an OTP before their balance is spent. Use
            this only when that is genuinely not possible — the SMS service is down,
            or the party has confirmed by phone. Every use appears in the override
            report with your name and reason.
          </p>
        </div>
      </div>

      {done && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-[15px] font-bold text-emerald-800">Redemption completed</p>
          <p className="text-[13px] text-emerald-700 mt-1">
            Reference <strong>{done.referenceNo}</strong> · Remaining balance {fmt(done.newBalance)}
          </p>
          <p className={`text-[12px] mt-1.5 ${done.partyNotified ? 'text-emerald-700' : 'text-amber-700'}`}>
            {done.partyNotified
              ? 'The party has been notified by message.'
              : '⚠️ The party could NOT be notified — tell them directly.'}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      )}

      {/* Party */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <Label>Party</Label>
        {!vendor ? (
          <>
            <div className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Party Code, name or mobile number" className={input + ' max-w-md'} />
              <button onClick={search}
                className="px-5 py-2 bg-[#2B3B8A] hover:bg-[#222f70] text-white text-[13px] font-semibold rounded-xl cursor-pointer">
                Search
              </button>
            </div>
            {results.length > 1 && (
              <div className="mt-3 border border-gray-100 rounded-xl overflow-hidden">
                {results.map((v) => (
                  <button key={v._id} onClick={() => pick(v)}
                    className="w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer text-[13px]">
                    <span className="font-semibold">{v.accountNumber}</span>
                    <span className="text-gray-600 ml-3">{v.companyName}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold text-gray-900">{vendor.companyName}</p>
              <p className="text-[13px] text-gray-500">
                {vendor.accountNumber} · {vendor.mobileNumber} · Balance{' '}
                <strong className="text-[#2B3B8A]">{fmt(vendor.walletBalance)}</strong>
              </p>
            </div>
            <button onClick={() => { setVendor(null); setWallets([]); }}
              className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer">
              Change
            </button>
          </div>
        )}
      </div>

      {vendor && (
        <>
          {/* Invoice */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <input value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                placeholder="1/RS/40012287" className={input} />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <input type="date" value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className={input} />
            </div>
            <div>
              <Label>Invoice Amount</Label>
              <input type="number" value={form.invoiceAmount}
                onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                className={input + ' tabular-nums'} />
            </div>
            <div>
              <Label>Redemption Amount</Label>
              <input type="number" value={form.redeemAmount}
                onChange={(e) => setForm({ ...form, redeemAmount: e.target.value })}
                className={input + ' tabular-nums'} />
              {redeemAmt > (vendor.walletBalance || 0) && (
                <p className="text-[11px] text-red-600 mt-1">Exceeds the available balance</p>
              )}
            </div>
            <div>
              {/* The admin chooses the branch — this is the point of the screen */}
              <Label>Book under branch</Label>
              <select value={form.divisionId}
                onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                className={input + ' cursor-pointer'}>
                <option value="">Select a branch…</option>
                {divisions.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Remark (optional)</Label>
              <input value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })} className={input} />
            </div>
          </div>

          {/* Wallets */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <Label>Wallets</Label>
              <label className="flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer">
                <input type="checkbox" checked={useSplit}
                  onChange={(e) => { setUseSplit(e.target.checked); setSplits({}); }}
                  className="cursor-pointer" />
                Choose wallets manually
              </label>
            </div>

            {wallets.length === 0 ? (
              <p className="text-[13px] text-gray-500">No wallets with a balance.</p>
            ) : !useSplit ? (
              <p className="text-[13px] text-gray-500">
                Oldest month first, skipping anything on hold.
              </p>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div key={w._id} className="flex items-center justify-between gap-4 border border-gray-100 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900">{w.label}</p>
                      <p className="text-[11px] text-gray-500 tabular-nums">Available {fmt(w.balance)}</p>
                    </div>
                    <input type="number" placeholder="0"
                      value={splits[w._id] || ''}
                      onChange={(e) => setSplits({ ...splits, [w._id]: e.target.value })}
                      max={w.balance}
                      className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-[13px] tabular-nums text-right focus:outline-none focus:border-[#2B3B8A]" />
                  </div>
                ))}
                <p className={`text-[12px] tabular-nums ${splitMismatch ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  Split total {fmt(splitTotal)} of {fmt(redeemAmt)}
                  {splitMismatch && ' — these must match'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => { setReason(''); setTypedAmount(''); setConfirmOpen(true); }}
            disabled={!canProceed}
            className="w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl cursor-pointer">
            Continue to confirmation
          </button>
        </>
      )}

      {/* ── Confirmation ─────────────────────────────────────────────────── */}
      {confirmOpen && vendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-auto p-6 space-y-4">
            <div>
              <h3 className="text-[18px] font-bold text-gray-900">Confirm this redemption</h3>
              <p className="text-[13px] text-amber-700 mt-1 font-medium">
                The party has not approved this. Their balance will be reduced.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-[13px]">
              {[
                ['Party', `${vendor.companyName} (${vendor.accountNumber})`],
                ['Mobile Number', vendor.mobileNumber],
                ['Current balance', fmt(vendor.walletBalance)],
                ['Redemption amount', fmt(redeemAmt)],
                ['Balance after', fmt((vendor.walletBalance || 0) - redeemAmt)],
                ['Invoice', `${form.invoiceNumber} · ${fmt(parseFloat(form.invoiceAmount) || 0)}`],
                ['Branch', divisions.find((d) => d._id === form.divisionId)?.name || ''],
                ['Wallets', useSplit
                  ? Object.entries(splits).filter(([, v]) => parseFloat(v) > 0)
                      .map(([id, v]) => `${wallets.find((w) => w._id === id)?.label}: ${fmt(v)}`).join(', ')
                  : 'Oldest month first'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-900 font-medium text-right">{v}</span>
                </div>
              ))}
            </div>

            <div>
              <Label>Reason — recorded against this redemption</Label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="e.g. SMS service down, party confirmed by phone"
                className={input} />
              {reason.trim().length > 0 && reason.trim().length < 10 && (
                <p className="text-[11px] text-amber-700 mt-1">Please give a fuller reason.</p>
              )}
            </div>

            <div>
              <Label>Type the amount to confirm</Label>
              <input type="number" value={typedAmount}
                onChange={(e) => setTypedAmount(e.target.value)}
                placeholder={String(redeemAmt)}
                className={input + ' tabular-nums'} />
              <p className="text-[11px] text-gray-500 mt-1">
                Type {fmt(redeemAmt)} exactly. A single click is too easy on a screen
                that spends someone else&rsquo;s money.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmOpen(false)} disabled={busy}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={submit}
                disabled={busy || reason.trim().length < 10 || parseFloat(typedAmount) !== redeemAmt}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl cursor-pointer">
                {busy ? 'Processing…' : 'Redeem without OTP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
