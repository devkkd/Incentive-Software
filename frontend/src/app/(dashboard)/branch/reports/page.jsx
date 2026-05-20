'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const statusStyles = {
  active:   'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20',
  inactive: 'text-[#E74C3C] bg-[#FDEDEC] border-[#E74C3C]/20',
  blocked:  'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20',
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState('vendors');
  const [timeline, setTimeline] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchReports = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: reportType, timeline });
      if (timeline === 'manual' && startDate) params.append('startDate', startDate);
      if (timeline === 'manual' && endDate) params.append('endDate', endDate);

      const res = await fetch(`${API}/api/reports?${params}`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to fetch reports'); return; }
      setReportData(data.data);
      setShowResults(true);
    } catch { setError('Server error. Is the backend running?'); }
    finally { setLoading(false); }
  };

  const handleGetReports = () => { setCurrentPage(1); fetchReports(); };

  // Client-side filtering — instant, no API call
  const filteredData = reportData.filter((row) => {
    if (reportType === 'vendors') {
      if (statusFilter && row.status !== statusFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${row.companyName} ${row.mobileNumber} ${row.accountNumber}`.toLowerCase().includes(q)) return false;
      }
    }
    if (reportType === 'invoices') {
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

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 if current page exceeds max
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredData, currentPage, totalPages]);

  // Totals for current filtered data
  const totals = React.useMemo(() => {
    let walletTotal = 0;
    let invoiceTotal = 0;
    let incentiveTotal = 0;
    filteredData.forEach((r) => {
      if (reportType === 'vendors') {
        walletTotal += Number(r.walletBalance) || 0;
      }
      if (reportType === 'invoices') {
        invoiceTotal += Number(r.invoiceAmount) || 0;
      }
      if (reportType === 'incentives') {
        incentiveTotal += Number(r.amount) || 0;
      }
    });
    return { walletTotal, invoiceTotal, incentiveTotal };
  }, [filteredData, reportType]);

  // Download PDF
  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`${reportType === 'vendors' ? 'Vendors' : reportType === 'invoices' ? 'Invoices' : 'Incentives Wallet'} Report`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);

    const { head, body } = getTableData();
    autoTable(doc, { startY: 32, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [43, 59, 138] } });
    doc.save(`${reportType}_report.pdf`);
  };

  // Download Excel
  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const { head, body } = getTableData();
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportType}_report.xlsx`);
  };

  const getTableData = () => {
    if (reportType === 'vendors') {
      return {
        head: ['#', 'Company Name', 'Mobile', 'Account Number', 'Wallet Balance', 'Status', 'Created'],
        body: filteredData.map((v, i) => [
          i + 1, v.companyName, v.mobileNumber, v.accountNumber,
          `Rs. ${Number(v.walletBalance).toFixed(2)}`, v.status,
          new Date(v.createdAt).toLocaleDateString('en-IN'),
        ]),
      };
    }
    if (reportType === 'invoices') {
      return {
        head: ['#', 'Invoice No', 'Vendor', 'Amount', 'Location', 'Date'],
        body: filteredData.map((inv, i) => [
          i + 1, inv.invoiceNumber, inv.vendor?.companyName || 'N/A',
          `Rs. ${inv.invoiceAmount}`, inv.location,
          new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        ]),
      };
    }
    // incentives
    return {
      head: ['#', 'Vendor', 'Account No', 'Type', 'Amount', 'Balance After', 'Date'],
      body: filteredData.map((t, i) => [
        i + 1, t.vendor?.companyName || 'N/A', t.vendor?.accountNumber || 'N/A',
        t.type, `Rs. ${t.amount}`, `Rs. ${t.balanceAfter}`,
        new Date(t.createdAt).toLocaleDateString('en-IN'),
      ]),
    };
  };

  return (
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 p-8 md:p-10 overflow-auto relative z-10">
          <div className="max-w-[1400px] mx-auto space-y-6">

            <div>
              <h2 className="text-[15px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
              <h1 className="text-[28px] font-bold text-black tracking-tight">Jodhpur Location</h1>
            </div>

            {/* TOP CARD: Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex flex-col md:flex-row">

                {/* Column 1: Report Type */}
                <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
                  <h3 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">Reports</h3>
                  <p className="text-[15px] text-gray-800 mb-4">Select a Report to Download</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'vendors', label: 'Vendors' },
                      { id: 'incentives', label: 'Incentives Wallet' },
                      { id: 'invoices', label: 'Invoices' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setReportType(r.id); setShowResults(false); }}
                        className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                          reportType === r.id ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column 2: Timeline Presets */}
                <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
                  <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline</p>
                  <div className="space-y-4">
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'this_month', label: 'This Month' },
                      { id: 'last_month', label: 'Last Month' },
                      { id: 'last_3_months', label: 'Last 3 Months' },
                      { id: 'last_6_months', label: 'Last 6 Months' },
                      { id: 'last_1_year', label: 'Last 1 Year' },
                    ].map((option) => (
                      <label key={option.id} className="flex items-center gap-3 cursor-pointer">
                        <div className="relative flex items-center justify-center w-[22px] h-[22px]">
                          <input
                            type="radio" name="timeline"
                            checked={timeline === option.id}
                            onChange={() => { setTimeline(option.id); setStartDate(''); setEndDate(''); }}
                            className="peer appearance-none w-[22px] h-[22px] border-[2px] border-gray-300 rounded-full checked:border-[#2B3B8A] transition-colors cursor-pointer"
                          />
                          <div className="absolute w-[10px] h-[10px] rounded-full bg-[#2B3B8A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                        <span className="text-[14px] text-gray-800">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Column 3: Manual Date */}
                <div className="p-8 md:w-1/3">
                  <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline Manually</p>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[13px] text-gray-700">Reports Start Date</label>
                      <input
                        type="date" value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setTimeline('manual'); }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] text-gray-700">Reports End Date</label>
                      <input
                        type="date" value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setTimeline('manual'); }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="border-t border-gray-100 p-6 flex justify-center">
                <button
                  onClick={handleGetReports}
                  disabled={loading}
                  className="bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-60 transition-colors text-white font-semibold px-8 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  {loading ? 'Loading...' : 'Get Reports →'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[14px] text-[#E74C3C] font-medium">{error}</div>
            )}

            {/* Results */}
            {showResults && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Results Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-[28px] font-bold text-gray-900 tracking-tight">
                    {reportType === 'vendors' ? 'Vendors' : reportType === 'invoices' ? 'Invoices' : 'Incentives Wallet'}
                    <span className="text-[15px] font-normal text-gray-500 ml-2">({filteredData.length} records)</span>
                  </h2>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <span>Download In</span>
                      <button onClick={downloadPDF} className="bg-[#E74C3C] hover:bg-red-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">PDF</button>
                      <button onClick={downloadExcel} className="bg-[#2ECC71] hover:bg-green-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">XLS</button>
                    </div>

                    {/* Status filter — only for vendors */}
                    {reportType === 'vendors' && (
                      <div className="relative">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] cursor-pointer"
                        >
                          <option value="">Status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="blocked">Blocked</option>
                        </select>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    )}

                    {/* Search */}
                    <div className="relative w-64">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <input
                        type="text" placeholder="Search" value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-900">
                        <th className="pb-4 pt-2 px-2 font-bold">#</th>
                        {reportType === 'vendors' && <>
                          <th className="pb-4 pt-2 px-2 font-bold">Party Name</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Mobile Number</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Account Number</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Wallet Balance</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Status</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Created</th>
                        </>}
                        {reportType === 'invoices' && <>
                          <th className="pb-4 pt-2 px-2 font-bold">Invoice Number</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Vendor</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Amount (₹)</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Location</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Invoice Date</th>
                        </>}
                        {reportType === 'incentives' && <>
                          <th className="pb-4 pt-2 px-2 font-bold">Vendor</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Account No</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Type</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Amount (₹)</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Balance After</th>
                          <th className="pb-4 pt-2 px-2 font-bold">Date</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 font-medium">
                      {paginatedData.length > 0 ? paginatedData.map((row, i) => (
                        <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="py-5 px-2">{String(i + 1).padStart(2, '0')}</td>
                          {reportType === 'vendors' && <>
                            <td className="py-5 px-2">{row.companyName}</td>
                            <td className="py-5 px-2">{row.mobileNumber}</td>
                            <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.accountNumber}</td>
                            <td className="py-5 px-2">₹{Number(row.walletBalance).toFixed(2)}</td>
                            <td className="py-5 px-2">
                              <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold capitalize ${statusStyles[row.status] || ''}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-5 px-2">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                          </>}
                          {reportType === 'invoices' && <>
                            <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.invoiceNumber}</td>
                            <td className="py-5 px-2">{row.vendor?.companyName || 'N/A'}</td>
                            <td className="py-5 px-2">₹{row.invoiceAmount}</td>
                            <td className="py-5 px-2">{row.location}</td>
                            <td className="py-5 px-2">{new Date(row.invoiceDate).toLocaleDateString('en-IN')}</td>
                          </>}
                          {reportType === 'incentives' && <>
                            <td className="py-5 px-2">{row.vendor?.companyName || 'N/A'}</td>
                            <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{row.vendor?.accountNumber || 'N/A'}</td>
                            <td className="py-5 px-2">
                              <span className={`font-semibold ${row.type === 'credit' ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                                {row.type}
                              </span>
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
                              <p className="text-[12px] text-gray-400">Try changing the timeline or report type</p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Totals Row */}
                      {filteredData.length > 0 && (
                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                          <td className="py-3 px-2">TOTAL</td>
                          {reportType === 'vendors' && <>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2">₹{Number(totals.walletTotal).toFixed(2)}</td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                          </>}
                          {reportType === 'invoices' && <>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2">₹{Number(totals.invoiceTotal).toFixed(2)}</td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                          </>}
                          {reportType === 'incentives' && <>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2">₹{Number(totals.incentiveTotal).toFixed(2)}</td>
                            <td className="py-3 px-2"></td>
                            <td className="py-3 px-2"></td>
                          </>}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-[13px] text-gray-600 font-medium">
                    Showing {paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
                  </p>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        ← Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-[#2B3B8A] text-white'
                                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        {totalPages > 5 && (
                          <span className="text-gray-500 text-sm px-1">...</span>
                        )}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
