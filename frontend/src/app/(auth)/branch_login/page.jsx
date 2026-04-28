'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import GoogleTranslateButton from '@/components/GoogleTranslateButton';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function branchLoginPage() {
  const router = useRouter();
  const { t } = useLang();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${API}/api/auth/login`, {
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

      if (data.data.role !== 'branch') {
        setError('This portal is for branch users only');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.data.role);
      router.push('/branch');
    } catch {
      setError('Unable to connect to server. Is the backend running?');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D6E8FB] p-4 font-sans">
      <div className="bg-white rounded-[2rem] p-8 sm:p-10 w-full text-gray-900 max-w-[480px] shadow-lg">
        <div className="flex justify-end mb-2">
          <GoogleTranslateButton />
        </div>
        {/* Logo Section */}
        <div className="flex items-center gap-1 mb-8">
          <Image 
            src="/images/logo/logo.svg" 
            alt="FTC Log" 
            width={100} 
            height={50} 
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
        <h1 className="text-[20px] font-bold text-gray-900 mb-2 tracking-tight">
          {t('welcomeBack')}
        </h1>
        <p className="text-xs text-gray-600 mb-4">
          {t('signInSubtitle')}
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Form Section */}
        <form className="space-y-4" onSubmit={handleLogin}>
          
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-800">
              {t('email')}
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 text-sm"
            />
            <p className="text-xs text-gray-400 font-medium">
              {t('enterEmailLinked')}
            </p>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-800">
                {t('password')}
              </label>
              <Link href="/forgot-password" className="text-sm font-bold text-[#2B3B8A] hover:underline">
                {t('forgotPasswordQ')}
              </Link>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password123"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 text-sm"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
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
            <div className="relative flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-200 transition-all checked:border-[#2B3B8A] checked:bg-[#2B3B8A]"
                id="keep-signed-in"
              />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                </svg>
              </div>
            </div>
            <label htmlFor="keep-signed-in" className="ml-2 text-[13px] text-gray-700 cursor-pointer select-none">
              {t('keepSignedIn')}
            </label>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            className="w-[60%] mx-auto block bg-[#2B3B8A] text-white font-semibold py-3 rounded-xl mt-3 transition-colors hover:bg-[#1f2b66] flex items-center justify-center gap-2"
          >
            {t('signIn')} <span>→</span>
          </button>
        </form>

        {/* Footer text */}
        <div className="mt-8 text-[13px] text-gray-800 leading-relaxed text-center sm:text-left">
          <span className="font-bold text-black">{t('dontHaveAccount')} </span>
          {t('contactRepresentative')}
        </div>
      </div>
    </div>
  );
} 
