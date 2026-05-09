'use client';

import React, { useState, useEffect, useCallback } from 'react';

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

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchQuery) params.append('q', searchQuery);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${API}/api/vendors?${params}`, {
        headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setVendors(data.data);
        setPagination(data.pagination);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [searchQuery, statusFilter]);

  useEffect(() => { fetchVendors(1); }, [fetchVendors]);

  return (
    <main className="w-full flex-1 p-8 md:p-10 overflow-auto">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Vendors</h1>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] cursor-pointer">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Search vendors..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] transition-colors" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 text-gray-900">
                <th className="pb-4 pt-2 px-2 font-bold">#</th>
                <th className="pb-4 pt-2 px-2 font-bold">Party Name</th>
                <th className="pb-4 pt-2 px-2 font-bold">Mobile Number</th>
                <th className="pb-4 pt-2 px-2 font-bold">Account Number</th>
                <th className="pb-4 pt-2 px-2 font-bold">Wallet Balance</th>
                <th className="pb-4 pt-2 px-2 font-bold">Last Redemption</th>
                <th className="pb-4 pt-2 px-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium">
              {loading ? (
                <tr><td colSpan="7" className="py-10 text-center text-gray-400">Loading...</td></tr>
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
                      : 'No redemption yet'}
                  </td>
                  <td className="py-5 px-2">
                    <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold capitalize ${statusStyles[vendor.status] || 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                      {vendor.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
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
        {pagination.pages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <p className="text-[13px] text-gray-600 font-medium">
              Showing {vendors.length} of {pagination.total} vendors
            </p>
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
          </div>
        )}

      </div>
    </main>
  );
}
