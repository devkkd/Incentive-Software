import React from 'react';
import Sidebar_admin from '@/components/Sidebar_admin';
import Admin_header from '@/components/Admin_header';

export default function AdminLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900">
      <Sidebar_admin />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Admin_header />
        <main className="flex-1 overflow-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}