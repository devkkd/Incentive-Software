'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  const [locationOptions, setLocationOptions] = useState([]);

  // Load divisions once
  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data || []); })
      .catch(() => {});
  }, []);

  // ── Active filter count badge ──────────────────────────────────────
  const activeFilters = [timeline, divisionFilter, locationFilter, startDate || endDate, searchQuery].filter(Boolean).length;

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
        // Collect unique locations from results for the location dropdown
        const locs = [...new Set(data.data.map(inv => inv.location).filter(Boolean))];
        setLocationOptions(prev => [...new Set([...prev, ...locs])]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [searchQuery, timeline, divisionFilter, locationFilter, startDate, endDate]);

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
  const [editForm, setEditForm]     = useState({ invoiceAmount: '', invoiceDate: '', remark: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]   = useState('');

  const openEditModal = (invoice) => {
    setEditForm({
      invoiceAmount: invoice.invoiceAmount,
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : '',
      remark: invoice.remark || '',
    });
    setEditError('');
    setEditModal({ isOpen: true, invoice });
  };

  const handleEditSave = async () => {
    setEditError('');
    const amt = parseFloat(editForm.invoiceAmount);
    if (isNaN(amt) || amt <= 0) { setEditError('Invoice amount must be greater than 0'); return; }
    if (!editForm.invoiceDate)  { setEditError('Invoice date is required'); return; }
    setEditLoading(true);
    try {
      const res  = await fetch(`${API}/api/invoices/${editModal.invoice._id}`, {
        method: 'PATCH', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ invoiceAmount: amt, invoiceDate: editForm.invoiceDate, remark: editForm.remark }),
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
      head: [['#', 'Party Name', 'Party Code', 'Mobile', 'Invoice No', 'Invoice Date', 'Amount (Rs)', 'Location', 'Division', 'Remark']],
      body: all.map((inv, i) => [
        i + 1, inv.vendor?.companyName || 'N/A', inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A', inv.invoiceNumber,
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        `Rs. ${inv.invoiceAmount}`, inv.location, inv.division?.name || 'N/A', inv.remark || '—',
      ]),
      styles: { fontSize: 7.5 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('invoices.pdf');
  };

  const downloadExcel = async () => {
    const all  = await fetchAll();
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Party Name', 'Party Code', 'Mobile', 'Invoice No', 'Invoice Date', 'Amount (Rs)', 'Location', 'Division', 'Remark', 'Created At'],
      ...all.map((inv, i) => [
        i + 1, inv.vendor?.companyName || 'N/A', inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A', inv.invoiceNumber,
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        inv.invoiceAmount, inv.location, inv.division?.name || 'N/A',
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
              <input type="text" placeholder="Party name, invoice no..."
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
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Division / Branch</label>
            <CustomDropdown id="division" label="All Divisions"
              options={divisions.map(d => ({ value: d._id, label: d.name }))}
              value={divisionFilter} onChange={setDivisionFilter}
              activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} minWidth="160px" />
          </div>

          {/* Location/City */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Location / City</label>
            <CustomDropdown id="location" label="All Locations"
              options={locationOptions}
              value={locationFilter} onChange={setLocationFilter}
              activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} minWidth="150px" />
          </div>

          {/* Apply search button */}
          <button onClick={() => { setSearchQuery(searchInput); fetchInvoices(1); }}
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
            {locationFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#2B3B8A] text-[12px] font-semibold rounded-full">
                City: {locationFilter}
                <button onClick={() => setLocationFilter('')} className="hover:text-red-500">×</button>
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-gray-100 text-gray-500 text-[12px] uppercase tracking-wide">
                <th className="pb-3 font-semibold px-2">#</th>
                <th className="pb-3 font-semibold px-2">Party Name</th>
                <th className="pb-3 font-semibold px-2">Party Code</th>
                <th className="pb-3 font-semibold px-2">Mobile</th>
                <th className="pb-3 font-semibold px-2">Invoice Number</th>
                <th className="pb-3 font-semibold px-2">Invoice Date</th>
                <th className="pb-3 font-semibold px-2">Amount (₹)</th>
                <th className="pb-3 font-semibold px-2">Location</th>
                <th className="pb-3 font-semibold px-2">Division</th>
                <th className="pb-3 font-semibold px-2">Remark</th>
                <th className="pb-3 font-semibold px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-16 text-center">
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
                  <td className="py-4 px-2">{new Date(row.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td className="py-4 px-2 font-semibold text-gray-900">₹{Number(row.invoiceAmount).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-2 text-gray-500">{row.location || '—'}</td>
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
                      <button onClick={() => handleDelete(row._id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white text-[11px] font-bold rounded-lg transition-colors border border-red-200 hover:border-red-500">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="11" className="py-16 text-center">
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
