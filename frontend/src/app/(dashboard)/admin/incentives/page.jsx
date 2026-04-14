'use client';

import React, { useState, useRef, useMemo } from 'react';

// Dummy data for Upload Incentives History
const dummyHistory = [
  { id: "01", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Weekly" },
  { id: "02", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Daily" },
  { id: "03", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Monthly" },
  { id: "04", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Daily" },
  { id: "05", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Daily" },
  { id: "06", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Monthly" },
  { id: "07", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Weekly" },
  { id: "08", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Monthly" },
  { id: "09", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Monthly" },
  { id: "10", date: "19/03/2026", location: "Jodhpur", division: "FTC - Jodhpur", amount: "₹24600.00", frequency: "Weekly" },
];

export default function AdminIncentivesPage() {
  // States: 'idle', 'otp', 'success'
  const [uploadState, setUploadState] = useState('idle');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // OTP States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isVerified, setIsVerified] = useState(false); // Controls the green Verified button state
  
  const otpInputRefs = useRef([]);
  const fileInputRef = useRef(null);

  // File Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadState('idle'); // Reset state if a new file is selected
    }
  };

  const handleUploadClick = () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }
    // Transition to OTP state
    setUploadState('otp');
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setIsVerified(false);
  };

  // OTP Logic
  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); // keep only last digit
    setOtp(newOtp);

    // Move to next input automatically
    if (value && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOTP = () => {
    const enteredOtp = otp.join('');
    // Dummy OTP validation (e.g., 888888)
    if (enteredOtp === '888888') {
      setOtpError('');
      setIsVerified(true);
      
      // Show the green verified button for 1 second, then transition to success state
      setTimeout(() => {
        setIsVerified(false);
        setUploadState('success');
        setSelectedFile(null); // Reset the file input visually
      }, 1000);
    } else {
      setOtpError('Invalid OTP. Please use 888888.');
    }
  };

  // Search Filter Logic
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return dummyHistory;
    const query = searchQuery.toLowerCase();
    return dummyHistory.filter(item => 
      item.location.toLowerCase().includes(query) ||
      item.division.toLowerCase().includes(query) ||
      item.frequency.toLowerCase().includes(query) ||
      item.amount.includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">

      {/* TOP CARD: Upload Incentives */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row min-h-[300px] overflow-hidden">
        
        {/* Left Side: Upload Form */}
        <div className="w-full md:w-1/2 p-8 md:p-10 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-center">
          <h2 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">
            Upload Incentives
          </h2>
          
          <div className="space-y-3">
            <label className="block text-[15px] text-gray-800">
              Upload Party Incentives Amount (Excel/CSV)
            </label>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Custom File Input UI */}
              <div 
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className={`text-sm truncate ${selectedFile ? 'text-gray-900 font-medium' : 'text-[#A0ABC0]'}`}>
                  {selectedFile ? selectedFile.name : 'Upload Incentives'}
                </span>
              </div>
              
              {/* Hidden actual file input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden" 
              />

              <button 
                onClick={handleUploadClick}
                disabled={!selectedFile || uploadState === 'otp' || uploadState === 'success'}
                className={`font-semibold px-8 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap
                  ${selectedFile && uploadState !== 'otp' && uploadState !== 'success'
                    ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md' 
                    : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'}`}
              >
                Upload Incentives <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Dynamic Content (Idle / OTP / Success) */}
        <div className="w-full md:w-1/2 p-8 md:p-10 bg-white flex flex-col justify-center">
          
          {/* State 1: Idle (Blank right side) */}
          {uploadState === 'idle' && (
            <div className="h-full w-full"></div>
          )}

          {/* State 2: OTP Verification */}
          {uploadState === 'otp' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-[22px] font-bold text-gray-900 mb-4 tracking-tight">
                Enter the 6-digit code
              </h3>
              <p className="text-[14px] text-gray-800 font-medium mb-6">
                Enter the 6-digit code Sent To Your email address <span className="font-bold">johndeo@gmail.com</span>
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                <div className="flex gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      placeholder="-"
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-[45px] h-[50px] text-center text-lg font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-all bg-white placeholder:text-gray-300"
                    />
                  ))}
                </div>
                
                <button 
                  onClick={handleVerifyOTP}
                  disabled={isVerified}
                  className={`font-semibold px-6 py-3 rounded-xl whitespace-nowrap flex items-center justify-center gap-2 transition-colors w-full sm:w-auto
                    ${isVerified 
                      ? 'bg-[#00B65E] text-white shadow-sm' 
                      : 'bg-[#8492A6] hover:bg-gray-500 text-white'}`}
                >
                  {isVerified ? '✓ Verified' : 'Verify OTP →'}
                </button>
              </div>
              {otpError && <p className="text-red-500 text-xs mt-2">{otpError}</p>}
              <p className="text-xs text-gray-500 mt-4">
                Enter all 6 digits. Each box takes one digit.
              </p>
            </div>
          )}

          {/* State 3: Success */}
          {uploadState === 'success' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex items-start gap-4">
              <div className="w-10 h-10 bg-[#00B65E] rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-[22px] font-bold text-gray-900 mb-3 tracking-tight">
                  Upload Successful
                </h3>
                <p className="text-[15px] text-gray-800 leading-relaxed max-w-[400px]">
                  Your invoices have been uploaded successfully. Vendor incentive amounts have been retrieved.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* BOTTOM CARD: Upload Incentives History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">
            Upload Incentives History
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-sm font-medium text-gray-700 mr-2">
              <span>Download In</span>
              <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
              <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
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
                <th className="pb-4 pt-2 px-2 font-bold">Upload Incentives Date</th>
                <th className="pb-4 pt-2 px-2 font-bold">Location</th>
                <th className="pb-4 pt-2 px-2 font-bold">Division Name</th>
                <th className="pb-4 pt-2 px-2 font-bold">Incentives Total Amount</th>
                <th className="pb-4 pt-2 px-2 font-bold">Upload Frequency</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 font-medium">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-2">{row.id}</td>
                    <td className="py-5 px-2">{row.date}</td>
                    <td className="py-5 px-2">{row.location}</td>
                    <td className="py-5 px-2">{row.division}</td>
                    <td className="py-5 px-2">{row.amount}</td>
                    <td className="py-5 px-2">{row.frequency}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-gray-500">
                    No history matches your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <p className="text-[13px] text-gray-600 font-medium">
            Show Results {filteredHistory.length > 0 ? '10' : '0'} of {dummyHistory.length}
          </p>
          {filteredHistory.length > 0 && (
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