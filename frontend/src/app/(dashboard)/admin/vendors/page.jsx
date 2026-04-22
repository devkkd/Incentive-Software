'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
    doc.setFontSize(16); doc.text('All Vendors/Party', 14, 18);
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
    setEditForm({ companyName: vendor.companyName, personName: vendor.personName, mobileNumber: vendor.mobileNumber, email: vendor.email || '', address: vendor.address || '', status: vendor.status });
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
      setVendors(prev => prev.map(v => v._id === vendorToEdit._id ? { ...v, ...editForm } : v));
      setIsEditModalOpen(false); setVendorToEdit(null);
    } catch { setEditError('Server error'); }
    finally { setEditLoading(false); }
  };

  return (
    <>
      {/* Block Modal */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[500px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">Block Vendor Account</h2>
            <div className="space-y-3 mb-8">
              <label className="block text-[15px] font-medium text-gray-800">Why This Vendor Account Has Been Blocked</label>
              <textarea rows="5" placeholder="Write a reason..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 text-[15px] text-gray-700 placeholder:text-[#A0ABC0] focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] resize-none transition-all" />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => { setIsBlockModalOpen(false); setVendorToBlock(null); setBlockReason(''); }}
                className="flex-1 bg-[#111111] hover:bg-black text-white font-bold py-4 rounded-xl text-[15px] transition-colors">Cancel</button>
              <button disabled={!blockReason.trim() || blockLoading} onClick={handleBlockSubmit}
                className={`flex-1 font-bold py-4 rounded-xl text-[15px] transition-colors ${blockReason.trim() && !blockLoading ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white' : 'bg-[#8492A6] text-white cursor-not-allowed opacity-90'}`}>
                {blockLoading ? 'Blocking...' : 'Block Vendor Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[560px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">Edit Vendor</h2>
            {editError && <div className="mb-4 p-3 bg-[#FDEDEC] rounded-xl text-[13px] text-red-700">{editError}</div>}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: 'Company Name', key: 'companyName' },
                { label: 'Person Name', key: 'personName' },
                { label: 'Mobile Number', key: 'mobileNumber' },
                { label: 'Email', key: 'email' },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">{label}</label>
                  <input type="text" value={editForm[key] || ''} onChange={(e) => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
                </div>
              ))}
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

      <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
          <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">All Vendors/Party</h2>
            <div className="flex flex-wrap items-center gap-3">
              {/* Create Vendor Button */}
              <Link
                href="/admin/vendors/create"
                className="flex items-center gap-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Vendor
              </Link>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
                <span>Download In</span>
                <button onClick={downloadPDF} className="bg-[#E74C3C] hover:bg-red-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">PDF</button>
                <button onClick={downloadExcel} className="bg-[#2ECC71] hover:bg-green-600 text-white text-[10px] font-bold px-1.5 py-1 rounded transition-colors">XLS</button>
              </div>
              <CustomDropdown id="status" label="Status" options={['Active', 'Inactive', 'Blocked']}
                value={statusFilter} onChange={setStatusFilter} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
              <div className="relative w-64">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                  <th className="pb-4 pt-2 px-2 font-bold">#</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Vendor Company Name</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Vendor Mobile Number</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Vendor Account Number</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Wallet Available Amount</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Last Redemption</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Account Created</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Status</th>
                  <th className="pb-4 pt-2 px-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium text-[13px]">
                {loading ? (
                  <tr><td colSpan="9" className="py-10 text-center text-gray-400">Loading...</td></tr>
                ) : vendors.length > 0 ? vendors.map((vendor, i) => (
                  <tr key={vendor._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{String((pagination.page - 1) * 10 + i + 1).padStart(2, '0')}</td>
                    <td className="py-5 px-2">{vendor.companyName}</td>
                    <td className="py-5 px-2">{vendor.mobileNumber}</td>
                    <td className="py-5 px-2 font-semibold text-[#2B3B8A]">{vendor.accountNumber}</td>
                    <td className="py-5 px-2">₹{Number(vendor.walletBalance).toFixed(2)}</td>
                    <td className="py-5 px-2">
                      {vendor.lastRedemptionAmount > 0
                        ? `₹${vendor.lastRedemptionAmount} | ${vendor.lastRedemptionDate ? new Date(vendor.lastRedemptionDate).toLocaleDateString('en-IN') : 'N/A'}`
                        : '—'}
                    </td>
                    <td className="py-5 px-2">{vendor.division?.name || '—'} | {new Date(vendor.createdAt).toLocaleDateString('en-IN')}</td>
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
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center">
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
              <div className="flex items-center gap-1.5">
                <button onClick={() => fetchVendors(pagination.page - 1)} disabled={pagination.page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] disabled:opacity-40 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
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
