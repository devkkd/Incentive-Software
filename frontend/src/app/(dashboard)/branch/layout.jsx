'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar_branch from '@/components/Sidebar_branch';
import Header_branch from '@/components/Header_branch';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BranchLayout({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const verify = async () => {
      try {
        // Try cookie first, fallback to localStorage token
        const token = localStorage.getItem('token');
        const res = await fetch(`${API}/api/auth/me`, {
          credentials: 'include', // sends httpOnly cookie
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          // Not authenticated — clear everything and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          router.replace('/');
          return;
        }

        const data = await res.json();

        if (data.data.role !== 'branch') {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          router.replace('/');
          return;
        }

        setChecked(true);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        router.replace('/');
      }
    };

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
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900 overflow-hidden">
      <Sidebar_branch />
      <div className="flex-1 flex flex-col min-w-0">
        <Header_branch />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
