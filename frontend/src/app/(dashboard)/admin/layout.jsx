'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar_admin from '@/components/Sidebar_admin';
import Admin_header from '@/components/Admin_header';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);   // Point 23 — mobile drawer

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const verify = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/auth/me`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          router.replace('/admin_login');
          return;
        }

        const data = await res.json();

        if (data.data.role !== 'admin') {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          router.replace('/admin_login');
          return;
        }

        setChecked(true);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        router.replace('/admin_login');
      }
    };
//chnagessss done
    verify();
  }, [router]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#EAF2F9]">
        <div className="w-8 h-8 border-4 border-[#2B3B8A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900">
      <Sidebar_admin open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Admin_header onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-auto relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
