'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MarutiPartnerBadge from '@/components/MarutiPartnerBadge';

export default function Sidebar_branch({ frozen = false }) {
  const pathname = usePathname();

  // Define navigation items with their active checking logic
  const navItems = [
    { 
      name: 'Invoices', 
      href: '/branch', 
      // Invoices is active exactly on '/branch'
      isActive: pathname === '/branch',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /> 
    },
    { 
      name: 'Party List', 
      href: '/branch/vendors', 
      // Active if path starts with '/branch/vendors' (handles view/edit sub-routes)
      isActive: pathname?.startsWith('/branch/vendors'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> 
    },
    { 
      name: 'Reports', 
      href: '/branch/reports', 
      isActive: pathname?.startsWith('/branch/reports'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /> 
    },
    { 
      name: 'Account Settings', 
      href: '/branch/settings', 
      isActive: pathname?.startsWith('/branch/settings'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM12 15a3 3 0 100-6 3 3 0 000 6z" /> 
    }
  ];

  return (
    <aside className="w-[260px] bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* Sidebar Logo */}
      <Link href="/branch" className="h-[72px] flex items-center px-6 border-b border-gray-200 hover:opacity-80 transition-opacity shrink-0">
        <div className="flex items-center gap-1">
          <Image src="/images/logo/logo.jpeg" alt="FTC" width={40} height={24} className="object-contain" />
          <Image src="/images/logo/logoname.png" alt="Friends Trading Corporation" width={110} height={20} className="object-contain" />
        </div>
      </Link>

      {/* Sidebar Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          // Point 7 — while redemption is frozen only Account Settings is reachable
          const isSettings = item.href.startsWith('/branch/settings');
          const isDisabled = frozen && !isSettings;

          if (isDisabled) {
            return (
              <div
                key={item.name}
                title="Unavailable while redemption is suspended"
                className="mx-3 flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 cursor-not-allowed select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  {item.icon}
                </svg>
                <span className="text-sm font-medium">{item.name}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 ml-auto">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`mx-3 flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                item.isActive
                  ? 'bg-[#2B3B8A] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                {item.icon}
              </svg>
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Partner Badge */}
      <div className="px-6 py-5 border-t border-gray-100">
        <MarutiPartnerBadge size="lg" />
      </div>
    </aside>
  );
}