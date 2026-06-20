'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const authHeadersMultipart = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Custom Dropdown
const CustomDropdown = ({ label, options, value, onChange, activeDropdown, setActiveDropdown, id }) => {
  const isOpen = activeDropdown === id;
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && isOpen) setActiveDropdown(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

const statusStyles = {
  active:   'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20',
  inactive: 'text-[#E74C3C] bg-[#FDEDEC] border-[#E74C3C]/20',
  blocked:  'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20',
};

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [pageStart, setPageStart] = useState(1);

  useEffect(() => {
    if (pagination.page > pageStart + 5) {
      setPageStart(pagination.page - 5);
    } else if (pagination.page < pageStart) {
      setPageStart(pagination.page);
    }
  }, [pagination.page, pageStart]);

  // Block modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [vendorToBlock, setVendorToBlock] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [divisions, setDivisions] = useState([]);

  // Import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const importFileRef = useRef(null);

  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchQuery) params.append('q', searchQuery);
      if (statusFilter) params.append('status', statusFilter.toLowerCase());
      const res = await fetch(`${API}/api/vendors?${params}`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) { setVendors(data.data); setPagination(data.pagination); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [searchQuery, statusFilter]);

  useEffect(() => { fetchVendors(1); }, [fetchVendors]);

  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data); })
      .catch(() => {});
  }, []);

  // Fetch all for download
  const fetchAll = async () => {
    const res = await fetch(`${API}/api/vendors?limit=10000`, { headers: authHeaders(), credentials: 'include' });
    const data = await res.json();
    return res.ok ? data.data : [];
  };

  const downloadPDF = async () => {
    const all = await fetchAll();
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text('All Party', 14, 18);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Company Name', 'Person Name', 'Account No', 'Mobile', 'Wallet Balance', 'Status', 'Division']],
      body: all.map((v, i) => [i+1, v.companyName, v.personName, v.accountNumber, v.mobileNumber, `Rs. ${Number(v.walletBalance).toFixed(2)}`, v.status, v.division?.name || '']),
      styles: { fontSize: 8 }, headStyles: { fillColor: [43, 59, 138] },
    });
    doc.save('vendors.pdf');
  };

  const downloadExcel = async () => {
    const all = await fetchAll();
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Company Name', 'Person Name', 'Account No', 'Mobile', 'Email', 'Address', 'Wallet Balance', 'Status', 'Division'],
      ...all.map((v, i) => [i+1, v.companyName, v.personName, v.accountNumber, v.mobileNumber, v.email||'', v.address||'', Number(v.walletBalance).toFixed(2), v.status, v.division?.name||'']),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, 'vendors.xlsx');
  };

  // Block
  const handleBlockSubmit = async () => {
    if (!blockReason.trim()) return;
    setBlockLoading(true);
    try {
      const res = await fetch(`${API}/api/vendors/${vendorToBlock._id}/block`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ blockReason }),
      });
      if (res.ok) {
        setVendors(prev => prev.map(v => v._id === vendorToBlock._id ? { ...v, status: 'blocked', blockReason } : v));
        setIsBlockModalOpen(false); setVendorToBlock(null); setBlockReason('');
      }
    } catch { /* silent */ }
    finally { setBlockLoading(false); }
  };

  // Edit
  const openEditModal = (vendor) => {
    setVendorToEdit(vendor);
    // Extract accountNumber suffix (after first dash) and division id
    const rawAccount = vendor.accountNumber || '';
    const accSuffix = rawAccount.includes('-') ? rawAccount.split('-').slice(1).join('-') : rawAccount;
    setEditForm({
      companyName: vendor.companyName,
      personName: vendor.personName,
      mobileNumber: vendor.mobileNumber,
      email: vendor.email || '',
      address: vendor.address || '',
      salesPerson: vendor.salesPerson || '',
      status: vendor.status,
      accountNumber: accSuffix,
      divisionId: vendor.division?._id || '',
      partyCity: vendor.partyCity || '',
      partyType: vendor.partyType || '',
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    setEditLoading(true); setEditError('');
    try {
      const res = await fetch(`${API}/api/vendors/${vendorToEdit._id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Update failed'); return; }
      setVendors(prev => prev.map(v => v._id === vendorToEdit._id ? data.data : v));
      setIsEditModalOpen(false); setVendorToEdit(null);
    } catch { setEditError('Server error'); }
    finally { setEditLoading(false); }
  };

  // Delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const res = await fetch(`${API}/api/vendors/${id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      });
      if (res.ok) {
        setVendors(prev => prev.filter(v => v._id !== id));
        fetchVendors(pagination.page);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete vendor');
      }
    } catch {
      alert('Error deleting vendor');
    }
  };


  // Bulk import
  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImportLoading(true); setImportError(''); setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch(`${API}/api/vendors/bulk-import`, {
        method: 'POST', headers: authHeadersMultipart(), credentials: 'include', body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.message || 'Import failed'); return; }
      setImportResult(data.data);
      fetchVendors(1);
    } catch { setImportError('Server error. Please try again.'); }
    finally { setImportLoading(false); }
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      // Header row — exact same as form fields
      ['Location', 'Party Code', 'Party Name', 'Party City', 'Party Type', 'Mobile No', 'Sales Person Name', 'Email Address'],
      // Sample rows
      ['AJM', 'TRJ028', 'MAHESHWARI MOTORS BEAWAR', 'BEAWAR', 'TRADER/RETAILER', '9876543210', 'Rajesh Kumar', 'maheshwari@example.com'],
      ['AJM', '0454', 'GEHLOT MOTORS', 'MAKRANA', 'MASS', '9876543211', 'Suresh Sharma', ''],
      ['JOH', '3340', 'P.D. MOTORS', 'JODHPUR', 'MASS', '9876543212', 'Amit Singh', ''],
    ]);
    ws['!cols'] = [
      { wch: 12 }, // Location
      { wch: 14 }, // Party Code
      { wch: 30 }, // Party Name
      { wch: 18 }, // Party City
      { wch: 18 }, // Party Type
      { wch: 14 }, // Mobile No
      { wch: 22 }, // Sales Person Name
      { wch: 28 }, // Email Address
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors Template');
    XLSX.writeFile(wb, 'vendor_import_template.xlsx');
  };

  const getVisiblePages = () => {
    let start = pageStart;
    let end = Math.min(pagination.pages, start + 5);
    if (end - start < 5 && pagination.pages > 5) {
      start = pagination.pages - 5;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <>
      {/* Block Modal */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[500px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">Block Party Code</h2>
            <div className="space-y-3 mb-8">
              <label className="block text-[15px] font-medium text-gray-800">Why This Party Code Has Been Blocked</label>
              <textarea rows="5" placeholder="Write a reason..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 text-[15px] text-gray-700 placeholder:text-[#A0ABC0] focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] resize-none transition-all" />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => { setIsBlockModalOpen(false); setVendorToBlock(null); setBlockReason(''); }}
                className="flex-1 bg-[#111111] hover:bg-black text-white font-bold py-4 rounded-xl text-[15px] transition-colors">Cancel</button>
              <button disabled={!blockReason.trim() || blockLoading} onClick={handleBlockSubmit}
                className={`flex-1 font-bold py-4 rounded-xl text-[15px] transition-colors ${blockReason.trim() && !blockLoading ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white' : 'bg-[#8492A6] text-white cursor-not-allowed opacity-90'}`}>
                {blockLoading ? 'Blocking...' : 'Block Party Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[560px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">Edit Party</h2>
            {editError && <div className="mb-4 p-3 bg-[#FDEDEC] rounded-xl text-[13px] text-red-700">{editError}</div>}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Location</label>
                <select value={editForm.divisionId || ''} onChange={(e) => setEditForm(p => ({ ...p, divisionId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]">
                  <option value="">Select Location</option>
                  {divisions.map(d => <option key={d._id} value={d._id}>{d.name} — {d.location}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Party Code</label>
                <input type="text" value={editForm.accountNumber || ''} onChange={(e) => setEditForm(p => ({ ...p, accountNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
                <p className="text-[12px] text-gray-400">Saved as: {divisions.find(d => d._id === editForm.divisionId)?.name || vendorToEdit?.division?.name || '—'}-{editForm.accountNumber || 'XXXXX'}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Party Name</label>
                <input type="text" value={editForm.companyName || ''} onChange={(e) => setEditForm(p => ({ ...p, companyName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Party City</label>
                <input type="text" value={editForm.partyCity || ''} onChange={(e) => setEditForm(p => ({ ...p, partyCity: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Mobile Number</label>
                <input type="text" value={editForm.mobileNumber || ''} onChange={(e) => setEditForm(p => ({ ...p, mobileNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[13px] font-medium text-gray-800">Address</label>
                <input type="text" value={editForm.address || ''} onChange={(e) => setEditForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-800">Status</label>
                <select value={editForm.status || ''} onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-[#111111] hover:bg-black text-white font-bold py-4 rounded-xl text-[15px] transition-colors">Cancel</button>
              <button onClick={handleEditSubmit} disabled={editLoading}
                className={`flex-1 font-bold py-4 rounded-xl text-[15px] transition-colors ${!editLoading ? 'bg-[#007BFF] hover:bg-[#0056b3] text-white' : 'bg-[#8492A6] text-white cursor-not-allowed'}`}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[560px] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Import Vendors via Excel</h2>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportResult(null); setImportError(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!importResult ? (
              <>
                <div className="mb-5 p-4 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl text-[12px] text-gray-600 leading-relaxed">
                  <p className="font-bold text-gray-800 mb-1">Required Excel Columns:</p>
                  <p className="font-mono text-[11px] text-[#2B3B8A]">Location · Party Code · Party Name · Party City · Party Type · Mobile No · Sales Person Name · Email Address</p>
                  <p className="mt-2 text-gray-500">Mobile No must be 10 digits. Location must match an existing division code (e.g. AJM, JOH).</p>
                </div>

                {importError && <div className="mb-4 p-3 bg-[#FDEDEC] rounded-xl text-[13px] text-red-700">{importError}</div>}

                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { setImportFile(e.target.files[0]); setImportError(''); }} />

                <div onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#2B3B8A] hover:bg-[#F4F7FB] transition-all mb-6">
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#2ECC71]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <div className="text-left">
                        <p className="text-[14px] font-semibold text-gray-800">{importFile.name}</p>
                        <p className="text-[12px] text-gray-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300 mx-auto mb-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-[14px] font-medium text-gray-500">Click to upload Excel / CSV file</p>
                      <p className="text-[12px] text-gray-400 mt-1">.xlsx, .xls, .csv — max 5MB</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportError(''); }}
                    className="flex-1 bg-[#111111] hover:bg-black text-white font-bold py-3.5 rounded-xl text-[14px] transition-colors">Cancel</button>
                  <button onClick={handleImportSubmit} disabled={!importFile || importLoading}
                    className={`flex-1 font-bold py-3.5 rounded-xl text-[14px] transition-colors ${importFile && !importLoading ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white' : 'bg-[#8492A6] text-white cursor-not-allowed'}`}>
                    {importLoading ? 'Importing...' : 'Import Vendors'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-4 bg-[#E4F8ED] border border-[#2ECC71]/20 rounded-xl text-center">
                      <p className="text-[28px] font-bold text-[#2ECC71]">{importResult.successCount}</p>
                      <p className="text-[12px] text-green-700 font-medium mt-1">Vendors Imported</p>
                    </div>
                    <div className="flex-1 p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-center">
                      <p className="text-[28px] font-bold text-[#E74C3C]">{importResult.failedCount}</p>
                      <p className="text-[12px] text-red-700 font-medium mt-1">Failed</p>
                    </div>
                  </div>
                  {importResult.failedList?.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                      <table className="w-full text-[12px]">
                        <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-3 py-2 text-left font-semibold text-gray-700">Party Code</th><th className="px-3 py-2 text-left font-semibold text-gray-700">Reason</th></tr></thead>
                        <tbody>{importResult.failedList.map((f, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="px-3 py-2 font-mono text-gray-700">{f.row}</td>
                            <td className="px-3 py-2 text-red-600">{f.reason}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
                <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportResult(null); setImportError(''); }}
                  className="w-full bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-bold py-3.5 rounded-xl text-[14px] transition-colors">Done</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
          <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Header row 1: title + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-[20px] font-bold text-gray-900 tracking-tight whitespace-nowrap">All Party</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/vendors/create"
                className="flex items-center gap-1.5 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-4 py-2 rounded-xl text-[13px] transition-colors whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Vendor
              </Link>
              <button onClick={() => { setIsImportModalOpen(true); setImportResult(null); setImportError(''); setImportFile(null); }}
                className="flex items-center gap-1.5 bg-[#2ECC71] hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-xl text-[13px] transition-colors whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Import Excel
              </button>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 border border-gray-200 hover:border-[#2B3B8A] text-gray-700 hover:text-[#2B3B8A] font-semibold px-4 py-2 rounded-xl text-[13px] transition-colors whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Template
              </button>
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                <span className="whitespace-nowrap">Download In</span>
                <button onClick={downloadPDF} className="bg-[#E74C3C] hover:bg-red-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">PDF</button>
                <button onClick={downloadExcel} className="bg-[#2ECC71] hover:bg-green-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">XLS</button>
              </div>
            </div>
          </div>

          {/* Header row 2: filters */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <CustomDropdown id="status" label="Status" options={['Active', 'Inactive', 'Blocked']}
              value={statusFilter} onChange={setStatusFilter} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
            <div className="relative w-56">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Search vendors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                  <th className="pb-4 pt-2 px-2 font-bold">#</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Party Code</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Party Name</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Party City</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Party Type</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Mobile</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Sales Person</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Email</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Wallet</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Status</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium text-[13px]">
                {loading ? (
                    <tr><td colSpan="11" className="py-10 text-center text-gray-400">Loading...</td></tr>
                ) : vendors.length > 0 ? vendors.map((vendor, i) => (
                  <tr key={vendor._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{String((pagination.page - 1) * 10 + i + 1).padStart(2, '0')}</td>
                    <td className="py-5 px-2 font-semibold text-[#2B3B8A] font-mono text-[12px]">{vendor.accountNumber}</td>
                    <td className="py-5 px-2 font-semibold">{vendor.companyName}</td>
                    <td className="py-5 px-2 text-gray-600">{vendor.partyCity || '—'}</td>
                    <td className="py-5 px-2">
                      {vendor.partyType ? (
                        <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{vendor.partyType}</span>
                      ) : '—'}
                    </td>
                    <td className="py-5 px-2">{vendor.mobileNumber}</td>
                    <td className="py-5 px-2 text-gray-600">{vendor.salesPerson || '—'}</td>
                    <td className="py-5 px-2 text-gray-500 text-[12px]">{vendor.email || '—'}</td>
                    <td className="py-5 px-2">₹{Number(vendor.walletBalance).toFixed(2)}</td>
                    <td className="py-5 px-2">
                      <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold capitalize ${statusStyles[vendor.status] || 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="py-5 px-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(vendor)}
                          className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors">
                          Edit
                        </button>
                        {vendor.status !== 'blocked' ? (
                          <button onClick={() => { setVendorToBlock(vendor); setIsBlockModalOpen(true); }}
                            className="bg-[#1A1A1A] hover:bg-black text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors">
                            Block
                          </button>
                        ) : (
                          <span className="text-[13px] text-gray-400 italic px-2">Blocked</span>
                        )}
                        <button onClick={() => handleDelete(vendor._id)}
                          className="bg-[#E74C3C] hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="12" className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-40">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <p className="text-[14px] font-medium text-gray-500">No vendors found</p>
                        <p className="text-[12px] text-gray-400">Try adjusting your search or filter</p>
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
              Showing {vendors.length} of {pagination.total} vendors
            </p>
            {pagination.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
                <button onClick={() => fetchVendors(pagination.page - 1)} disabled={pagination.page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-40 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                {getVisiblePages().map((p) => (
                  <button key={p} onClick={() => fetchVendors(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${p === pagination.page ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'}`}>
                    {String(p).padStart(2, '0')}
                  </button>
                ))}
                <button onClick={() => fetchVendors(pagination.page + 1)} disabled={pagination.page === pagination.pages}
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
    </>
  );
}
