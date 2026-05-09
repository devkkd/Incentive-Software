'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// Custom Dropdown
const CustomDropdown = ({ label, options, value, onChange, activeDropdown, setActiveDropdown, id }) => {
  const isOpen = activeDropdown === id;
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && isOpen) setActiveDropdown(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, setActiveDropdown]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`flex items-center justify-between min-w-[120px] px-4 py-2 bg-white border text-[13px] rounded-lg transition-colors ${isOpen ? 'border-[#2B3B8A] ring-1 ring-[#2B3B8A]' : 'border-gray-200 hover:border-gray-300'}`}>
        <span className="text-gray-700 font-medium truncate pr-4">{value || label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[160px] bg-white border border-gray-100 rounded-lg shadow-lg py-1.5 z-50">
          <button onClick={() => { onChange(''); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-[13px] text-gray-500 italic hover:bg-gray-50">Clear Filter</button>
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setActiveDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${value === opt ? 'bg-[#2B3B8A] text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Timeline to date range
const getDateRange = (timeline) => {
  const now = new Date();
  let start, end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (timeline) {
    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'Last Month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
    case 'Last 3 Months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'Last 6 Months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case 'Last 1 Year':
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
    default: return null;
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [timeline, setTimeline] = useState('');
  const [location, setLocation] = useState('');

  // Unique locations from loaded data
  const [locationOptions, setLocationOptions] = useState([]);

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchQuery) params.append('q', searchQuery);
      if (location) params.append('location', location);
      if (timeline) {
        const range = getDateRange(timeline);
        if (range) { params.append('startDate', range.start); params.append('endDate', range.end); }
      }

      const res = await fetch(`${API}/api/invoices?${params}`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.data);
        setPagination(data.pagination);
        // Extract unique locations
        const locs = [...new Set(data.data.map(inv => inv.location).filter(Boolean))];
        setLocationOptions(prev => [...new Set([...prev, ...locs])]);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [searchQuery, timeline, location]);

  useEffect(() => { fetchInvoices(1); }, [fetchInvoices]);

  // Fetch all for download
  const fetchAll = async () => {
    const res = await fetch(`${API}/api/invoices?limit=10000`, { headers: authHeaders(), credentials: 'include' });
    const data = await res.json();
    return res.ok ? data.data : [];
  };

  const downloadPDF = async () => {
    const all = await fetchAll();
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text('All Invoices', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Vendor', 'Account No', 'Mobile', 'Invoice No', 'Invoice Date', 'Amount', 'Location', 'Division']],
      body: all.map((inv, i) => [
        i + 1,
        inv.vendor?.companyName || 'N/A',
        inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A',
        inv.invoiceNumber,
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        `Rs. ${inv.invoiceAmount}`,
        inv.location,
        inv.division?.name || 'N/A',
      ]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('invoices.pdf');
  };

  const downloadExcel = async () => {
    const all = await fetchAll();
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Vendor Name', 'Account No', 'Mobile', 'Invoice No', 'Invoice Date', 'Amount (Rs.)', 'Location', 'Division', 'Created At'],
      ...all.map((inv, i) => [
        i + 1,
        inv.vendor?.companyName || 'N/A',
        inv.vendor?.accountNumber || 'N/A',
        inv.vendor?.mobileNumber || 'N/A',
        inv.invoiceNumber,
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        inv.invoiceAmount,
        inv.location,
        inv.division?.name || 'N/A',
        new Date(inv.createdAt).toLocaleDateString('en-IN'),
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, 'invoices.xlsx');
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">All Invoices</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
              <span>Download In</span>
              <button onClick={downloadPDF} className="bg-[#E74C3C] hover:bg-red-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">PDF</button>
              <button onClick={downloadExcel} className="bg-[#2ECC71] hover:bg-green-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">XLS</button>
            </div>

            <CustomDropdown id="timeline" label="Timeline"
              options={['This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'Last 1 Year']}
              value={timeline} onChange={setTimeline} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />

            <CustomDropdown id="location" label="Location/City"
              options={locationOptions.length > 0 ? locationOptions : ['Jodhpur', 'Jaipur', 'Bikaner', 'Udaipur', 'Pali']}
              value={location} onChange={setLocation} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />

            <div className="relative w-64">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Search Vendors/Invoices" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                <th className="pb-4 font-bold px-2">#</th>
                <th className="pb-4 font-bold px-2">Vendor Name</th>
                <th className="pb-4 font-bold px-2">Account Number</th>
                <th className="pb-4 font-bold px-2">Mobile Number</th>
                <th className="pb-4 font-bold px-2">Invoice Number</th>
                <th className="pb-4 font-bold px-2">Invoice Date</th>
                <th className="pb-4 font-bold px-2">Invoice Amount (₹)</th>
                <th className="pb-4 font-bold px-2">Location/City</th>
                <th className="pb-4 font-bold px-2">Location</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium text-[13px]">
              {loading ? (
                <tr><td colSpan="9" className="py-10 text-center text-gray-400">Loading...</td></tr>
              ) : invoices.length > 0 ? invoices.map((row, index) => (
                <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="py-5 px-2">{String((pagination.page - 1) * 10 + index + 1).padStart(2, '0')}</td>
                  <td className="py-5 px-2">{row.vendor?.companyName || <span className="text-gray-400 italic text-[12px]">Deleted vendor</span>}</td>
                  <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.vendor?.accountNumber || '—'}</td>
                  <td className="py-5 px-2">{row.vendor?.mobileNumber || '—'}</td>
                  <td className="py-5 px-2 font-semibold">{row.invoiceNumber}</td>
                  <td className="py-5 px-2">{new Date(row.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td className="py-5 px-2">₹{row.invoiceAmount}</td>
                  <td className="py-5 px-2">{row.location}</td>
                  <td className="py-5 px-2">{row.division?.name || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-40">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-[14px] font-medium text-gray-500">No invoices match your current filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <p className="text-[13px] text-gray-600 font-medium">
            Showing {invoices.length} of {pagination.total} invoices
          </p>
          {pagination.pages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => fetchInvoices(pagination.page - 1)} disabled={pagination.page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => fetchInvoices(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${p === pagination.page ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'}`}>
                  {String(p).padStart(2, '0')}
                </button>
              ))}
              <button onClick={() => fetchInvoices(pagination.page + 1)} disabled={pagination.page === pagination.pages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-40 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
