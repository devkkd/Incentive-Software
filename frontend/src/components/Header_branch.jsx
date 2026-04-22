'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Header_branch() {
  const router = useRouter();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
    } catch { /* silent */ }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    router.replace('/');
  };

  return (
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 relative z-20">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="Search" className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2B3B8A] transition-colors" />
      </div>

      <div className="flex items-center gap-6">
        {/* Language Select Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 focus:outline-none"
          >
            <span className="text-sm font-medium">English</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          
          {isLangDropdownOpen && (
            <div className="absolute top-full mt-1 right-0 w-[120px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="px-4 py-2 text-sm font-medium bg-[#2B3B8A] text-white cursor-pointer hover:bg-[#1a2d6b]">
                English
              </div>
              <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-white cursor-pointer hover:bg-gray-100">
                Hindi (हिन्दी)
              </div>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <Link href="#" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
           <Image src="/images/logo/logo.svg" alt="User" width={28} height={28} className="object-contain" />
           <span className="text-sm font-medium text-gray-700">Incentive Management - Jodhpur Division</span>
        </Link>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-[#0C1B4A] hover:bg-[#1a2d6b] transition-colors text-white px-5 py-2 rounded-xl text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Log out
        </button>
      </div>
    </header>
  );
}