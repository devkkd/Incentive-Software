'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { dummyInvoices } from '@/data/dummyInvoices';
import { dummyVendors } from '@/data/dummyVendors';

// --- CUSTOM DROPDOWN COMPONENT ---
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
        className={`flex items-center justify-between min-w-[130px] px-4 py-2.5 bg-white border text-[13px] rounded-lg transition-colors ${
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


// --- MAIN PAGE COMPONENT ---
export default function AdminReportsPage() {
  // ----------------------------------------------------
  // TOP CONFIGURATION FILTERS
  // ----------------------------------------------------
  const [reportType, setReportType] = useState('vendors');
  const [timeline, setTimeline] = useState('this_month'); // Preset option
  const [startDate, setStartDate] = useState(''); // Manual Date
  const [endDate, setEndDate] = useState('');     // Manual Date
  
  // Results State
  const [showResults, setShowResults] = useState(false);

  // ----------------------------------------------------
  // TABLE FILTERS
  // ----------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  
  // Specific Table Filter States
  const [statusFilter, setStatusFilter] = useState('');
  const [creditedFilter, setCreditedFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Helper to parse "DD/MM/YYYY" to JS Date object
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  // Helper to get Date Range from preset string
  const getDateRange = () => {
    if (timeline === 'manual' && startDate && endDate) {
      return { start: new Date(startDate), end: new Date(endDate) };
    }

    const today = new Date();
    // Use April 2026 as current reference context based on dummy data timeline
    const currentYear = 2026;
    const currentMonth = 3; // April (0-indexed)
    
    let start, end;

    switch (timeline) {
      case 'this_month':
        start = new Date(currentYear, currentMonth, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;
      case 'last_month': // March (where dummy data lies)
        start = new Date(currentYear, currentMonth - 1, 1);
        end = new Date(currentYear, currentMonth, 0);
        break;
      case 'last_3_months':
        start = new Date(currentYear, currentMonth - 3, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;
      case 'last_6_months':
        start = new Date(currentYear, currentMonth - 6, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;
      case 'last_1_year':
        start = new Date(currentYear - 1, currentMonth, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;
      default:
        return null;
    }
    return { start, end };
  };

  // --- FILTER EXECUTION ---
  const filteredData = useMemo(() => {
    const range = getDateRange();

    if (reportType === 'vendors') {
      return dummyVendors.filter((vendor) => {
        let matches = true;

        // 1. Top Level Date Filter
        if (range && range.start && range.end) {
          const itemDate = parseDate(vendor.accountCreatedDate);
          if (itemDate) {
            // Set time to midnight for accurate day comparison
            itemDate.setHours(0,0,0,0);
            range.start.setHours(0,0,0,0);
            range.end.setHours(23,59,59,999);
            if (itemDate < range.start || itemDate > range.end) matches = false;
          }
        }

        // 2. Search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchString = `${vendor.companyName} ${vendor.mobileNumber} ${vendor.accountNumber}`.toLowerCase();
          if (!searchString.includes(query)) matches = false;
        }

        // 3. Status Filter
        if (statusFilter && vendor.status !== statusFilter) {
          matches = false;
        }

        return matches;
      });
    }

    if (reportType === 'invoices') {
      return dummyInvoices.filter((invoice) => {
        let matches = true;

        // 1. Top Level Date Filter
        if (range && range.start && range.end) {
          const itemDate = parseDate(invoice.date);
          if (itemDate) {
            itemDate.setHours(0,0,0,0);
            range.start.setHours(0,0,0,0);
            range.end.setHours(23,59,59,999);
            if (itemDate < range.start || itemDate > range.end) matches = false;
          }
        }

        // 2. Search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchString = `${invoice.vendorName} ${invoice.vendorCode} ${invoice.mobile} ${invoice.invNum}`.toLowerCase();
          if (!searchString.includes(query)) matches = false;
        }

        // 3. Credited/Debited Filter
        if (creditedFilter) {
          if (creditedFilter === 'Credited' && invoice.credited === 'NA') matches = false;
          if (creditedFilter === 'Debited' && invoice.debited === 'NA') matches = false;
        }

        // 4. Location
        if (locationFilter && invoice.location !== locationFilter) {
          matches = false;
        }

        return matches;
      });
    }

    return [];
  }, [searchQuery, statusFilter, creditedFilter, locationFilter, reportType, timeline, startDate, endDate]);


  // Helper for status badge
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
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">
      
      {/* Page Titles */}
      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">
          Welcome to Faith Trust Commitment - Incentive Management
        </h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">
          Admin Portal
        </h1>
      </div>

      {/* TOP CARD: Configuration / Filters */}
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
                onClick={() => { setReportType('vendors'); setShowResults(false); }}
                className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  reportType === 'vendors' ? 'bg-[#2B3B8A] text-white shadow-sm' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                }`}
              >
                Vendors/Party
              </button>
              <button 
                onClick={() => { setReportType('invoices'); setShowResults(false); }}
                className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  reportType === 'invoices' ? 'bg-[#2B3B8A] text-white shadow-sm' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                }`}
              >
                Invoices
              </button>
              <button 
                onClick={() => { setReportType('incentives'); setShowResults(false); }}
                className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  reportType === 'incentives' ? 'bg-[#2B3B8A] text-white shadow-sm' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                }`}
              >
                Incentives Wallet
              </button>
              <button 
                onClick={() => { setReportType('divisions'); setShowResults(false); }}
                className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  reportType === 'divisions' ? 'bg-[#2B3B8A] text-white shadow-sm' : 'bg-[#8492A6] text-white hover:bg-gray-500'
                }`}
              >
                FTC Incentive All Division
              </button>
            </div>
          </div>

          {/* Column 2: Timeline */}
          <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100">
            <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline</p>
            <div className="space-y-4">
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month (March)' },
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
          <div className="p-8 md:w-1/3 flex flex-col justify-center">
            <p className="text-[15px] text-gray-800 mb-6">Select A Reports Timeline Manually</p>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[13px] text-gray-700">Reports Start Date</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setTimeline('manual');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] text-gray-700">Reports End Date</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setTimeline('manual');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Action Area */}
        <div className="border-t border-gray-100 p-6 flex justify-center bg-white">
          <button 
            onClick={() => setShowResults(true)}
            className="bg-[#8492A6] hover:bg-[#6c7b94] transition-colors text-white font-semibold px-10 py-3 rounded-xl flex items-center justify-center gap-2"
          >
            Get Reports <span>→</span>
          </button>
        </div>
      </div>

      {/* BOTTOM CARD: Results Table (Conditionally Rendered) */}
      {showResults && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Header Section */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-100 pb-6">
            
            <h2 className="text-[26px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {reportType === 'invoices' && 'Invoices'}
              {reportType === 'vendors' && 'Vendors'}
              {reportType === 'incentives' && 'Incentives Wallet'}
              {reportType === 'divisions' && 'Divisions'}
              <span className="text-[15px] font-normal text-gray-500 tracking-normal">
                (Data Preview)
              </span>
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
                <span>Download In</span>
                <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
                <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
              </div>

              {/* Conditionally Render Dropdowns based on report type */}
              {reportType === 'vendors' && (
                <CustomDropdown 
                  id="statusFilter"
                  label="Status" 
                  options={['Active', 'Inactive', 'Blocked']} 
                  value={statusFilter} 
                  onChange={setStatusFilter} 
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              )}

              {reportType === 'invoices' && (
                <>
                  <CustomDropdown 
                    id="credited"
                    label="Credited" 
                    options={['Credited', 'Debited']} 
                    value={creditedFilter} 
                    onChange={setCreditedFilter} 
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                  />
                  <CustomDropdown 
                    id="location"
                    label="Location/City" 
                    options={['Jodhpur', 'Jaipur', 'Bikaner', 'Udaipur', 'Pali']} 
                    value={locationFilter} 
                    onChange={setLocationFilter} 
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                  />
                </>
              )}

              {/* Search Input */}
              <div className="relative w-64">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left whitespace-nowrap">
              
              {/* Dynamic Table Header */}
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900 text-[13px]">
                  <th className="pb-4 font-bold px-2">#</th>
                  {reportType === 'vendors' ? (
                    <>
                      <th className="pb-4 font-bold px-2">Vendor Company Name</th>
                      <th className="pb-4 font-bold px-2">Vendor Mobile Number</th>
                      <th className="pb-4 font-bold px-2">Vendor Account Number</th>
                      <th className="pb-4 font-bold px-2">Wallet Available Amount</th>
                      <th className="pb-4 font-bold px-2">Last Redemption</th>
                      <th className="pb-4 font-bold px-2">Account Created</th>
                      <th className="pb-4 font-bold px-2">Status</th>
                      <th className="pb-4 font-bold px-2">Action</th>
                    </>
                  ) : reportType === 'invoices' ? (
                    <>
                      <th className="pb-4 font-bold px-2">Vendor Name</th>
                      <th className="pb-4 font-bold px-2">Vendor Code</th>
                      <th className="pb-4 font-bold px-2">Mobile Number</th>
                      <th className="pb-4 font-bold px-2">Date and Time</th>
                      <th className="pb-4 font-bold px-2">Credited</th>
                      <th className="pb-4 font-bold px-2">Debited</th>
                      <th className="pb-4 font-bold px-2">Wallet Amount</th>
                      <th className="pb-4 font-bold px-2">Invoice Num</th>
                      <th className="pb-4 font-bold px-2">Location</th>
                    </>
                  ) : (
                    <th className="pb-4 font-bold px-2 text-gray-500">Feature pending...</th>
                  )}
                </tr>
              </thead>

              {/* Dynamic Table Body */}
              <tbody className="text-gray-700 font-medium text-[13px]">
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => {
                    if (reportType === 'vendors') {
                      return (
                        <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="py-5 px-2">{row.id}</td>
                          <td className="py-5 px-2">{row.companyName}</td>
                          <td className="py-5 px-2">{row.mobileNumber}</td>
                          <td className="py-5 px-2">{row.accountNumber}</td>
                          <td className="py-5 px-2">₹{row.walletAvailable}</td>
                          <td className="py-5 px-2">₹{row.lastRedemptionAmount}, {row.lastRedemptionDate}</td>
                          <td className="py-5 px-2">{row.accountCreatedLocation} | {row.accountCreatedDate}</td>
                          <td className="py-5 px-2">
                            <span className={`px-3 py-1.5 rounded-lg border text-[13px] font-semibold ${getStatusStyles(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-5 px-2">
                            <div className="flex items-center gap-2">
                              <Link 
                                href={`/admin/vendors/view/${row.id}`} 
                                className="bg-[#2B3B8A] hover:bg-[#1f2b66] text-white px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
                              >
                                View
                              </Link>
                              <Link 
                                href={`/admin/vendors/edit/${row.id}`} 
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
                      );
                    } else if (reportType === 'invoices') {
                      return (
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
                          <td className="py-5 px-2">{row.invNum}</td>
                          <td className="py-5 px-2">{row.location}</td>
                        </tr>
                      );
                    }
                    return null;
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="py-10 text-center text-gray-500">
                      No data matches your current timeline or filters. <br/>
                      <span className="text-xs mt-1 block">Try selecting "Last Month (March)" as the dummy data dates are in March 2026.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Section */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <p className="text-[13px] text-gray-600 font-medium">
              Show Results {filteredData.length > 0 ? '10' : '0'} of {filteredData.length}
            </p>
            {filteredData.length > 0 && (
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
      )}

    </div>
  );
}