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
  const csvContent = ['party_code,amount,remark', '7792811100,5000,March incentive'].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'incentive_upload_template.csv';
  link.click();
  URL.revokeObjectURL(url);
};

// ── Manual entry: type rows, or paste straight from Excel ───────────────────
const EMPTY_ROW = () => ({ code: '', amount: '', remark: '' });
const parseAmount = (v) => parseFloat(String(v ?? '').replace(/[₹,\s]/g, ''));
const MANUAL_COLS = ['code', 'amount', 'remark'];

const manualRowProblem = (r) => {
  const blank = !r.code.trim() && !String(r.amount).trim() && !r.remark.trim();
  if (blank) return null;
  if (!r.code.trim()) return 'Party code missing';
  const a = parseAmount(r.amount);
  if (!String(r.amount).trim()) return 'Amount missing';
  if (isNaN(a) || a <= 0) return 'Amount must be a number above 0';
  return null;
};

function ManualEntryGrid({ rows, setRows, disabled }) {
  const update = (i, field, value) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // Pasting several cells (copied from Excel) fills rows and columns from here
  const onPaste = (e, i, field) => {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return; // ordinary paste
    e.preventDefault();
    let lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    // Skip a copied header row ("party_code  amount  remark")
    if (lines.length && /code|party/i.test(lines[0]) && isNaN(parseAmount(lines[0].split('\t')[1]))) {
      lines = lines.slice(1);
    }
    const startCol = MANUAL_COLS.indexOf(field);
    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, k) => {
        const cells = line.split('\t');
        const rowIdx = i + k;
        while (next.length <= rowIdx) next.push(EMPTY_ROW());
        const row = { ...next[rowIdx] };
        cells.forEach((cell, c) => {
          const col = MANUAL_COLS[startCol + c];
          if (col) row[col] = cell.trim();
        });
        next[rowIdx] = row;
      });
      if (next[next.length - 1].code || next[next.length - 1].amount) next.push(EMPTY_ROW());
      return next;
    });
  };

  const filled = rows.filter((r) => r.code.trim() || String(r.amount).trim() || r.remark.trim());
  const problems = rows.filter((r) => manualRowProblem(r)).length;
  const total = filled.reduce((a, r) => a + (parseAmount(r.amount) || 0), 0);
  const cell = 'w-full px-2.5 py-2 text-[13px] bg-transparent focus:outline-none focus:bg-[#F8FAFF]';

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-500">
        Type rows, or copy rows from Excel (Party Code, Amount, Remark) and paste into any cell.
      </p>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2.5 py-2">Party Code</th>
                <th className="px-2.5 py-2 w-[120px]">Amount (₹)</th>
                <th className="px-2.5 py-2">Remark</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const problem = manualRowProblem(r);
                return (
                  <tr key={i} className={`border-t border-gray-100 ${problem ? 'bg-red-50' : ''}`} title={problem || ''}>
                    <td className="px-2 text-[11px] text-gray-400">{i + 1}</td>
                    {MANUAL_COLS.map((f) => (
                      <td key={f} className="border-l border-gray-100">
                        <input
                          value={r[f]}
                          disabled={disabled}
                          onChange={(e) => update(i, f, f === 'code' ? e.target.value.toUpperCase() : e.target.value)}
                          onPaste={(e) => onPaste(e, i, f)}
                          inputMode={f === 'amount' ? 'decimal' : 'text'}
                          placeholder={f === 'code' ? 'TRJ028' : f === 'amount' ? '0.00' : 'optional'}
                          className={`${cell} ${f === 'amount' ? 'text-right tabular-nums' : ''} ${f === 'code' ? 'font-mono' : ''}`}
                        />
                      </td>
                    ))}
                    <td className="text-center">
                      <button type="button" disabled={disabled}
                        onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [EMPTY_ROW()]))}
                        className="text-gray-300 hover:text-red-500 text-[16px] leading-none px-1" title="Remove row">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex gap-2">
          <button type="button" disabled={disabled} onClick={() => setRows((p) => [...p, EMPTY_ROW()])}
            className="px-3 py-1.5 border border-gray-200 rounded-lg font-semibold text-gray-700 hover:border-[#2B3B8A]">+ Add row</button>
          <button type="button" disabled={disabled} onClick={() => setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])}
            className="px-3 py-1.5 border border-gray-200 rounded-lg font-semibold text-gray-500 hover:border-red-300 hover:text-red-600">Clear</button>
        </div>
        <span className="text-gray-600">
          <strong>{filled.length.toLocaleString('en-IN')}</strong> rows · Total{' '}
          <strong>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          {problems > 0 && <span className="text-red-600 font-semibold"> · {problems} with problems</span>}
        </span>
      </div>
    </div>
  );
}

// Builds an Excel file from the typed rows — it then goes through exactly the
// same upload, OTP and duplicate checks as a chosen file.
const buildManualFile = async (rows) => {
  const XLSX = await import('xlsx');
  const data = rows
    .filter((r) => r.code.trim() || String(r.amount).trim())
    .map((r) => [r.code.trim(), parseAmount(r.amount), r.remark.trim()]);
  const ws = XLSX.utils.aoa_to_sheet([['party_code', 'amount', 'remark'], ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Incentives');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  return new File([buf], `manual-entry_${stamp}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

// ── View an uploaded file in the browser ───────────────────────────────────
function UploadFileViewer({ upload, onClose, onDownload }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/incentives/uploads/${upload._id}/preview`, { headers: authHeaders(), credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (alive) setState({ loading: false, error: ok ? '' : d.message || 'Could not open the file', data: ok ? d.data : null }); })
      .catch(() => alive && setState({ loading: false, error: 'Could not reach the server', data: null }));
    return () => { alive = false; };
  }, [upload._id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-bold text-gray-900 break-all">{upload.fileName}</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Uploaded {new Date(upload.createdAt).toLocaleString('en-IN')} · {upload.walletLabel || '—'}
              {state.data && ` · ${state.data.totalRows.toLocaleString('en-IN')} rows`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onDownload} className="px-3 py-1.5 bg-[#2B3B8A] text-white text-[12px] font-semibold rounded-lg">Download</button>
            <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {state.loading ? (
            <p className="p-10 text-center text-gray-400 text-[14px]">Opening file…</p>
          ) : state.error ? (
            <p className="p-10 text-center text-red-600 text-[14px]">{state.error}</p>
          ) : (
            <table className="w-full text-[12px] whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-400">#</th>
                  {state.data.header.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700">{String(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    {state.data.header.map((_, c) => (
                      <td key={c} className="px-3 py-1.5 text-gray-800">{String(r[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {state.data?.truncated && (
            <p className="p-3 text-center text-[12px] text-gray-500">Showing the first 2,000 rows — download the file to see all.</p>
          )}
        </div>
      </div>
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

  // File upload or manual entry
  const [inputMode, setInputMode] = useState('file'); // file | manual
  const [manualRows, setManualRows] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [fileToSend, setFileToSend] = useState(null);  // the file actually submitted
  const [formError, setFormError] = useState('');
  const [viewUpload, setViewUpload] = useState(null);  // history row being viewed

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
    setFormError('');
    if (!selectedWalletId) { setFormError('Select the wallet to credit'); return; }
    let file = null;
    if (inputMode === 'file') {
      if (!selectedFile) { setFormError('Choose a file first'); return; }
      file = selectedFile;
    } else {
      const filled = manualRows.filter((r) => r.code.trim() || String(r.amount).trim() || r.remark.trim());
      if (filled.length === 0) { setFormError('Enter at least one row'); return; }
      const bad = manualRows.findIndex((r) => manualRowProblem(r));
      if (bad !== -1) { setFormError(`Row ${bad + 1}: ${manualRowProblem(manualRows[bad])}`); return; }
      file = await buildManualFile(manualRows);
    }
    setFileToSend(file);
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
    formData.append('file', fileToSend);
    formData.append('otp', otp.join(''));
    formData.append('frequency', 'monthly');
    formData.append('walletId', selectedWalletId);
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
      setFileToSend(null);
      if (inputMode === 'manual') setManualRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      fetchHistory();
    } catch { setUploadError('Server error. Is backend running?'); setUploadState('error'); }
    finally { setIsVerifying(false); setIsUploading(false); setDupBusy(false); }
  };

  // Download the original file of a past upload
  const downloadUploadFile = async (row) => {
    try {
      const res = await fetch(`${API}/api/incentives/uploads/${row._id}/file`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.message || 'Could not download the file');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = row.fileName || 'upload';
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Could not reach the server'); }
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Upload Incentives History', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Upload Date', 'File Name', 'Wallet', 'Total Amount', 'Frequency', 'Status']],
      body: history.map((row, i) => [String(i+1).padStart(2,'0'), new Date(row.createdAt).toLocaleDateString('en-IN'), row.fileName, row.walletLabel || '—', `Rs. ${row.totalAmount?.toFixed(2)}`, row.frequency, row.status]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('incentive_upload_history.pdf');
  };

  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Upload Date', 'File Name', 'Wallet', 'Total Amount (Rs.)', 'Frequency', 'Status'],
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

      {viewUpload && (
        <UploadFileViewer upload={viewUpload} onClose={() => setViewUpload(null)} onDownload={() => downloadUploadFile(viewUpload)} />
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
            {/* Destination Wallet — required; wallets are created on the Wallet page */}
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-gray-700">Wallet to credit <span className="text-red-400">*</span></label>
              <select
                value={selectedWalletId}
                onChange={(e) => { setSelectedWalletId(e.target.value); setFormError(''); }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white font-medium"
              >
                <option value="">Select a wallet…</option>
                {wallets.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}{w.isHidden ? ' (hidden)' : ''}{w.isHold ? ' (ON HOLD)' : ''} — Bal: ₹{Number(w.totalBalance || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400">
                Wallet not listed? Create it first in Wallet Management → Create Wallet.
              </p>
            </div>

            {/* File or manual entry */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl">
              {[['file', 'Upload File'], ['manual', 'Enter Manually']].map(([k, label]) => (
                <button key={k} type="button"
                  onClick={() => { setInputMode(k); setFormError(''); setUploadState((s) => (s === 'otp' ? s : 'idle')); }}
                  disabled={uploadState === 'otp'}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                    inputMode === k ? 'bg-white text-[#2B3B8A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{label}</button>
              ))}
            </div>

            {inputMode === 'manual' && (
              <>
                <ManualEntryGrid rows={manualRows} setRows={setManualRows} disabled={uploadState === 'otp' || isUploading} />
                <button onClick={handleUploadClick}
                  disabled={!selectedWalletId || uploadState === 'otp' || isUploading || sendingOtp}
                  className={`w-full font-semibold px-8 py-3 rounded-xl transition-all ${
                    selectedWalletId && uploadState !== 'otp' && !isUploading && !sendingOtp
                      ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md'
                      : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                  }`}>
                  {sendingOtp ? 'Sending OTP...' : 'Credit Incentives →'}
                </button>
              </>
            )}

            {formError && <p className="text-red-500 text-[12px]">{formError}</p>}

            {inputMode === 'file' && (<>
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
                disabled={!selectedFile || !selectedWalletId || uploadState === 'otp' || isUploading || sendingOtp}
                className={`font-semibold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  selectedFile && selectedWalletId && uploadState !== 'otp' && !isUploading && !sendingOtp
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
            </>)}
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
                <SortableTh field="walletLabel" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Wallet</SortableTh>
                <SortableTh field="totalAmount" sort={sort} setSort={setSort} align="right" className="pb-4 pt-2 px-3 font-bold">Incentives Total Amount</SortableTh>
                <SortableTh field="frequency" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Upload Frequency</SortableTh>
                <SortableTh field="status" sort={sort} setSort={setSort} className="pb-4 pt-2 px-3 font-bold">Status</SortableTh>
                <th className="pb-4 pt-2 px-3 font-bold">File</th>
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
                  <td className="py-4 px-3">
                    {row.hasFile ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewUpload(row)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#2B3B8A]/20 text-[#2B3B8A] bg-[#EEF2FF] hover:bg-[#2B3B8A] hover:text-white transition-colors">View</button>
                        <button onClick={() => downloadUploadFile(row)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-200 text-gray-700 hover:border-[#2B3B8A] transition-colors">Download</button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400" title="Files were not kept for uploads made before this feature">Not kept</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
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


    </div>
  );
}
