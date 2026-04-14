'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { dummyVendors } from '@/data/dummyVendors';

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [vendorToBlock, setVendorToBlock] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  // Function to return appropriate tailwind classes based on status
  const getStatusStyles = (status) => {
    switch (status) {
      case 'Active':
        return 'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20';
      case 'Inactive':
        return 'text-[#E74C3C] bg-[#FDEDEC] border-[#E74C3C]/20';
      case 'Blocked':
        return 'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const handleOpenBlockModal = (vendor) => {
    setVendorToBlock(vendor);
    setIsBlockModalOpen(true);
  };

  const handleCloseBlockModal = () => {
    setIsBlockModalOpen(false);
    setVendorToBlock(null);
    setBlockReason('');
  };

  const handleBlockSubmit = () => {
    // Implement your block logic here (e.g., API call)
    console.log(`Blocking vendor ${vendorToBlock?.id} for reason: ${blockReason}`);
    handleCloseBlockModal();
  };

  return (
    <>
      {/* Block Vendor Modal Overlay */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[500px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">
              Block Vendor Account
            </h2>

            <div className="space-y-3 mb-8">
              <label className="block text-[15px] font-medium text-gray-800">
                Why This Vendor Account Has Been Blocked
              </label>
              <textarea
                rows="5"
                placeholder="Write a reason explaining why this vendor account has been blocked."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 text-[15px] text-gray-700 placeholder:text-[#A0ABC0] focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent resize-none transition-all"
              ></textarea>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleCloseBlockModal}
                className="flex-1 bg-[#111111] hover:bg-black transition-colors text-white font-bold py-4 rounded-xl text-[15px]"
              >
                Cancel
              </button>
              <button
                disabled={!blockReason.trim()}
                onClick={handleBlockSubmit}
                className={`flex-1 font-bold py-4 rounded-xl text-[15px] transition-colors duration-300 ${
                  blockReason.trim()
                    ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-md'
                    : 'bg-[#8492A6] text-white cursor-not-allowed opacity-90'
                }`}
              >
                Block Vendor Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <main className="w-full flex-1 p-8 md:p-10 overflow-auto relative z-10">
        <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">
              Vendors
            </h1>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 text-sm font-medium text-gray-700 mr-2">
                <span>Download In</span>
                {/* Dummy Download Icons */}
                <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
                <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
              </div>

              {/* Status Dropdown */}
              <div className="relative">
                <select className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] cursor-pointer">
                  <option value="">Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {/* Search Input */}
              <div className="relative w-64">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 text-gray-900">
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
              <tbody className="text-gray-700 font-medium">
                {dummyVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{vendor.id}</td>
                    <td className="py-5 px-2">{vendor.companyName}</td>
                    <td className="py-5 px-2">{vendor.mobileNumber}</td>
                    <td className="py-5 px-2">{vendor.accountNumber}</td>
                    <td className="py-5 px-2">₹{vendor.walletAvailable}</td>
                    <td className="py-5 px-2">₹{vendor.lastRedemptionAmount}, {vendor.lastRedemptionDate}</td>
                    <td className="py-5 px-2">{vendor.accountCreatedLocation} | {vendor.accountCreatedDate}</td>
                    <td className="py-5 px-2">
                      <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold ${getStatusStyles(vendor.status)}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="py-5 px-2">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/branch/vendors/view/${vendor.id}`} 
                          className="bg-[#2B3B8A] hover:bg-[#1f2b66] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
                        >
                          View
                        </Link>
                        <Link 
                          href={`/branch/vendors/edit/${vendor.id}`} 
                          className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
                        >
                          Edit
                        </Link>
                        <button 
                          onClick={() => handleOpenBlockModal(vendor)}
                          className="bg-[#1A1A1A] hover:bg-black text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
                        >
                          Block
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Section */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <p className="text-[13px] text-gray-600 font-medium">
              Show Results 10 of 657
            </p>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] transition-colors text-[13px] font-semibold">
                01
              </button>
              {['02', '03', '04', '05'].map((page) => (
                <button key={page} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#8492A6] text-white hover:bg-gray-500 transition-colors text-[13px] font-semibold">
                  {page}
                </button>
              ))}
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2B3B8A] text-white hover:bg-[#1f2b66] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}