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
        className={`flex items-center justify-between min-w-[130px] px-4 py-2.5 bg-white border text-[13px] rounded-lg transition-colors ${isOpen ? 'border-[#2B3B8A] ring-1 ring-[#2B3B8A]' : 'border-gray-200 hover:border-gray-300'}`}>
        <span className="text-gray-700 font-medium truncate pr-4">{value || label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[180px] bg-white border border-gray-100 rounded-lg shadow-lg py-1.5 z-50">
          <button onClick={() => { onChange(''); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-[13px] text-gray-500 italic hover:bg-gray-50">Clear Filter</button>
          {options.map((opt) => (
            <button key={typeof opt === 'object' ? opt.value : opt}
              onClick={() => { onChange(typeof opt === 'object' ? opt.value : opt); setActiveDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${value === (typeof opt === 'object' ? opt.value : opt) ? 'bg-[#2B3B8A] text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              {typeof opt === 'object' ? opt.label : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const statusStyles = {
  active:   'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20',
  inactive: 'text-[#E74C3C] bg-[#FDEDEC] border-[#E74C3C]/20',
  blocked:  'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20',
};

const getDateRange = (timeline) => {
  const now = new Date();
  let start, end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (timeline) {
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
    case 'last_3_months': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'last_6_months': start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case 'last_1_year': start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
    default: return null;
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
};

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState('vendors');
  const [timeline, setTimeline] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [divisionFilter, setDivisionFilter] = useState(''); // admin extra filter

  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Load divisions for filter
  const [divisions, setDivisions] = useState([]);
  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data); })
      .catch(() => {});
  }, []);

  const fetchReports = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: reportType });

      if (timeline === 'manual' && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (timeline !== 'manual') {
        const range = getDateRange(timeline);
        if (range) {
          params.append('startDate', range.start);
          params.append('endDate', range.end);
        }
        params.append('timeline', timeline);
      }

      if (divisionFilter) params.append('divisionId', divisionFilter);

      const res = await fetch(`${API}/api/reports?${params}`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to fetch reports'); return; }
      setReportData(data.data);
      setShowResults(true);
    } catch { setError('Server error. Is the backend running?'); }
    finally { setLoading(false); }
  };

  const handleGetReports = () => fetchReports();

  // Client-side filtered data — no extra API call
  const filteredData = reportData.filter((row) => {
    if (reportType === 'vendors') {
      if (statusFilter && row.status !== statusFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${row.companyName} ${row.mobileNumber} ${row.accountNumber}`.toLowerCase().includes(q)) return false;
      }
    }
    if (reportType === 'invoices') {
      if (locationFilter && row.location?.toLowerCase() !== locationFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${row.invoiceNumber} ${row.vendor?.companyName} ${row.location}`.toLowerCase().includes(q)) return false;
      }
    }
    if (reportType === 'incentives') {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${row.vendor?.companyName} ${row.vendor?.accountNumber}`.toLowerCase().includes(q)) return false;
      }
    }
    return true;
  });

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`${reportType === 'vendors' ? 'Vendors' : reportType === 'invoices' ? 'Invoices' : 'Incentives Wallet'} Report — Admin`, 14, 18);
    doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    const { head, body } = getTableData();
    autoTable(doc, { startY: 32, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [43, 59, 138] } });
    doc.save(`admin_${reportType}_report.pdf`);
  };

  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const { head, body } = getTableData();
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `admin_${reportType}_report.xlsx`);
  };

  const getTableData = () => {
    if (reportType === 'vendors') return {
      head: ['#', 'Company Name', 'Mobile', 'Account No', 'Wallet Balance', 'Status', 'Division', 'Created'],
      body: filteredData.map((v, i) => [i+1, v.companyName, v.mobileNumber, v.accountNumber, `Rs. ${Number(v.walletBalance).toFixed(2)}`, v.status, v.division?.name||'', new Date(v.createdAt).toLocaleDateString('en-IN')]),
    };
    if (reportType === 'invoices') return {
      head: ['#', 'Invoice No', 'Vendor', 'Account No', 'Amount', 'Location', 'Division', 'Date'],
      body: filteredData.map((inv, i) => [i+1, inv.invoiceNumber, inv.vendor?.companyName||'N/A', inv.vendor?.accountNumber||'N/A', `Rs. ${inv.invoiceAmount}`, inv.location, inv.division?.name||'', new Date(inv.invoiceDate).toLocaleDateString('en-IN')]),
    };
    return {
      head: ['#', 'Vendor', 'Account No', 'Type', 'Amount', 'Balance After', 'Date'],
      body: filteredData.map((t, i) => [i+1, t.vendor?.companyName||'N/A', t.vendor?.accountNumber||'N/A', t.type, `Rs. ${t.amount}`, `Rs. ${t.balanceAfter}`, new Date(t.createdAt).toLocaleDateString('en-IN')]),
    };
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">

      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      {/* TOP CARD: Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* Column 1: Report Type + Division Filter */}
          <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
            <h3 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">Reports</h3>
            <p className="text-[15px] text-gray-800 mb-4">Select a Report to Download</p>
            <div className="flex flex-wrap gap-3 mb-6">
              {[
                { id: 'vendors', label: 'Vendors/Party' },
                { id: 'invoices', label: 'Invoices' },
                { id: 'incentives', label: 'Incentives Wallet' },
              ].map((r) => (
                <button key={r.id} onClick={() => { setReportType(r.id); setShowResults(false); }}
                  className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${reportType === r.id ? 'bg-[#2B3B8A] text-white shadow-sm' : 'bg-[#8492A6] text-white hover:bg-gray-500'}`}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Division Filter — Admin only */}
            {divisions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-gray-800">Filter by Division/Branch</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDivisionFilter('')}
                    className={`px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors ${!divisionFilter ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    All Branches
                  </button>
                  {divisions.map((div) => (
                    <button key={div._id} onClick={() => setDivisionFilter(div._id)}
                      className={`px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors ${divisionFilter === div._id ? 'bg-[#2B3B8A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {div.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Timeline Presets */}
          <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
            <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline</p>
            <div className="space-y-4">
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'last_3_months', label: 'Last 3 Months' },
                { id: 'last_6_months', label: 'Last 6 Months' },
                { id: 'last_1_year', label: 'Last 1 Year' },
              ].map((option) => (
                <label key={option.id} className="flex items-center gap-3 cursor-pointer">
                  <div className="relative flex items-center justify-center w-[22px] h-[22px]">
                    <input type="radio" name="timeline" checked={timeline === option.id}
                      onChange={() => { setTimeline(option.id); setStartDate(''); setEndDate(''); }}
                      className="peer appearance-none w-[22px] h-[22px] border-2 border-gray-300 rounded-full checked:border-[#2B3B8A] transition-colors cursor-pointer" />
                    <div className="absolute w-[10px] h-[10px] rounded-full bg-[#2B3B8A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  <span className="text-[14px] text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Column 3: Manual Date */}
          <div className="p-8 md:w-1/3 flex flex-col justify-center">
            <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline Manually</p>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[13px] text-gray-700">Reports Start Date</label>
                <input type="date" value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setTimeline('manual'); }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none cursor-pointer" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] text-gray-700">Reports End Date</label>
                <input type="date" value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setTimeline('manual'); }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="border-t border-gray-100 p-6 flex justify-center bg-white">
          <button onClick={handleGetReports} disabled={loading}
            className="bg-[#8492A6] hover:bg-[#6c7b94] disabled:opacity-60 transition-colors text-white font-semibold px-10 py-3 rounded-xl flex items-center justify-center gap-2">
            {loading ? 'Loading...' : 'Get Reports →'}
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[14px] text-[#E74C3C] font-medium">{error}</div>}

      {/* Results */}
      {showResults && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-100 pb-6">
            <h2 className="text-[26px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {reportType === 'invoices' ? 'Invoices' : reportType === 'vendors' ? 'Vendors' : 'Incentives Wallet'}
              <span className="text-[15px] font-normal text-gray-500">(Data Preview — {filteredData.length} records)</span>
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
                <span>Download In</span>
                <button onClick={downloadPDF} className="bg-[#E74C3C] hover:bg-red-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">PDF</button>
                <button onClick={downloadExcel} className="bg-[#2ECC71] hover:bg-green-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">XLS</button>
              </div>

              {reportType === 'vendors' && (
                <CustomDropdown id="statusFilter" label="Status" options={['Active', 'Inactive', 'Blocked']}
                  value={statusFilter} onChange={setStatusFilter} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
              )}

              {reportType === 'invoices' && (
                <CustomDropdown id="location" label="Location/City" options={['Jodhpur', 'Jaipur', 'Bikaner', 'Udaipur', 'Pali']}
                  value={locationFilter} onChange={setLocationFilter} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
              )}

              <div className="relative w-64">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                  <th className="pb-4 font-bold px-2">#</th>
                  {reportType === 'vendors' && <>
                    <th className="pb-4 font-bold px-2">Company Name</th>
                    <th className="pb-4 font-bold px-2">Mobile</th>
                    <th className="pb-4 font-bold px-2">Account Number</th>
                    <th className="pb-4 font-bold px-2">Wallet Balance</th>
                    <th className="pb-4 font-bold px-2">Status</th>
                    <th className="pb-4 font-bold px-2">Division</th>
                    <th className="pb-4 font-bold px-2">Created</th>
                  </>}
                  {reportType === 'invoices' && <>
                    <th className="pb-4 font-bold px-2">Invoice Number</th>
                    <th className="pb-4 font-bold px-2">Vendor</th>
                    <th className="pb-4 font-bold px-2">Account No</th>
                    <th className="pb-4 font-bold px-2">Amount (₹)</th>
                    <th className="pb-4 font-bold px-2">Location</th>
                    <th className="pb-4 font-bold px-2">Division</th>
                    <th className="pb-4 font-bold px-2">Invoice Date</th>
                  </>}
                  {reportType === 'incentives' && <>
                    <th className="pb-4 font-bold px-2">Vendor</th>
                    <th className="pb-4 font-bold px-2">Account No</th>
                    <th className="pb-4 font-bold px-2">Type</th>
                    <th className="pb-4 font-bold px-2">Amount (₹)</th>
                    <th className="pb-4 font-bold px-2">Balance After</th>
                    <th className="pb-4 font-bold px-2">Date</th>
                  </>}
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium text-[13px]">
                {filteredData.length > 0 ? filteredData.map((row, i) => (
                  <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{String(i+1).padStart(2,'0')}</td>
                    {reportType === 'vendors' && <>
                      <td className="py-5 px-2">{row.companyName}</td>
                      <td className="py-5 px-2">{row.mobileNumber}</td>
                      <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.accountNumber}</td>
                      <td className="py-5 px-2">₹{Number(row.walletBalance).toFixed(2)}</td>
                      <td className="py-5 px-2">
                        <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold capitalize ${statusStyles[row.status] || ''}`}>{row.status}</span>
                      </td>
                      <td className="py-5 px-2">{row.division?.name || '—'}</td>
                      <td className="py-5 px-2">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                    </>}
                    {reportType === 'invoices' && <>
                      <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.invoiceNumber}</td>
                      <td className="py-5 px-2">{row.vendor?.companyName || 'N/A'}</td>
                      <td className="py-5 px-2">{row.vendor?.accountNumber || 'N/A'}</td>
                      <td className="py-5 px-2">₹{row.invoiceAmount}</td>
                      <td className="py-5 px-2">{row.location}</td>
                      <td className="py-5 px-2">{row.division?.name || '—'}</td>
                      <td className="py-5 px-2">{new Date(row.invoiceDate).toLocaleDateString('en-IN')}</td>
                    </>}
                    {reportType === 'incentives' && <>
                      <td className="py-5 px-2">{row.vendor?.companyName || 'N/A'}</td>
                      <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.vendor?.accountNumber || 'N/A'}</td>
                      <td className="py-5 px-2">
                        <span className={`font-semibold ${row.type === 'credit' ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>{row.type}</span>
                      </td>
                      <td className="py-5 px-2">₹{row.amount}</td>
                      <td className="py-5 px-2">₹{row.balanceAfter}</td>
                      <td className="py-5 px-2">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                    </>}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-40">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="text-[14px] font-medium text-gray-500">No data found for selected filters</p>
                        <p className="text-[12px] text-gray-400">Try changing the timeline, report type, or division filter</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-[13px] text-gray-600 font-medium">Showing {filteredData.length} records</p>
          </div>
        </div>
      )}
    </div>
  );
}
