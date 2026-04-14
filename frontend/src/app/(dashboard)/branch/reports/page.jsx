'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { dummyVendors } from '@/data/dummyVendors';

export default function ReportsPage() {
  // Filter States
  const [reportType, setReportType] = useState('vendors');
  const [timeline, setTimeline] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Results State
  const [showResults, setShowResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleGetReports = () => {
    // In a real app, you would fetch/filter data here based on the states above.
    setShowResults(true);
  };

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

  return (
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900">
      
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Main Dashboard Content */}
        <main className="flex-1 p-8 md:p-10 overflow-auto relative z-10">
          <div className="max-w-[1400px] mx-auto space-y-6">

            {/* Page Header */}
            <div>
              <h2 className="text-[15px] text-gray-700 mb-1">
                Welcome to Faith Trust Commitment - Incentive Management
              </h2>
              <h1 className="text-[28px] font-bold text-black tracking-tight">
                Jodhpur Division
              </h1>
            </div>

            {/* TOP CARD: Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              
              <div className="flex flex-col md:flex-row">
                
                {/* Column 1: Select Report */}
                <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
                  <h3 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">
                    Reports
                  </h3>
                  <p className="text-[15px] text-gray-800 mb-4">Select a Report to Download</p>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => setReportType('vendors')}
                      className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                        reportType === 'vendors' ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                      }`}
                    >
                      Vendors
                    </button>
                    <button 
                      onClick={() => setReportType('incentives')}
                      className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                        reportType === 'incentives' ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                      }`}
                    >
                      Incentives Wallet
                    </button>
                    <button 
                      onClick={() => setReportType('invoices')}
                      className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                        reportType === 'invoices' ? 'bg-[#2B3B8A] text-white' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                      }`}
                    >
                      Upload Invoices
                    </button>
                  </div>
                </div>

                {/* Column 2: Timeline */}
                <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
                  <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline</p>
                  <div className="space-y-4">
                    {[
                      { id: 'this_month', label: 'This Month' },
                      { id: 'last_month', label: 'Last Month' },
                      { id: 'last_3_months', label: 'Last 3 Months' },
                      { id: 'last_6_months', label: 'Last 6 Months' },
                      { id: 'last_1_year', label: 'Last 1 Year' }
                    ].map((option) => (
                      <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center w-[22px] h-[22px]">
                          <input 
                            type="radio" 
                            name="timeline" 
                            checked={timeline === option.id}
                            onChange={() => {
                              setTimeline(option.id);
                              // Reset manual dates if a preset is selected
                              setStartDate('');
                              setEndDate('');
                            }}
                            className="peer appearance-none w-[22px] h-[22px] border-[2px] border-gray-300 rounded-full checked:border-[#2B3B8A] transition-colors cursor-pointer"
                          />
                          <div className="absolute w-[10px] h-[10px] rounded-full bg-[#2B3B8A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"></div>
                        </div>
                        <span className="text-[14px] text-gray-800">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Column 3: Manual Timeline */}
                <div className="p-8 md:w-1/3">
                  <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline Manually</p>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[13px] text-gray-700">Reports Start Date</label>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setTimeline('manual');
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] text-gray-700">Reports End Date</label>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setTimeline('manual');
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Area */}
              <div className="border-t border-gray-100 p-6 flex justify-center">
                <button 
                  onClick={handleGetReports}
                  className="bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white font-semibold px-8 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  Get Reports <span>→</span>
                </button>
              </div>
            </div>

            {/* BOTTOM CARD: Results Table (Conditionally Rendered) */}
            {showResults && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-[28px] font-bold text-gray-900 tracking-tight">
                    {reportType === 'vendors' ? 'Vendors' : reportType === 'incentives' ? 'Incentives Wallet' : 'Upload Invoices'}
                  </h2>

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
                              <button className="bg-[#1A1A1A] hover:bg-black text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors">
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
                    Show Results 10 of {dummyVendors.length}
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
            )}

          </div>
        </main>

      </div>
    </div>
  );
}