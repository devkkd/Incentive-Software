'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import GoogleTranslateButton from '@/components/GoogleTranslateButton';
import GlobalSearch from '@/components/GlobalSearch';
import MarutiPartnerBadge from '@/components/MarutiPartnerBadge';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Admin_header({ onMenuClick = () => {} }) {
  const router = useRouter();
  const { t } = useLang();

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } catch { /* silent */ }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    router.replace('/admin_login');
  };

  return (
    <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 relative">

      {/* Menu button — small screens only (Point 23) */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="lg:hidden p-2 -ml-2 mr-1 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      {/* Search */}
      <GlobalSearch role="admin" />

      <div className="flex items-center gap-4">
        {/* Maruti Badge */}
        <MarutiPartnerBadge />

        {/* Google Translate Toggle */}
        <GoogleTranslateButton />

        {/* Profile */}
        <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image src="/images/logo/logo.jpeg" alt="Admin" width={28} height={28} className="object-contain" />
          <span className="text-sm font-bold text-gray-900">Admin</span>
        </Link>

        {/* Logout */}
        <button onClick={handleLogout}
          className="flex items-center gap-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          {t('logout')}
        </button>
      </div>
    </header>
  );
}