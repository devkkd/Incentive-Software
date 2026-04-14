'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function AdminSettingsPage() {
  // Password Visibility States
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email Change & OTP States
  const oldEmail = "Admin@fts.com"; // Current admin email
  const [newEmail, setNewEmail] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const otpInputRefs = useRef([]);

  // Handle OTP Countdown Timer
  useEffect(() => {
    let timer;
    if (isOtpSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpSent, countdown]);

  const handleSendOtp = () => {
    if (!newEmail || !newEmail.includes('@')) {
      alert("Please enter a valid new email address.");
      return;
    }
    setIsOtpSent(true);
    setCountdown(45); // Reset countdown
    setOtp(['', '', '', '', '', '']);
  };

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
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      alert(`Email successfully updated to ${newEmail}!`);
      setIsOtpSent(false);
      setNewEmail('');
    }, 1000);
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

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row overflow-hidden min-h-[500px]">
        
        {/* Column 1: Account Settings (Information) */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
          <h3 className="text-[22px] font-bold text-gray-900 mb-8 tracking-tight">
            Account Settings (Information)
          </h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-[130px_1fr] gap-4">
              <span className="text-[14px] text-gray-600">Account Name</span>
              <span className="text-[14px] font-bold text-gray-900">Admin</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4">
              <span className="text-[14px] text-gray-600">Account Email</span>
              <span className="text-[14px] font-bold text-gray-900">{oldEmail}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4">
              <span className="text-[14px] text-gray-600">Account Created</span>
              <span className="text-[14px] font-bold text-gray-900">20/05/2020</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4">
              <span className="text-[14px] text-gray-600">Account Last Edit</span>
              <span className="text-[14px] font-bold text-gray-900">20/03/2026</span>
            </div>
          </div>
        </div>

        {/* Column 2: Change Password */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
          <h3 className="text-[20px] font-bold text-gray-900 mb-6 tracking-tight">
            Change Password
          </h3>
          
          <div className="space-y-5 flex-1">
            {/* Old Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">Old password</label>
              <div className="relative">
                <input 
                  type={showOldPassword ? "text" : "password"} 
                  placeholder="Enter your old password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showOldPassword ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">New password</label>
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showNewPassword ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">Confirm new password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Info Box */}
            <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 flex gap-3 items-start mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#2B3B8A] shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="text-[12px] text-gray-700 leading-relaxed">
                <span className="font-bold text-gray-900 block mb-0.5">Password must:</span>
                Be at least 8 characters · Include one number · Include one uppercase letter · Include one special character (e.g. @, #, !)
              </div>
            </div>
          </div>

          <button className="bg-[#8492A6] text-white font-semibold px-6 py-3 rounded-xl mt-6 self-start flex items-center justify-center gap-2 hover:bg-gray-500 transition-colors">
            Change Password <span>→</span>
          </button>
        </div>

        {/* Column 3: Change Account Email Address & OTP */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 flex flex-col">
          <h3 className="text-[20px] font-bold text-gray-900 mb-6 tracking-tight">
            Change Account Email Address
          </h3>
          
          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">New Email Address</label>
              <input 
                type="email" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="johndoe@gmail.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
              />
            </div>

            <button 
              onClick={handleSendOtp}
              className={`w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                newEmail ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b]' : 'bg-[#8492A6] text-white cursor-not-allowed'
              }`}
            >
              Change Account Email Address <span>→</span>
            </button>

            {/* Dynamic OTP Section */}
            {isOtpSent && (
              <div className="pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <h4 className="text-[18px] font-bold text-gray-900 mb-3 tracking-tight">
                  Enter the 6-digit code
                </h4>
                <p className="text-[13px] text-gray-700 leading-relaxed mb-4">
                  We sent a verification code to <span className="font-bold text-black">{oldEmail}</span>. 
                  Enter it below to continue. The code expires in 10 minutes.
                </p>

                <div className="flex gap-2 mb-2">
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
                      className="w-full aspect-[4/5] max-w-[50px] text-center text-lg font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-all bg-white placeholder:text-gray-300"
                    />
                  ))}
                </div>
                
                <p className="text-[11px] text-gray-500 mb-6">
                  Enter all 6 digits. Each box takes one digit.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button 
                    onClick={handleVerifyOTP}
                    disabled={otp.join('').length < 6 || isVerifying}
                    className={`font-semibold px-8 py-3 rounded-xl whitespace-nowrap flex items-center justify-center gap-2 transition-colors ${
                      otp.join('').length === 6 
                        ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b]' 
                        : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Code →'}
                  </button>
                  
                  <div className="text-[12px] text-gray-700">
                    <p>Didn't receive the code?</p>
                    {countdown > 0 ? (
                      <p className="text-[#2B3B8A] font-semibold mt-0.5">
                        Resend code <span className="text-gray-500 font-normal">(available in {countdown} sec)</span>
                      </p>
                    ) : (
                      <button onClick={handleSendOtp} className="text-[#2B3B8A] font-semibold mt-0.5 hover:underline">
                        Resend code now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}