'use client';

import React, { useState, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function SettingsPage() {
  const [userInfo, setUserInfo] = useState(null);

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef([]);

  // UI states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  useEffect(() => {
    fetch(`${API}/api/settings/me`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUserInfo(d.data); });
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError('Pehle saare password fields fill karo');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password aur confirm password match nahi kar rahe');
      return;
    }
    if (newPassword.length < 8) {
      setPassError('Password kam se kam 8 characters ka hona chahiye');
      return;
    }

    setSendingOtp(true);
    setPassError('');

    try {
      const res = await fetch(`${API}/api/settings/password/send-otp`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) { setPassError(data.message); return; }

      setOtpEmail(data.email);
      setOtpSent(true);
      setCountdown(45);
      setOtp(['', '', '', '', '', '']);
    } catch {
      setPassError('Server error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleChangePassword = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) { setPassError('6-digit OTP enter karo'); return; }

    setChangingPass(true);
    setPassError('');

    try {
      const res = await fetch(`${API}/api/settings/password/change`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ otp: enteredOtp, oldPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) { setPassError(data.message); return; }

      setPassSuccess('Password successfully changed!');
      setOtpSent(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp(['', '', '', '', '', '']);
    } catch {
      setPassError('Server error');
    } finally {
      setChangingPass(false);
    }
  };

  const EyeIcon = ({ show, toggle }) => (
    <button type="button" onClick={toggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h2 className="text-[15px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Jodhpur Division</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row overflow-hidden min-h-[500px]">

        {/* Column 1: Account Info */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
          <h3 className="text-[22px] font-bold text-gray-900 mb-8 tracking-tight">Account Settings (Information)</h3>
          <div className="space-y-6">
            {[
              { label: 'Account Name', value: userInfo?.name || '—' },
              { label: 'Account Email', value: userInfo?.email || '—' },
              { label: 'Role', value: userInfo?.role || '—' },
              { label: 'Division', value: userInfo?.division?.name || '—' },
              { label: 'Account Created', value: userInfo ? new Date(userInfo.createdAt).toLocaleDateString('en-IN') : '—' },
              { label: 'Last Login', value: userInfo?.lastLogin ? new Date(userInfo.lastLogin).toLocaleDateString('en-IN') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[130px_1fr] gap-4">
                <span className="text-[14px] text-gray-600">{label}</span>
                <span className="text-[14px] font-bold text-gray-900 capitalize">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Change Password */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
          <h3 className="text-[20px] font-bold text-gray-900 mb-6 tracking-tight">Change Password</h3>

          {passSuccess && (
            <div className="mb-4 p-3 bg-[#E4F8ED] border border-[#2ECC71]/20 rounded-xl text-[13px] text-green-800 font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {passSuccess}
            </div>
          )}

          {passError && (
            <div className="mb-4 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[13px] text-red-700 font-medium">
              {passError}
            </div>
          )}

          <div className="space-y-5 flex-1">
            {/* Old Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">Old password</label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => { setOldPassword(e.target.value); setPassError(''); setPassSuccess(''); }}
                  placeholder="Enter your old password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
                />
                <EyeIcon show={showOld} toggle={() => setShowOld(!showOld)} />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPassError(''); setPassSuccess(''); }}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
                />
                <EyeIcon show={showNew} toggle={() => setShowNew(!showNew)} />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-gray-800">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPassError(''); setPassSuccess(''); }}
                  placeholder="Re-enter new password"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors ${
                    confirmPassword && newPassword !== confirmPassword ? 'border-[#E74C3C]' : 'border-gray-200'
                  }`}
                />
                <EyeIcon show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[12px] text-[#E74C3C]">Passwords do not match</p>
              )}
            </div>

            {/* Password rules */}
            <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 flex gap-3 items-start">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#2B3B8A] shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="text-[12px] text-gray-700 leading-relaxed">
                <span className="font-bold text-gray-900 block mb-0.5">Password must:</span>
                Be at least 8 characters · Include one number · Include one uppercase letter · Include one special character (@, #, !)
              </div>
            </div>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={sendingOtp || otpSent}
            className={`mt-6 self-start font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors ${
              sendingOtp || otpSent ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
            }`}
          >
            {sendingOtp ? 'Sending OTP...' : otpSent ? 'OTP Sent ✓' : 'Send OTP to Email →'}
          </button>
        </div>

        {/* Column 3: OTP Verification */}
        <div className="w-full lg:w-1/3 p-8 md:p-10 flex flex-col">
          <h3 className="text-[20px] font-bold text-gray-900 mb-6 tracking-tight">Email Verification</h3>

          {!otpSent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 bg-[#F4F7FB] rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#2B3B8A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-800">OTP Verification Required</p>
                <p className="text-[13px] text-gray-500 mt-1">Fill in the password fields and click "Send OTP to Email" to receive a verification code.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              <div className="p-4 bg-[#F4F7FB] rounded-xl">
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  We sent a 6-digit code to <span className="font-bold text-black">{otpEmail}</span>. Enter it below to confirm the password change.
                </p>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-800 mb-3">Enter the 6-digit code</p>
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
                      className="w-full aspect-square max-w-[50px] text-center text-lg font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white placeholder:text-gray-300"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-500">Enter all 6 digits. Each box takes one digit.</p>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={otp.join('').length < 6 || changingPass}
                className={`w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                  otp.join('').length === 6 && !changingPass
                    ? 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
                    : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                }`}
              >
                {changingPass ? 'Changing Password...' : 'Verify & Change Password →'}
              </button>

              <div className="text-[12px] text-gray-700">
                <p>Didn't receive the code?</p>
                {countdown > 0 ? (
                  <p className="text-[#2B3B8A] font-semibold mt-0.5">
                    Resend available in <span className="text-gray-500 font-normal">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={() => { setOtpSent(false); handleSendOtp(); }}
                    className="text-[#2B3B8A] font-semibold mt-0.5 hover:underline"
                  >
                    Resend code now
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
