'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { dummyVendors } from '@/data/dummyVendors'; 

export default function AdminViewVendorPage() {
  const params = useParams();
  const router = useRouter();
  
  // Safely extract the ID from the URL params
  const vendorId = params?.id;
  
  // Find the specific vendor by ID
  const vendor = dummyVendors.find(v => v.id === vendorId);

  // Modal States
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Helper for status badge styles
  const getStatusStyles = (status) => {
    switch (status) {
      case 'Active':
        return 'text-[#2ECC71] bg-[#E4F8ED] border border-[#2ECC71]/20';
      case 'Inactive':
        return 'text-[#E74C3C] bg-[#FDEDEC] border border-[#E74C3C]/20';
      case 'Blocked':
        return 'text-[#64748B] bg-[#F1F5F9] border border-[#64748B]/20';
      default:
        return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  // Block Modal Handlers
  const handleOpenBlockModal = () => setIsBlockModalOpen(true);
  const handleCloseBlockModal = () => {
    setIsBlockModalOpen(false);
    setBlockReason('');
  };
  const handleBlockSubmit = () => {
    console.log(`Blocking vendor ${vendor?.id} for reason: ${blockReason}`);
    handleCloseBlockModal();
  };

  // Unblock Modal Handlers
  const handleOpenUnblockModal = () => setIsUnblockModalOpen(true);
  const handleCloseUnblockModal = () => setIsUnblockModalOpen(false);
  const handleUnblockSubmit = () => {
    console.log(`Unblocking vendor ${vendor?.id}`);
    handleCloseUnblockModal();
  };

  // If someone navigates to an invalid ID
  if (!vendor) {
    return (
      <div className="flex h-full bg-[#EAF2F9] font-sans text-gray-900">
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vendor Not Found</h2>
            <button onClick={() => router.push('/admin/vendors')} className="text-[#2B3B8A] hover:underline font-medium">
              ← Back to Vendors
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isBlocked = vendor.status === 'Blocked';

  return (
    <>
      {/* Block Vendor Modal Overlay */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[500px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-[26px] font-bold text-gray-900 mb-6 tracking-tight">
              Block Party Code
            </h2>

            <div className="space-y-3 mb-8">
              <label className="block text-[15px] font-medium text-gray-800">
                Why This Party Code Has Been Blocked
              </label>
              <textarea
                rows="5"
                placeholder="Write a reason explaining why this party code has been blocked."
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
                Block Party Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Vendor Modal Overlay */}
      {isUnblockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-[500px] shadow-2xl animate-in fade-in zoom-in duration-200 text-center">
            <h2 className="text-[26px] font-bold text-gray-900 mb-4 tracking-tight">
              Unblock Account
            </h2>
            <p className="text-[15px] text-gray-600 mb-8 leading-relaxed">
              Are you sure you want to unblock {vendor.companyName}'s account? They will regain access to the platform.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={handleCloseUnblockModal}
                className="flex-1 bg-[#111111] hover:bg-black transition-colors text-white font-bold py-4 rounded-xl text-[15px]"
              >
                Cancel
              </button>
              <button
                onClick={handleUnblockSubmit}
                className="flex-1 bg-[#2B3395] hover:bg-[#1f256e] transition-colors text-white font-bold py-4 rounded-xl text-[15px] shadow-md"
              >
                Unblock Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className="p-8 md:p-10 max-w-[1400px] mx-auto space-y-6">

        {/* TOP CARD: Vendors Account Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">
              Vendors Account Details
            </h2>
            <div className="flex gap-3">
              <Link 
                href={`/admin/vendors/edit/${vendor.id}`}
                className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
              >
                Edit Account
              </Link>
              
              {/* Conditional Rendering based on Vendor Status */}
              {isBlocked ? (
                <button 
                  onClick={handleOpenUnblockModal}
                  className="bg-[#2B3395] hover:bg-[#1f256e] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Unblock Account
                </button>
              ) : (
                <button 
                  onClick={handleOpenBlockModal}
                  className="bg-[#1A1A1A] hover:bg-black text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Block Account
                </button>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="p-8 flex flex-col lg:flex-row gap-10">
            
            {/* Info Columns Wrapper */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 border-r border-gray-100 pr-0 lg:pr-10">
              
              {/* Column 1 */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">Party Name</span>
                  <span className="text-[14px] font-bold text-gray-900">{vendor.companyName.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">Party Person Name</span>
                  <span className="text-[14px] font-bold text-gray-900">{vendor.personName}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">Party Mobile Number</span>
                  <span className="text-[14px] font-bold text-gray-900">{vendor.mobileNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">Party Code</span>
                  <span className="text-[14px] font-bold text-gray-900">{vendor.accountNumber}</span>
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">Vendor Address</span>
                  <span className="text-[14px] font-bold text-gray-900">100, abcd Street</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">City</span>
                  <span className="text-[14px] font-bold text-gray-900">Jodhpur</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="text-[14px] text-gray-600">State</span>
                  <span className="text-[14px] font-bold text-gray-900">Rajasthan</span>
                </div>
                <div className="grid grid-cols-2 gap-4 items-center">
                  <span className="text-[14px] text-gray-600">Status</span>
                  <div>
                    <span className={`px-4 py-1.5 rounded-lg text-xs font-bold ${getStatusStyles(vendor.status)}`}>
                      {vendor.status}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Column 3: Green Wallet Card */}
            <div className="w-full lg:w-[320px] shrink-0">
              <div className="bg-[#E4F8ED] p-6 rounded-[20px] h-full flex flex-col justify-center">
                <p className="text-[14px] text-gray-700 font-medium mb-1">Incentives Wallet Available Amount</p>
                <h2 className="text-[34px] font-bold text-black mb-6">₹{vendor.walletAvailable}</h2>
                <div className="text-[12px] text-gray-800 font-medium space-y-1">
                  <p className="text-gray-600 mb-1.5">Last Redemption</p>
                  <p>
                    Amount : <span className="font-bold text-black">₹{vendor.lastRedemptionAmount}</span> | Date : <span className="font-bold text-black">{vendor.lastRedemptionDate}</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM CARD: Incentives Wallet History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          
          <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
            <h3 className="text-[22px] font-bold text-black tracking-tight">Incentives Wallet History</h3>
            <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <span>Download In</span>
              <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
              <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900">
                  <th className="pb-4 font-bold">#</th>
                  <th className="pb-4 font-bold">Date and Time</th>
                  <th className="pb-4 font-bold">Credited</th>
                  <th className="pb-4 font-bold">Debited</th>
                  <th className="pb-4 font-bold">Wallet Available Amount</th>
                  <th className="pb-4 font-bold">Invoice Date</th>
                  <th className="pb-4 font-bold">Invoice Number</th>
                  <th className="pb-4 font-bold">Invoice Amount (₹)</th>
                  <th className="pb-4 font-bold">Location/City</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium">
                {vendor.history.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 pr-4">{row.id}</td>
                    <td className="py-5 pr-4">{row.date}</td>
                    <td className="py-5 pr-4 font-semibold text-[#2ECC71]">{row.credited}</td>
                    <td className="py-5 pr-4 font-semibold text-[#E74C3C]">{row.debited}</td>
                    <td className="py-5 pr-4">{row.available}</td>
                    <td className="py-5 pr-4">{row.invDate}</td>
                    <td className="py-5 pr-4">{row.invNum}</td>
                    <td className="py-5 pr-4">{row.invAmount}</td>
                    <td className="py-5 pr-4">{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </>
  );
}