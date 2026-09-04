'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import SortableTh from '@/components/SortableTh';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// ── Custom Dropdown ────────────────────────────────────────────────────────────
const CustomDropdown = ({ label, options, value, onChange, activeDropdown, setActiveDropdown, id, minWidth = '140px' }) => {
  const isOpen = activeDropdown === id;
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && isOpen) setActiveDropdown(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, setActiveDropdown]);

  const displayValue = options.find(o => (typeof o === 'object' ? o.value : o) === value);
  const displayLabel = displayValue ? (typeof displayValue === 'object' ? displayValue.label : displayValue) : label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`flex items-center justify-between px-3.5 py-2 bg-white border text-[13px] rounded-xl transition-colors ${isOpen ? 'border-[#2B3B8A] ring-2 ring-[#2B3B8A]/10' : 'border-gray-200 hover:border-gray-300'}`}
        style={{ minWidth }}
      >
        <span className={`font-medium truncate pr-3 ${value ? 'text-[#2B3B8A]' : 'text-gray-500'}`}>{displayLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-50 max-h-60 overflow-y-auto" style={{ minWidth: '180px' }}>
          <button onClick={() => { onChange(''); setActiveDropdown(null); }} className="w-full text-left px-4 py-2.5 text-[12px] text-gray-400 italic hover:bg-gray-50">
            Clear Filter
          </button>
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            return (
              <button key={val} onClick={() => { onChange(val); setActiveDropdown(null); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${value === val ? 'bg-[#2B3B8A] text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                {lbl}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Date range from timeline preset ───────────────────────────────────────────
const getDateRange = (timeline) => {
  const now = new Date();
  let start, end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (timeline) {
    case 'today':       start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'this_month':  start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
    case 'last_3_months': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'last_6_months': start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case 'last_1_year':   start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
    default: return null;
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
};

const TIMELINE_OPTIONS = [
  { value: 'today',         label: 'Today' },
  { value: 'this_month',    label: 'This Month' },
  { value: 'last_month',    label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_1_year',   label: 'Last 1 Year' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminInvoicesPage() {
  const [invoices, setInvoices]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [pagination, setPagination]     = useState({ total: 0, page: 1, pages: 1 });
  const [totalAmount, setTotalAmount]   = useState(0);
  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  const [pageStart, setPageStart]       = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // ── Filter State ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchInput, setSearchInput]   = useState('');   // uncontrolled until Enter/button
  const [timeline, setTimeline]         = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');

  // ── Filter Option Lists (from DB) ─────────────────────────────────
  const [divisions, setDivisions]         = useState([]);
  const [wallets, setWallets]             = useState([]);
  const [walletFilter, setWalletFilter]   = useState('');
  const [sort, setSort]                   = useState({ by: '', order: '' });   // Point 11

  // ── POINT 19 — wallet reassignment ──────────────────────────────────────
  const [reassign, setReassign] = useState(null);   // { invoice, sources, targets }
  const [raFrom, setRaFrom] = useState('');
  const [raTo, setRaTo] = useState('');
  const [raAmount, setRaAmount] = useState('');
  const [raReason, setRaReason] = useState('');
  const [raOverride, setRaOverride] = useState(false);
  const [raBusy, setRaBusy] = useState(false);
  const [raError, setRaError] = useState('');

  const openReassign = async (row) => {
    setRaError(''); setRaFrom(''); setRaTo(''); setRaAmount(''); setRaReason(''); setRaOverride(false);
    try {
      const res = await fetch(`${API}/api/invoices/${row._id}/reassign-options`, {
        headers: authHeaders(), credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) { alert(json.message); return; }
      setReassign(json);
      if (json.sources.length === 1) {
        setRaFrom(json.sources[0].monthlyWalletId);
        setRaAmount(String(json.sources[0].amount));
      }
    } catch { alert('Could not reach the server'); }
  };

  const submitReassign = async () => {
    setRaBusy(true); setRaError('');
    try {
      const res = await fetch(`${API}/api/invoices/${reassign.invoice._id}/reassign`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromMonthlyWalletId: raFrom,
          toMonthlyWalletId: raTo,
          amount: parseFloat(raAmount),
          reason: raReason.trim(),
          overrideHold: raOverride,
        }),
      });
      const json = await res.json();
      if (json.success) { setReassign(null); fetchInvoices(page); }
      else {
        setRaError(json.message);
        if (json.needsConfirmation) setRaOverride(true);
      }
    } catch { setRaError('Could not reach the server'); }
    finally { setRaBusy(false); }
  };
  const [locationOptions, setLocationOptions] = useState([]);

  // Load divisions once
  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data || []); })
      .catch(() => {});

    // Point 10 — wallet list for the wallet filter
    fetch(`${API}/api/wallets`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setWallets(d.data || []); })
      .catch(() => {});
  }, []);

  // ── Active filter count badge ──────────────────────────────────────
  const activeFilters = [timeline, divisionFilter, locationFilter, walletFilter, startDate || endDate, searchQuery].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery(''); setSearchInput('');
    setTimeline(''); setDivisionFilter('');
    setLocationFilter(''); setStartDate(''); setEndDate('');
  };

  // ── Pagination helpers ─────────────────────────────────────────────
  useEffect(() => {
    if (pagination.page > pageStart + 5)      setPageStart(pagination.page - 5);
    else if (pagination.page < pageStart)      setPageStart(pagination.page);
  }, [pagination.page, pageStart]);

  const getVisiblePages = () => {
    let s = pageStart;
    let e = Math.min(pagination.pages, s + 5);
    if (e - s < 5 && pagination.pages > 5) s = Math.max(1, pagination.pages - 5);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  };

  // ── Fetch Invoices ─────────────────────────────────────────────────
  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchQuery)    params.append('q', searchQuery);
      if (locationFilter) params.append('location', locationFilter);
      if (divisionFilter) params.append('divisionId', divisionFilter);
      if (walletFilter) params.append('walletId', walletFilter);
      if (sort.by) { params.append('sortBy', sort.by); params.append('sortOrder', sort.order); }

      // Date range: manual dates override timeline preset
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (timeline) {
        const range = getDateRange(timeline);
        if (range) { params.append('startDate', range.start); params.append('endDate', range.end); }
      }

      const res  = await fetch(`${API}/api/invoices?${params}`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.data);
        setPagination(data.pagination);
        setTotalAmount(data.totalAmount || 0);
        setTotalInvoiced(data.totalInvoiced ?? data.totalAmount ?? 0);
        setTotalRedeemed(data.totalRedeemed || 0);
        // Collect unique locations from results for the location dropdown
        const locs = [...new Set(data.data.map(inv => inv.location).filter(Boolean))];
        setLocationOptions(prev => [...new Set([...prev, ...locs])]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [searchQuery, timeline, divisionFilter, locationFilter, walletFilter, startDate, endDate, sort]);

  useEffect(() => { fetchInvoices(1); }, [fetchInvoices]);

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      const res  = await fetch(`${API}/api/invoices/${id}`, { method: 'DELETE', headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) { fetchInvoices(pagination.page); }
      else alert(data.message || 'Failed to delete invoice');
    } catch { alert('Something went wrong'); }
  };

  // ── Edit Modal ─────────────────────────────────────────────────────
  const [editModal, setEditModal]   = useState({ isOpen: false, invoice: null });
  const [editForm, setEditForm]     = useState({ invoiceNumber: '', invoiceAmount: '', invoiceDate: '', remark: '', location: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]   = useState('');

  const openEditModal = (invoice) => {
    setEditForm({
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceAmount: invoice.invoiceAmount,
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : '',
      remark: invoice.remark || '',
      location: invoice.location || '',
    });
    setEditError('');
    setEditModal({ isOpen: true, invoice });
  };

  // Detect if prefix (branch code) has changed
  const getInvoicePrefix = (invNo) => String(invNo || '').split('/')[0].trim();
  const invoicePrefixChanged = editModal.invoice
    ? getInvoicePrefix(editForm.invoiceNumber) !== getInvoicePrefix(editModal.invoice.invoiceNumber)
    : false;

  const handleEditSave = async () => {
    setEditError('');
    const amt = parseFloat(editForm.invoiceAmount);
    if (isNaN(amt) || amt <= 0) { setEditError('Invoice amount must be greater than 0'); return; }
    if (!editForm.invoiceDate)  { setEditError('Invoice date is required'); return; }
    if (!editForm.invoiceNumber?.trim()) { setEditError('Invoice number is required'); return; }

    // Validate invoice number format
    const invoiceFormatRegex = /^\d+\/(?:RS|CSI)\/\d{8}$/i;
    if (!invoiceFormatRegex.test(editForm.invoiceNumber.trim())) {
      setEditError('Invoice number must be in format 1/RS/26001200 or 5/CSI/15001623');
      return;
    }

    setEditLoading(true);
    try {
      const res  = await fetch(`${API}/api/invoices/${editModal.invoice._id}`, {
        method: 'PATCH', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({
          invoiceNumber: editForm.invoiceNumber.trim(),
          invoiceAmount: amt,
          invoiceDate: editForm.invoiceDate,
          remark: editForm.remark,
          location: editForm.location,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Failed to update invoice'); return; }
      setInvoices(prev => prev.map(inv => inv._id === editModal.invoice._id ? data.data : inv));
      setEditModal({ isOpen: false, invoice: null });
    } catch { setEditError('Server error. Please try again.'); }
    finally { setEditLoading(false); }
  };

  // ── Download helpers ───────────────────────────────────────────────
  const fetchAll = async () => {
    const params = new URLSearchParams({ limit: 10000 });
    if (searchQuery)    params.append('q', searchQuery);
    if (locationFilter) params.append('location', locationFilter);
    if (divisionFilter) params.append('divisionId', divisionFilter);
      if (walletFilter) params.append('walletId', walletFilter);
      if (sort.by) { params.append('sortBy', sort.by); params.append('sortOrder', sort.order); }
    if (startDate && endDate) { params.append('startDate', startDate); params.append('endDate', endDate); }
    else if (timeline) { const r = getDateRange(timeline); if (r) { params.append('startDate', r.start); params.append('endDate', r.end); } }
    const res  = await fetch(`${API}/api/invoices?${params}`, { headers: authHeaders(), credentials: 'include' });
    const data = await res.json();
    return res.ok ? data.data : [];
  };

  const downloadPDF = async () => {
    const all = await fetchAll();
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text('All Invoices — Admin', 14, 18);
    doc.setFontSize(9);  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Party Name', 'Party Code', 'Mobile Number', 'Invoice Number', 'Reference Number', 'Invoice Date', 'Amount (Rs)', 'Redeemed (Rs)', 'Location', 'Location', 'Remark']],
      body: all.map((inv, i) => [
        i + 1, inv.vendor?.companyName || 'N/A', inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A', inv.invoiceNumber, inv.referenceNo || '—',
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        `Rs. ${inv.invoiceAmount}`,
        inv.redeemAmount > 0 ? `Rs. ${inv.redeemAmount}` : '—',
        inv.location, inv.division?.name || 'N/A', inv.remark || '—',
      ]),
      styles: { fontSize: 7.5 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('invoices.pdf');
  };

  const downloadExcel = async () => {
    const all  = await fetchAll();
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Party Name', 'Party Code', 'Mobile Number', 'Invoice Number', 'Reference Number', 'Invoice Date', 'Invoice Amount (Rs)', 'Redeemed Amount (Rs)', 'Location', 'Branch', 'Remark', 'Created At'],
      ...all.map((inv, i) => [
        i + 1, inv.vendor?.companyName || 'N/A', inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A', inv.invoiceNumber, inv.referenceNo || '—',
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        inv.invoiceAmount,
        inv.redeemAmount > 0 ? inv.redeemAmount : 0,
        inv.location, inv.division?.name || 'N/A',
        inv.remark || '—', new Date(inv.createdAt).toLocaleDateString('en-IN'),
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, 'invoices.xlsx');
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 max-w-[1700px] mx-auto">

      {/* ── POINT 19 — reassign the wallet a redemption came from ────────── */}
      {reassign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setReassign(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-auto p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-[18px] font-bold text-gray-900">Change source wallet</h3>
              <p className="text-[13px] text-gray-500 mt-1">
                {reassign.invoice.invoiceNumber} · {reassign.invoice.partyName} ·{' '}
                ₹{Number(reassign.invoice.redeemedAmount).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-[12px] text-gray-600 leading-relaxed">
              The original entry is never altered. A <strong>reversal</strong> and a{' '}
              <strong>re-application</strong> are added, so the party statement shows
              exactly what happened. The party&rsquo;s total balance does not change.
            </div>

            {reassign.invoice.reassignmentCount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                This invoice has already been reassigned {reassign.invoice.reassignmentCount} time
                {reassign.invoice.reassignmentCount === 1 ? '' : 's'}.
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Move from
              </label>
              <select value={raFrom}
                onChange={(e) => {
                  setRaFrom(e.target.value);
                  const s = reassign.sources.find((x) => x.monthlyWalletId === e.target.value);
                  if (s) setRaAmount(String(s.amount));
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] cursor-pointer focus:outline-none focus:border-[#2B3B8A]">
                <option value="">Select the wallet it came from…</option>
                {reassign.sources.map((s) => (
                  <option key={s.monthlyWalletId} value={s.monthlyWalletId}>
                    {s.label} — ₹{s.amount.toFixed(2)} drawn
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Move to
              </label>
              <select value={raTo} onChange={(e) => setRaTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] cursor-pointer focus:outline-none focus:border-[#2B3B8A]">
                <option value="">Select the wallet it should have come from…</option>
                {reassign.targets.map((tg) => (
                  <option key={tg.monthlyWalletId} value={tg.monthlyWalletId}
                    disabled={tg.balance < parseFloat(raAmount || 0)}>
                    {tg.label} — balance ₹{tg.balance.toFixed(2)}
                    {tg.isHold ? ' (on hold)' : ''}
                    {tg.balance < parseFloat(raAmount || 0) ? ' — not enough' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                The target wallet must hold enough — the redemption moves onto it.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Amount
              </label>
              <input type="number" value={raAmount} onChange={(e) => setRaAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] tabular-nums focus:outline-none focus:border-[#2B3B8A]" />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Reason — recorded against this invoice
              </label>
              <textarea value={raReason} onChange={(e) => setRaReason(e.target.value)} rows={2}
                placeholder="e.g. Should have been drawn from July, not June"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#2B3B8A]" />
              {raReason.trim().length > 0 && raReason.trim().length < 10 && (
                <p className="text-[11px] text-amber-700 mt-1">Please give a fuller reason.</p>
              )}
            </div>

            {raError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {raError}
                {raOverride && (
                  <label className="flex items-center gap-2 mt-2 text-[12px] font-medium cursor-pointer">
                    <input type="checkbox" checked={raOverride}
                      onChange={(e) => setRaOverride(e.target.checked)} className="cursor-pointer" />
                    I understand — proceed anyway
                  </label>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setReassign(null)} disabled={raBusy}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={submitReassign}
                disabled={raBusy || !raFrom || !raTo || !(parseFloat(raAmount) > 0) || raReason.trim().length < 10}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl cursor-pointer">
                {raBusy ? 'Moving…' : 'Move redemption'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ──────────────────────────────────────────────── */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[20px] font-bold text-gray-900">Edit Invoice</h3>
                <p className="text-[13px] text-gray-500 mt-0.5 font-mono">{editModal.invoice?.invoiceNumber}</p>
              </div>
              <button onClick={() => setEditModal({ isOpen: false, invoice: null })}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {editError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">{editError}</div>}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Invoice Number</label>
                <input type="text" value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm(f => ({ ...f, invoiceNumber: e.target.value.toUpperCase() }))}
                  placeholder="e.g. 7/RS/26001200"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/20 focus:border-[#2B3B8A] transition-all" />
                {invoicePrefixChanged && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-[12px] text-amber-700 font-medium">
                      Branch code changed — this invoice will automatically move to the branch matching the new prefix.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Invoice Amount (₹)</label>
                <input type="number" value={editForm.invoiceAmount}
                  onChange={(e) => setEditForm(f => ({ ...f, invoiceAmount: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/20 focus:border-[#2B3B8A] transition-all"
                  min="0" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Invoice Date</label>
                <input type="date" value={editForm.invoiceDate}
                  onChange={(e) => setEditForm(f => ({ ...f, invoiceDate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/20 focus:border-[#2B3B8A] transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Remark <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={editForm.remark}
                  onChange={(e) => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  placeholder="Add a remark..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/20 focus:border-[#2B3B8A] transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Location / City</label>
                <input type="text" value={editForm.location}
                  onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Jodhpur"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/20 focus:border-[#2B3B8A] transition-all" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal({ isOpen: false, invoice: null })}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editLoading}
                className="flex-1 py-2.5 rounded-xl bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-60 text-white text-[13px] font-semibold transition-colors">
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-[14px] text-gray-500 mb-1">Friends Trading Corporation — Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">All Invoices</h1>
      </div>

      {/* ── FILTER BAR ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex flex-wrap items-end gap-3">

          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Search</label>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Party name, code, invoice no..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(searchInput); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/10 focus:border-[#2B3B8A] transition-all" />
            </div>
          </div>

          {/* Timeline preset */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Timeline</label>
            <CustomDropdown id="timeline" label="All Time" options={TIMELINE_OPTIONS}
              value={timeline} onChange={(v) => { setTimeline(v); setStartDate(''); setEndDate(''); }}
              activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} minWidth="140px" />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">From Date</label>
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setTimeline(''); }}
              className="px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/10 focus:border-[#2B3B8A] transition-all cursor-pointer" />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">To Date</label>
            <input type="date" value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setTimeline(''); }}
              className="px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]/10 focus:border-[#2B3B8A] transition-all cursor-pointer" />
          </div>

          {/* Division */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Branch</label>
            <CustomDropdown id="division" label="All Branches"
              options={divisions.map(d => ({ value: d._id, label: d.name }))}
              value={divisionFilter} onChange={setDivisionFilter}
              activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} minWidth="160px" />
          </div>

          {/* Wallet */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Wallet</label>
            <CustomDropdown id="wallet" label="All Wallets"
              options={wallets.map(w => ({ value: w._id, label: w.name }))}
              value={walletFilter} onChange={setWalletFilter}
              activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} minWidth="170px" />
          </div>

          {/* Apply search button */}
          <button onClick={() => setSearchQuery(searchInput)}
            className="px-5 py-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white text-[13px] font-semibold rounded-xl transition-colors">
            Apply
          </button>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button onClick={clearAllFilters}
              className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 text-[13px] font-medium rounded-xl transition-colors flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear ({activeFilters})
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Download buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500 font-medium">Export:</span>
            <button onClick={downloadPDF}
              className="bg-[#E74C3C] hover:bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              PDF
            </button>
            <button onClick={downloadExcel}
              className="bg-[#2ECC71] hover:bg-green-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              XLS
            </button>
          </div>
        </div>

        {/* Active filter pills */}
        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                Search: "{searchQuery}"
                <button onClick={() => { setSearchQuery(''); setSearchInput(''); }} className="hover:text-red-500">×</button>
              </span>
            )}
            {timeline && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                {TIMELINE_OPTIONS.find(t => t.value === timeline)?.label}
                <button onClick={() => setTimeline('')} className="hover:text-red-500">×</button>
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                {startDate} → {endDate}
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="hover:text-red-500">×</button>
              </span>
            )}
            {divisionFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                Division: {divisions.find(d => d._id === divisionFilter)?.name}
                <button onClick={() => setDivisionFilter('')} className="hover:text-red-500">×</button>
              </span>
            )}
            {walletFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                Wallet: {wallets.find(w => w._id === walletFilter)?.name}
                <button onClick={() => setWalletFilter('')} className="hover:text-red-500">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── TABLE CARD ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">

        {/* Table header info */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-gray-900">
            Invoices
            <span className="ml-2 text-[14px] font-normal text-gray-400">({pagination.total} total)</span>
          </h2>
          {!loading && pagination.total > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Point 10 — Total Invoiced */}
              <div className="flex items-center gap-2 bg-[#EEF2FF] border border-[#2B3B8A]/15 px-4 py-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#2B3B8A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[13px] text-gray-500 font-medium">Total Invoiced:</span>
                <span className="text-[15px] font-bold text-[#2B3B8A] tabular-nums">
                  ₹{Number(totalInvoiced).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Point 10 — Total Redeemed */}
              <div className="flex items-center gap-2 bg-[#FDEDEC] border border-[#E74C3C]/15 px-4 py-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#E74C3C]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[13px] text-gray-500 font-medium">Total Redeemed:</span>
                <span className="text-[15px] font-bold text-[#E74C3C] tabular-nums">
                  ₹{Number(totalRedeemed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {totalInvoiced > 0 && (
                  <span className="text-[11px] text-gray-500 font-medium">
                    ({((totalRedeemed / totalInvoiced) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-gray-100 text-gray-500 text-[12px] uppercase tracking-wide">
                <th className="pb-3 font-semibold px-2">#</th>
                <SortableTh field="companyName" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Party Name</SortableTh>
                <SortableTh field="accountNumber" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Party Code</SortableTh>
                <SortableTh field="mobileNumber" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Mobile</SortableTh>
                <SortableTh field="invoiceNumber" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Invoice Number</SortableTh>
                <SortableTh field="referenceNo" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Reference No</SortableTh>
                <SortableTh field="invoiceDate" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Invoice Date</SortableTh>
                <SortableTh field="invoiceAmount" sort={sort} setSort={setSort} align="right" className="pb-3 font-semibold px-2">Amount (₹)</SortableTh>
                <SortableTh field="redeemedAmount" sort={sort} setSort={setSort} align="right" className="pb-3 font-semibold px-2">Redeemed (₹)</SortableTh>
                <SortableTh field="location" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Location</SortableTh>
                <SortableTh field="divisionName" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Division</SortableTh>
                <SortableTh field="remark" sort={sort} setSort={setSort} className="pb-3 font-semibold px-2">Remark</SortableTh>
                <th className="pb-3 font-semibold px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan="13" className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      <span className="text-[14px]">Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length > 0 ? invoices.map((row, index) => (
                <tr key={row._id} className="border-b border-gray-50 last:border-0 hover:bg-[#F8FAFF] transition-colors">
                  <td className="py-4 px-2 text-gray-400">{String((pagination.page - 1) * 10 + index + 1).padStart(2, '0')}</td>
                  <td className="py-4 px-2">
                    {row.vendor?.companyName || <span className="text-gray-400 italic text-[12px]">Deleted Party</span>}
                  </td>
                  <td className="py-4 px-2 font-semibold text-[#2B3B8A]">{row.vendor?.accountNumber || '—'}</td>
                  <td className="py-4 px-2 text-gray-500">{row.vendor?.mobileNumber || '—'}</td>
                  <td className="py-4 px-2 font-semibold font-mono text-[12px]">{row.invoiceNumber}</td>
                  <td className="py-4 px-2 font-mono font-medium text-gray-800">{row.referenceNo || '—'}</td>
                  <td className="py-4 px-2">{new Date(row.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td className="py-4 px-2 font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">₹{Number(row.invoiceAmount).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-2 font-semibold text-[#E74C3C] text-right tabular-nums whitespace-nowrap">
                    {row.redeemAmount > 0
                      ? `₹${Number(row.redeemAmount).toLocaleString('en-IN')}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-4 px-2 text-gray-500 max-w-[160px] truncate" title={row.location || ''}>{row.location || '—'}</td>
                  <td className="py-4 px-2">
                    <span className="px-2.5 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[11px] font-semibold rounded-lg">
                      {row.division?.name || '—'}
                    </span>
                  </td>
                  <td className="py-4 px-2 max-w-[140px]">
                    {row.remark ? (
                      <span className="text-gray-500 text-[12px]" title={row.remark}>
                        {row.remark.length > 28 ? row.remark.substring(0, 28) + '…' : row.remark}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-4 px-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEditModal(row)}
                        className="px-3 py-1.5 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white text-[11px] font-bold rounded-lg transition-colors">
                        Edit
                      </button>
                      {row.redeemAmount > 0 && (
                        <button onClick={() => openReassign(row)}
                          title="Change which wallet this was redeemed from"
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white text-[11px] font-bold rounded-lg transition-colors border border-amber-200 hover:border-amber-500 cursor-pointer">
                          Wallet
                        </button>
                      )}
                      <button onClick={() => handleDelete(row._id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white text-[11px] font-bold rounded-lg transition-colors border border-red-200 hover:border-red-500">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="13" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14 opacity-20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-[15px] font-medium text-gray-500">No invoices found</p>
                      <p className="text-[13px] text-gray-400">Try adjusting your filters</p>
                      {activeFilters > 0 && (
                        <button onClick={clearAllFilters} className="mt-1 px-4 py-2 bg-[#2B3B8A] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1a2d6b] transition-colors">
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <p className="text-[13px] text-gray-500">
            Showing <span className="font-semibold text-gray-800">{invoices.length}</span> of <span className="font-semibold text-gray-800">{pagination.total}</span> invoices
          </p>
          {pagination.pages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => fetchInvoices(pagination.page - 1)} disabled={pagination.page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-30 transition-colors text-lg font-bold">
                ‹
              </button>
              {getVisiblePages().map((p) => (
                <button key={p} onClick={() => fetchInvoices(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${p === pagination.page ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => fetchInvoices(pagination.page + 1)} disabled={pagination.page === pagination.pages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-30 transition-colors text-lg font-bold">
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
