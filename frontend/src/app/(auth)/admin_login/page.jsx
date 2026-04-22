'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('mehravivek2001@gmail.com');
  const [password, setPassword] = useState('Admin@1234');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Invalid credentials');
        return;
      }

      if (data.data.role !== 'admin') {
        setError('This portal is for admin users only');
        return;
      }

      localStorage.setItem('token', data.token);
      router.push('/admin');
    } catch {
      setError('Server se connect nahi ho pa raha. Backend chalu hai?');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EAF2F9] p-4 font-sans">
      <div className="bg-white rounded-[2rem] p-8 sm:p-10 w-full max-w-[480px] shadow-lg">
        
        {/* Logo Section */}
        <div className="flex items-center gap-1 mb-10">
          <Image 
            src="/images/logo/logo.svg" 
            alt="FTC Logo" 
            width={60} 
            height={40} 
            className="object-contain"
          />
          <Image 
            src="/images/logo/logoname.svg" 
            alt="Faith Trust Commitment Incentive Management" 
            width={180} 
            height={40} 
            className="object-contain"
          />
        </div>

        {/* Heading Section */}
        <h1 className="text-[28px] font-bold text-gray-900 mb-2 tracking-tight">
          Sign In Admin
        </h1>
        <p className="text-[14px] text-gray-600 mb-8">
          Access the admin portal by entering your email and password.
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* Form Section */}
        <form className="space-y-6" onSubmit={handleLogin}>
          
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-[14px] text-gray-800">
              Email address
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[14px] text-gray-800">
                Password
              </label>
              <Link href="/admin-forgot-password" className="text-[14px] font-bold text-[#2B3B8A] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors text-sm text-gray-900 tracking-widest placeholder:tracking-normal placeholder:text-gray-400"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? (
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
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-center pt-2">
            <label className="relative flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                id="keep-signed-in"
              />
              <div className="w-6 h-6 bg-white border-2 border-gray-200 rounded-[6px] peer-checked:bg-[#2B3B8A] peer-checked:border-[#2B3B8A] flex items-center justify-center transition-all shadow-sm">
                <svg 
                  className={`w-3.5 h-3.5 text-white ${keepSignedIn ? 'block' : 'hidden'}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor" 
                  stroke="currentColor" 
                  strokeWidth="1"
                >
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                </svg>
              </div>
              <span className="ml-3 text-[13px] text-gray-700 select-none">
                Keep me signed in on this device for 30 days.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex justify-center">
            <button 
              type="submit"
              className="w-full sm:w-[60%] bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Sign In <span>→</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}