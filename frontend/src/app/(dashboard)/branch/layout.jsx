'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar_branch from '@/components/Sidebar_branch';
import Header_branch from '@/components/Header_branch';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BranchLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  // Point 7 — while redemption is frozen the branch has nothing it can do,
  // so every page is blocked except Account Settings.
  const [freeze, setFreeze] = useState({ frozen: false, reason: null });
  const [freezeChecked, setFreezeChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // Point 23 — mobile drawer

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/api/settings/redemption-freeze`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setFreeze(j.data); })
      .catch(() => {})
      .finally(() => setFreezeChecked(true));
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const settingsAllowed = pathname?.startsWith('/branch/settings');
  const blocked = freezeChecked && freeze.frozen && !settingsAllowed;

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
      <Sidebar_branch frozen={blocked} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header_branch onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-auto">
          {blocked ? (
            <div className="min-h-full flex items-center justify-center p-6">
              <div className="max-w-lg w-full rounded-2xl border-2 border-red-300 bg-red-50 px-8 py-10 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-9 h-9 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>

                <h2 className="text-[22px] font-bold text-red-800">Redemption suspended</h2>

                <p className="text-[15px] text-red-700 mt-4 leading-relaxed">
                  {freeze.reason || 'No reason given.'}
                </p>

                <div className="mt-6 pt-5 border-t border-red-200 space-y-1">
                  <p className="text-[13px] text-red-700 font-medium">Please contact head office.</p>
                  <p className="text-[12px] text-red-600">
                    All counter screens are unavailable until redemption resumes.
                    Account Settings remains open.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
