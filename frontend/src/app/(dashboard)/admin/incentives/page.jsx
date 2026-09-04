'use client';

import React, { useState, useRef, useEffect } from 'react';
import SortableTh from '@/components/SortableTh';
import useClientSort from '@/components/useClientSort';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const downloadTemplate = () => {
  const csvContent = ['party_code,amount,remark', 'JDH-7792811100,5000,March incentive'].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'incentive_upload_template.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Fix Missing Wallets Panel — reads existing uploads, creates MonthlyWallet docs only ──
function FixMissingWalletsPanel({ API, authHeaders }) {
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState(null);
  const [fixing, setFixing] = useState(null); // uploadId being fixed
  const [fixResults, setFixResults] = useState({}); // { [uploadId]: result }
  const [error, setError] = useState('');

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const loadUploads = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/incentives/uploads-without-wallets`, {
        headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to load'); return; }
      setUploads(data.data);
    } catch (err) {
      setError('Server error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async (uploadId, month, year) => {
    setFixing(uploadId);
    try {
      const res = await fetch(`${API}/api/incentives/create-wallets-from-upload/${uploadId}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      setFixResults(prev => ({ ...prev, [uploadId]: data }));
      // Refresh list
      loadUploads();
    } catch (err) {
      setFixResults(prev => ({ ...prev, [uploadId]: { success: false, message: err.message } }));
    } finally {
      setFixing(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-orange-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Fix Missing Monthly Wallets
          </h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Agar kisi purane upload ka monthly wallet nahi bana — yahan se directly fix karo. Koi vendor balance ya transaction change nahi hoga.
          </p>
        </div>
        <button
          onClick={loadUploads}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-[13px] transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Loading...
            </>
          ) : 'Check Uploads →'}
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600 mb-4">{error}</div>}

      {uploads && (
        <div className="space-y-3">
          {uploads.length === 0 && (
            <div className="p-4 bg-[#E4F8ED] border border-green-200 rounded-xl text-[13px] text-green-800 font-medium">
              ✓ Sab uploads ke monthly wallets already exist hain — kuch fix karne ki zaroorat nahi
            </div>
          )}
          {uploads.map((u) => {
            const fixResult = fixResults[u._id];
            const allFixed = u.walletsMissing === 0;
            return (
              <div key={u._id} className={`p-4 rounded-xl border text-[13px] ${allFixed ? 'bg-[#F0FDF4] border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{u.fileName}</span>
                      <span className="inline-flex items-center bg-[#EEF2FF] text-[#2B3B8A] text-[11px] font-bold px-2 py-0.5 rounded-lg">
                        {u.label}
                      </span>
                      <span className="text-gray-400 text-[11px]">{new Date(u.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-gray-500">Total: <b className="text-gray-800">{u.totalVendors} parties</b></span>
                      {allFixed ? (
                        <span className="text-[#16a34a] font-semibold">✓ All {u.walletsExist} wallets exist</span>
                      ) : (
                        <span className="text-orange-700 font-semibold">{u.walletsMissing} wallets missing</span>
                      )}
                    </div>
                  </div>
                  {!allFixed && (
                    <button
                      onClick={() => handleFix(u._id, u.month, u.year)}
                      disabled={fixing === u._id}
                      className="shrink-0 flex items-center gap-1.5 bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-[12px] transition-colors whitespace-nowrap"
                    >
                      {fixing === u._id ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Fixing...
                        </>
                      ) : `Create ${u.walletsMissing} Wallets →`}
                    </button>
                  )}
                </div>
                {/* Fix result */}
                {fixResult && (
                  <div className={`mt-3 p-3 rounded-lg text-[12px] font-medium ${fixResult.success ? 'bg-[#E4F8ED] text-green-800' : 'bg-red-50 text-red-700'}`}>
                    {fixResult.message}
                    {fixResult.success && fixResult.data && (
                      <span className="ml-2 text-gray-600">({fixResult.data.created} created, {fixResult.data.skipped} already existed)</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminIncentivesPage() {
  const [uploadState, setUploadState] = useState('idle'); // idle | otp | success | error
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // Month / Year for incentive upload
  const currentDate = new Date();
  const [uploadMonth, setUploadMonth] = useState(String(currentDate.getMonth() + 1)); // 1-12
  const [uploadYear, setUploadYear] = useState(String(currentDate.getFullYear()));
  const [monthYearError, setMonthYearError] = useState('');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRefs = useRef([]);
  const fileInputRef = useRef(null);

  // History state
  const [history, setHistory] = useState([]);

  // Point 11
  const { sort, setSort, sorted: sortedHistory } = useClientSort(history, {
    createdAt:   (h) => h.createdAt,
    fileName:    (h) => h.fileName,
    walletLabel: (h) => h.walletLabel,
    totalAmount: (h) => h.totalAmount || 0,
    frequency:   (h) => h.frequency,
    status:      (h) => h.status,
  });

  // Wallets selection for destination
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState('');

  useEffect(() => {
    fetchHistory();
    fetchWalletsList();
  }, []);

  const fetchWalletsList = async () => {
    try {
      const res = await fetch(`${API}/api/wallets`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) setWallets(data.data || []);
    } catch { /* silent */ }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/incentives/history`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setHistory(data.data);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadState('idle');
      setUploadError('');
      setUploadResult(null);
    }
  };

  // Step 1: Send OTP to EMAIL_USER
  const handleUploadClick = async () => {
    if (!selectedFile) { alert('Please select a file first'); return; }
    // Validate month/year
    const m = parseInt(uploadMonth);
    const y = parseInt(uploadYear);
    if (!m || m < 1 || m > 12) { setMonthYearError('Please select a valid month'); return; }
    if (!y || y < 2020 || y > 2100) { setMonthYearError('Please enter a valid year'); return; }
    setMonthYearError('');
    setSendingOtp(true);
    setOtpError('');
    try {
      const res = await fetch(`${API}/api/incentives/send-otp`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.message || 'OTP send failed'); setUploadState('error'); return; }
      setOtpEmail(data.email);
      setUploadState('otp');
      setOtp(['', '', '', '', '', '']);
    } catch { setUploadError('Server error'); setUploadState('error'); }
    finally { setSendingOtp(false); }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  // ── POINT 2 — duplicate confirmation ─────────────────────────────────────
  const [dupData, setDupData] = useState(null);      // preview from the server
  const [dupTicked, setDupTicked] = useState({});    // partCode -> boolean
  const [dupBusy, setDupBusy] = useState(false);

  const buildForm = () => {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('otp', otp.join(''));
    formData.append('frequency', 'monthly');
    formData.append('month', uploadMonth);
    formData.append('year', uploadYear);
    if (selectedWalletId) formData.append('walletId', selectedWalletId);
    return formData;
  };

  // Step 2: Verify OTP + Upload file
  const handleVerifyOTP = async (mode = null) => {
    if (otp.join('').length < 6) { setOtpError('Enter 6-digit OTP'); return; }
    setIsVerifying(true);
    setIsUploading(true);
    setDupBusy(true);
    try {
      const formData = buildForm();

      if (mode) {
        formData.append('confirmDuplicates', mode);
        // Rows the admin unticked are excluded from whichever action was chosen
        const excluded = (dupData?.duplicates || [])
          .filter((d) => dupTicked[d.partCode] === false)
          .map((d) => d.partCode);
        formData.append('excludedCodes', JSON.stringify(excluded));
      }

      const res = await fetch(`${API}/api/incentives/upload`, {
        method: 'POST', headers: authHeaders(), credentials: 'include', body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setOtpError(data.message || 'Upload failed');
        return;
      }

      // Server found existing balances and wrote nothing — ask the admin
      if (data.requiresConfirmation) {
        setDupData(data);
        setDupTicked(Object.fromEntries(data.duplicates.map((d) => [d.partCode, true])));
        return;
      }

      setDupData(null);
      setUploadResult(data.data);
      setUploadState('success');
      setSelectedFile(null);
      fetchHistory();
    } catch { setUploadError('Server error. Is backend running?'); setUploadState('error'); }
    finally { setIsVerifying(false); setIsUploading(false); setDupBusy(false); }
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Upload Incentives History', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Upload Date', 'File Name', 'Incentive Month', 'Total Amount', 'Frequency', 'Status']],
      body: history.map((row, i) => [String(i+1).padStart(2,'0'), new Date(row.createdAt).toLocaleDateString('en-IN'), row.fileName, row.walletLabel || '—', `Rs. ${row.totalAmount?.toFixed(2)}`, row.frequency, row.status]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('incentive_upload_history.pdf');
  };

  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Upload Date', 'File Name', 'Incentive Month', 'Total Amount (Rs.)', 'Frequency', 'Status'],
      ...history.map((row, i) => [i+1, new Date(row.createdAt).toLocaleDateString('en-IN'), row.fileName, row.walletLabel || '—', row.totalAmount?.toFixed(2), row.frequency, row.status]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, 'incentive_upload_history.xlsx');
  };

  return (
    <div className="p-4 sm:p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">

      {/* ── POINT 2 — duplicate upload confirmation ─────────────────────── */}
      {dupData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto max-w-4xl max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-[18px] font-bold text-gray-900">
                {dupData.duplicates.length} part{dupData.duplicates.length === 1 ? 'y' : 'ies'} already
                have a balance for {dupData.scheme}
              </h3>
              <p className="text-[13px] text-gray-500 mt-1">
                Nothing has been uploaded yet. Choose what should happen to these parties.
                {dupData.newParties > 0 && (
                  <> The other <strong>{dupData.newParties}</strong> part
                  {dupData.newParties === 1 ? 'y' : 'ies'} in this file will be credited normally.</>
                )}
              </p>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={dupData.duplicates.every((d) => dupTicked[d.partCode] !== false)}
                        onChange={(e) =>
                          setDupTicked(Object.fromEntries(
                            dupData.duplicates.map((d) => [d.partCode, e.target.checked])
                          ))
                        }
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 font-semibold">Party Code</th>
                    <th className="px-3 py-3 font-semibold">Party Name</th>
                    <th className="px-3 py-3 font-semibold text-right">Already Credited</th>
                    <th className="px-3 py-3 font-semibold text-right">Current Balance</th>
                    <th className="px-3 py-3 font-semibold text-right">New Amount</th>
                    <th className="px-3 py-3 font-semibold text-right">If ADD</th>
                    <th className="px-3 py-3 font-semibold text-right">If REPLACE</th>
                  </tr>
                </thead>
                <tbody>
                  {dupData.duplicates.map((d) => {
                    const ticked = dupTicked[d.partCode] !== false;
                    return (
                      <tr key={d.partCode}
                        className={`border-t border-gray-100 ${ticked ? '' : 'opacity-40'} ${
                          d.replaceWouldGoNegative ? 'bg-red-50/60' : ''
                        }`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={ticked}
                            onChange={(e) => setDupTicked({ ...dupTicked, [d.partCode]: e.target.checked })}
                            className="cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{d.partCode}</td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate" title={d.partyName}>{d.partyName}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">₹{d.alreadyCredited.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">₹{d.currentBalance.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">₹{d.newAmount.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">₹{d.ifAdd.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {d.replaceWouldGoNegative ? (
                            <span className="text-red-700 font-semibold"
                              title={`₹${d.alreadyRedeemed.toFixed(2)} already redeemed — replace would go negative`}>
                              not possible
                            </span>
                          ) : (
                            <span className="text-amber-700">₹{d.ifReplace.toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="text-[12px] text-gray-500 leading-relaxed">
                <strong>Add</strong> puts the new amount on top of the existing balance —
                use this when the file contains a shortfall.{' '}
                <strong>Replace</strong> treats the new amount as the corrected total.
                Rows marked <span className="text-red-700 font-semibold">not possible</span> have
                already been partly redeemed, so replacing would create a negative balance;
                those rows will be reported as failed.
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => setDupData(null)} disabled={dupBusy}
                  className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
                  Cancel
                </button>
                <button onClick={() => handleVerifyOTP('skip')} disabled={dupBusy}
                  className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer disabled:opacity-50">
                  Skip these parties
                </button>
                <button onClick={() => handleVerifyOTP('replace')} disabled={dupBusy}
                  className="px-4 py-2 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer disabled:opacity-50">
                  Replace existing
                </button>
                <button onClick={() => handleVerifyOTP('add')} disabled={dupBusy}
                  className="px-4 py-2 text-[13px] font-semibold text-white bg-[#2B3B8A] hover:bg-[#222f70] rounded-xl cursor-pointer disabled:opacity-50">
                  Add to existing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row min-h-[350px] overflow-hidden">

        {/* Left: Upload Form */}
        <div className="w-full md:w-1/2 p-8 md:p-10 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-center">
          <h2 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">Upload Incentives</h2>

          <div className="space-y-4">
            <label className="block text-[15px] text-gray-800">Upload Party Incentives Amount (Excel/CSV)</label>

            {/* Month / Year selector */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[13px] font-medium text-gray-700">Incentive Month</label>
                <select
                  value={uploadMonth}
                  onChange={(e) => { setUploadMonth(e.target.value); setMonthYearError(''); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={String(idx + 1)}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-[130px] space-y-1">
                <label className="text-[13px] font-medium text-gray-700">Year</label>
                <input
                  type="number"
                  value={uploadYear}
                  onChange={(e) => { setUploadYear(e.target.value); setMonthYearError(''); }}
                  placeholder="2025"
                  min="2020"
                  max="2100"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]"
                />
              </div>
            </div>

            {/* Destination Wallet Selector */}
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-gray-700">Destination Wallet</label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white font-medium"
              >
                <option value="">Auto-create / Auto-select for Month ({MONTH_NAMES[parseInt(uploadMonth) - 1]} {uploadYear})</option>
                {wallets.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.isHold ? '(ON HOLD)' : ''} — Bal: ₹{w.totalBalance.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>

            {monthYearError && (
              <p className="text-red-500 text-[12px] -mt-1">{monthYearError}</p>
            )}

            {/* Selected month preview pill */}
            {uploadMonth && uploadYear && !monthYearError && (
              <div className="inline-flex items-center gap-2 bg-[#EEF2FF] border border-[#2B3B8A]/20 rounded-lg px-3 py-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-[#2B3B8A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-[12px] font-semibold text-[#2B3B8A]">
                  Crediting incentives for: {MONTH_NAMES[parseInt(uploadMonth) - 1]} {uploadYear}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 px-4 py-3 rounded-xl border border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className={`text-sm truncate ${selectedFile ? 'text-gray-900 font-medium' : 'text-[#A0ABC0]'}`}>
                  {selectedFile ? selectedFile.name : 'Choose file...'}
                </span>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx,.xls" className="hidden" />
              <button onClick={handleUploadClick}
                disabled={!selectedFile || uploadState === 'otp' || isUploading || sendingOtp}
                className={`font-semibold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  selectedFile && uploadState !== 'otp' && !isUploading && !sendingOtp
                    ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md'
                    : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                }`}>
                {sendingOtp ? 'Sending OTP...' : 'Upload Incentives →'}
              </button>
            </div>

            {/* Template Download */}
            <div className="border border-dashed border-[#2B3B8A]/30 rounded-xl p-4 bg-[#F8FAFF]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-gray-800 mb-1">Required CSV Format</p>
                  <p className="text-[12px] text-gray-500 font-mono bg-white border border-gray-200 rounded-lg px-3 py-1.5 inline-block">
                    party_code &nbsp;|&nbsp; amount &nbsp;|&nbsp; remark
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  className="shrink-0 flex flex-col items-center gap-1.5 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white px-4 py-3 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span className="text-[11px] font-semibold whitespace-nowrap">Download Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dynamic State */}
        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center">

          {uploadState === 'idle' && <div />}

          {uploadState === 'otp' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-[22px] font-bold text-gray-900 mb-4 tracking-tight">Enter the 6-digit code</h3>
              <p className="text-[14px] text-gray-800 font-medium mb-6">
                Enter the OTP sent to <span className="font-bold text-[#2B3B8A]">{otpEmail}</span>
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                <div className="flex gap-2">
                  {otp.map((digit, index) => (
                    <input key={index} ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text" maxLength={1} value={digit} placeholder="-"
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-[45px] h-[50px] text-center text-lg font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white placeholder:text-gray-300"
                    />
                  ))}
                </div>
                <button onClick={handleVerifyOTP}
                  disabled={isVerifying || otp.join('').length < 6}
                  className={`font-semibold px-6 py-3 rounded-xl whitespace-nowrap flex items-center gap-2 transition-colors ${
                    isVerifying ? 'bg-[#00B65E] text-white'
                    : otp.join('').length === 6 ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
                    : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                  }`}>
                  {isVerifying ? '✓ Verifying...' : 'Verify OTP →'}
                </button>
              </div>
              {otpError && <p className="text-red-500 text-xs mt-2">{otpError}</p>}
            </div>
          )}

          {uploadState === 'success' && uploadResult && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#00B65E] rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-gray-900 tracking-tight">Upload Successful</h3>
                  <p className="text-[14px] text-gray-600 mt-1">Total credited: <span className="font-bold text-black">₹{uploadResult.totalAmount.toFixed(2)}</span></p>
                  {uploadResult.walletLabel && (
                    <p className="text-[13px] text-[#2B3B8A] font-semibold mt-0.5">
                      Wallet: {uploadResult.walletLabel}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#E4F8ED] rounded-xl p-4 text-center">
                  <p className="text-[28px] font-bold text-[#00B65E]">{uploadResult.successCount}</p>
                  <p className="text-[12px] text-gray-600 font-medium">Party Credited</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${uploadResult.failedCount > 0 ? 'bg-[#FDEDEC]' : 'bg-gray-50'}`}>
                  <p className={`text-[28px] font-bold ${uploadResult.failedCount > 0 ? 'text-[#E74C3C]' : 'text-gray-400'}`}>{uploadResult.failedCount}</p>
                  <p className="text-[12px] text-gray-600 font-medium">Failed</p>
                </div>
              </div>
              {uploadResult.failedList?.length > 0 && (
                <div className="bg-[#FDEDEC] rounded-xl p-4">
                  <p className="text-[13px] font-bold text-[#E74C3C] mb-2">Failed Records:</p>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {uploadResult.failedList.map((f, i) => (
                      <p key={i} className="text-[12px] text-gray-700"><span className="font-semibold">{f.partCode}</span> — {f.reason}</p>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { setUploadState('idle'); setUploadResult(null); }} className="text-[13px] text-[#2B3B8A] font-semibold hover:underline">
                Upload another file →
              </button>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="flex items-start gap-4 animate-in fade-in duration-300">
              <div className="w-10 h-10 bg-[#E74C3C] rounded-full flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-[20px] font-bold text-gray-900">Upload Failed</h3>
                <p className="text-[14px] text-red-600 mt-1">{uploadError}</p>
                <button onClick={() => setUploadState('idle')} className="mt-3 text-[13px] text-[#2B3B8A] font-semibold hover:underline">Try again →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Upload Incentives History</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Download In</span>
            <button onClick={downloadPDF} disabled={history.length === 0}
              className="bg-[#E74C3C] hover:bg-red-600 disabled:opacity-40 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors">PDF</button>
            <button onClick={downloadExcel} disabled={history.length === 0}
              className="bg-[#2ECC71] hover:bg-green-600 disabled:opacity-40 text-white text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors">XLS</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 text-gray-900">
                <th className="pb-4 pt-2 px-3 font-bold sticky left-0 bg-white z-10">#</th>
                <SortableTh field="createdAt" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Upload Date</SortableTh>
                <SortableTh field="fileName" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">File Name</SortableTh>
                <SortableTh field="walletLabel" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Incentive Month</SortableTh>
                <SortableTh field="totalAmount" sort={sort} setSort={setSort} align="right" className="pb-4 pt-2 px-3 font-bold">Incentives Total Amount</SortableTh>
                <SortableTh field="frequency" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Upload Frequency</SortableTh>
                <SortableTh field="status" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Status</SortableTh>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium">
              {Array.isArray(sortedHistory) && sortedHistory.length > 0 ? sortedHistory.map((row, i) => (
                <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-3">{String(i+1).padStart(2,'0')}</td>
                  <td className="py-4 px-3">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="py-4 px-3">{row.fileName}</td>
                  <td className="py-4 px-3">
                    {row.walletLabel ? (
                      <span className="inline-flex items-center gap-1.5 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-[#2B3B8A]/10">
                        {row.walletLabel}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right tabular-nums whitespace-nowrap">₹{row.totalAmount?.toFixed(2)}</td>
                  <td className="py-4 px-3 capitalize">{row.frequency}</td>
                  <td className="py-4 px-3">
                    <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold ${
                      row.status === 'processed' ? 'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20' : 'text-[#E74C3C] bg-[#FDEDEC] border-[#E74C3C]/20'
                    }`}>{row.status}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-40">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-[14px] font-medium text-gray-500">No upload history found</p>
                      <p className="text-[12px] text-gray-400">Upload a CSV or Excel file to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Fix Missing Wallets Panel ─────────────────────────────── */}
      <FixMissingWalletsPanel API={API} authHeaders={authHeaders} />

    </div>
  );
}
