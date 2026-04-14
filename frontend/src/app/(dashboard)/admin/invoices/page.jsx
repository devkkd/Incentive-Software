'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { dummyInvoices } from '@/data/dummyInvoices'; // Ensure path is correct

// Custom Dropdown Component to match the design perfectly
const CustomDropdown = ({ label, options, value, onChange, activeDropdown, setActiveDropdown, id }) => {
  const isOpen = activeDropdown === id;
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (isOpen) setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setActiveDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`flex items-center justify-between min-w-[120px] px-4 py-2 bg-white border text-[13px] rounded-lg transition-colors ${
          isOpen ? 'border-[#2B3B8A] ring-1 ring-[#2B3B8A]' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="text-gray-700 font-medium truncate pr-4">
          {value || label}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[160px] bg-white border border-gray-100 rounded-lg shadow-lg py-1.5 z-50">
          <button
              onClick={() => {
                onChange(''); // Clear filter option
                setActiveDropdown(null);
              }}
              className={`w-full text-left px-4 py-2 text-[13px] text-gray-500 italic hover:bg-gray-50 transition-colors`}
            >
              Clear Filter
            </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setActiveDropdown(null);
              }}
              className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                value === opt 
                  ? 'bg-[#2B3B8A] text-white font-medium' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminInvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Dropdown States
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [timeline, setTimeline] = useState('');
  const [credited, setCredited] = useState('');
  const [location, setLocation] = useState('');

  // Dropdown Options
  const timelineOptions = ['This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'Last 1 Year'];
  const creditedOptions = ['Credited', 'Debited'];
  const locationOptions = ['Jodhpur', 'Jaipur', 'Bikaner', 'Udaipur', 'Pali'];

  // --- FILTER LOGIC ---
  const filteredInvoices = useMemo(() => {
    return dummyInvoices.filter((invoice) => {
      let matches = true;

      // 1. Search Query Filter (checks vendorName, code, mobile, invNum)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchString = `${invoice.vendorName} ${invoice.vendorCode} ${invoice.mobile} ${invoice.invNum}`.toLowerCase();
        if (!searchString.includes(query)) matches = false;
      }

      // 2. Credited/Debited Filter
      if (credited) {
        if (credited === 'Credited' && invoice.credited === 'NA') matches = false;
        if (credited === 'Debited' && invoice.debited === 'NA') matches = false;
      }

      // 3. Location Filter
      if (location && invoice.location !== location) {
        matches = false;
      }

      // 4. Timeline Filter (Placeholder implementation)
      // Real implementation would require parsing the DD/MM/YYYY string into Date objects
      if (timeline) {
         // Example placeholder logic: assuming all dummy data is "This Month"
         // If "Last Month" is selected, it would hide everything in this dummy set.
         // if(timeline === 'Last Month') matches = false; 
      }

      return matches;
    });
  }, [searchQuery, credited, location, timeline]);

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      
      {/* Page Titles */}
      <div className="mb-6">
        <h2 className="text-[14px] text-gray-700 mb-1">
          Welcome to Faith Trust Commitment - Incentive Management
        </h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">
          Admin Portal
        </h1>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">
            All Invoices
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
              <span>Download In</span>
              <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
              <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
            </div>

            {/* Custom Filters */}
            <CustomDropdown 
              id="timeline"
              label="Timeline" 
              options={timelineOptions} 
              value={timeline} 
              onChange={setTimeline} 
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
            />
            
            <CustomDropdown 
              id="credited"
              label="Credited" 
              options={creditedOptions} 
              value={credited} 
              onChange={setCredited} 
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
            />
            
            <CustomDropdown 
              id="location"
              label="Location/City" 
              options={locationOptions} 
              value={location} 
              onChange={setLocation} 
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
            />

            {/* Search Input */}
            <div className="relative w-64">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input 
                type="text" 
                placeholder="Search Vendors/Invoices" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                <th className="pb-4 font-bold px-2">#</th>
                <th className="pb-4 font-bold px-2">Vendor Name</th>
                <th className="pb-4 font-bold px-2">Vendor Code</th>
                <th className="pb-4 font-bold px-2">Mobile Number</th>
                <th className="pb-4 font-bold px-2">Date and Time</th>
                <th className="pb-4 font-bold px-2">Credited</th>
                <th className="pb-4 font-bold px-2">Debited</th>
                <th className="pb-4 font-bold px-2">Wallet Available Amount</th>
                <th className="pb-4 font-bold px-2">Invoice Date</th>
                <th className="pb-4 font-bold px-2">Invoice Number</th>
                <th className="pb-4 font-bold px-2">Invoice Amount (₹)</th>
                <th className="pb-4 font-bold px-2">Location/City</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium text-[13px]">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{row.id}</td>
                    <td className="py-5 px-2">{row.vendorName}</td>
                    <td className="py-5 px-2">{row.vendorCode}</td>
                    <td className="py-5 px-2">{row.mobile}</td>
                    <td className="py-5 px-2">{row.date}</td>
                    <td className={`py-5 px-2 font-semibold ${row.credited !== 'NA' ? 'text-[#2ECC71]' : 'text-gray-700'}`}>
                      {row.credited}
                    </td>
                    <td className={`py-5 px-2 font-semibold ${row.debited !== 'NA' ? 'text-[#E74C3C]' : 'text-gray-700'}`}>
                      {row.debited}
                    </td>
                    <td className="py-5 px-2">{row.wallet}</td>
                    <td className="py-5 px-2">{row.invDate}</td>
                    <td className="py-5 px-2">{row.invNum}</td>
                    <td className="py-5 px-2">{row.invAmount}</td>
                    <td className="py-5 px-2">{row.location}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="py-10 text-center text-gray-500">
                    No invoices match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <p className="text-[13px] text-gray-600 font-medium">
            Show Results {filteredInvoices.length > 0 ? '10' : '0'} of {filteredInvoices.length}
          </p>
          {filteredInvoices.length > 0 && (
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
          )}
        </div>

      </div>
    </div>
  );
}