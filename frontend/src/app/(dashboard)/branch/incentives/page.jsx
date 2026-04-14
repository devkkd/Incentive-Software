'use client';

import React, { useState, useRef } from 'react';

export default function UploadIncentivesPage() {
  // States: 'idle', 'otp', 'success'
  const [uploadState, setUploadState] = useState('idle');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // OTP States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const otpInputRefs = useRef([]);
  const fileInputRef = useRef(null);

  // Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadState('idle'); 
    }
  };

  const handleUploadClick = () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }
    setUploadState('otp');
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOTP = () => {
    const enteredOtp = otp.join('');
    // Dummy OTP validation
    if (enteredOtp === '888888') {
      setOtpError('');
      setIsVerifying(true);
      
      setTimeout(() => {
        setIsVerifying(false);
        setUploadState('success');
        setSelectedFile(null); 
      }, 800);
    } else {
      setOtpError('Invalid OTP. Please use 888888.');
    }
  };

  return (
    <div className="p-8 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[15px] text-gray-700 mb-1">
          Welcome to Faith Trust Commitment - Incentive Management
        </h2>
        <h1 className="text-[28px] font-bold text-black mb-8 tracking-tight">
          Jodhpur Division
        </h1>

        {/* Content Container */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col md:flex-row min-h-[350px] overflow-hidden">
          
          {/* Left Side: Upload Form */}
          <div className="w-full md:w-1/2 p-10 border-r border-gray-100 flex flex-col justify-center">
            <h3 className="text-[22px] font-bold text-gray-900 mb-6 tracking-tight">
              Upload Incentives
            </h3>
            
            <div className="space-y-3">
              <label className="block text-[15px] text-gray-800">
                Upload Party Incentives Amount (Excel/CSV)
              </label>
              
              <div className="flex gap-4">
                <div 
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className={`text-sm ${selectedFile ? 'text-gray-900 font-medium' : 'text-[#A0ABC0]'}`}>
                    {selectedFile ? selectedFile.name : 'Upload Incentives'}
                  </span>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden" 
                />

                <button 
                  onClick={handleUploadClick}
                  disabled={uploadState === 'otp' || uploadState === 'success'}
                  className={`font-semibold px-6 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap
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
          <div className="w-full md:w-1/2 p-10 bg-white flex flex-col justify-center">
            
            {uploadState === 'idle' && (
              <div className="h-full w-full"></div>
            )}

            {uploadState === 'otp' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="text-[22px] font-bold text-gray-900 mb-4 tracking-tight">
                  Enter the 6-digit code
                </h3>
                <p className="text-[14px] text-gray-800 font-medium mb-6">
                  Enter the 6-digit code Sent To Your email address <span className="font-bold">xyz@gmail.com</span>
                </p>
                
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-[50px] h-[52px] text-center text-lg font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-all bg-white"
                      />
                    ))}
                  </div>
                  
                  <button 
                    onClick={handleVerifyOTP}
                    className={`font-semibold px-6 py-3.5 rounded-xl whitespace-nowrap flex items-center justify-center gap-2 transition-colors
                      ${isVerifying ? 'bg-[#00B65E] text-white' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'}`}
                  >
                    {isVerifying ? <>✓ Verified</> : <>Verify OTP →</>}
                  </button>
                </div>
                {otpError && <p className="text-red-500 text-xs mt-2">{otpError}</p>}
                <p className="text-xs text-gray-500 mt-4">
                  Enter all 6 digits. Each box takes one digit.
                </p>
              </div>
            )}

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
      </div>
    </div>
  );
}