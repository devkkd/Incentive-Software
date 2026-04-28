'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// Category badge colors
const CATEGORY_STYLES = {
  vendor:   { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Vendor'   },
  invoice:  { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Invoice'  },
  branch:   { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Branch'   },
  division: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Division' },
};

export default function GlobalSearch({ role = 'admin' }) {
  const router = useRouter();
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const hits = [];

      // ── Vendors ──────────────────────────────────────────────
      const vRes = await fetch(
        `${API}/api/vendors?q=${encodeURIComponent(q)}&limit=5`,
        { headers: authHeaders(), credentials: 'include' }
      );
      if (vRes.ok) {
        const vData = await vRes.json();
        (vData.data || []).forEach(v => hits.push({
          type: 'vendor',
          id: v._id,
          title: v.companyName,
          sub: `${v.accountNumber} · ${v.mobileNumber}`,
          href: role === 'admin' ? '/admin/vendors' : '/branch/vendors',
          extra: v.status,
        }));
      }

      // ── Invoices ─────────────────────────────────────────────
      const iRes = await fetch(
        `${API}/api/invoices?q=${encodeURIComponent(q)}&limit=5`,
        { headers: authHeaders(), credentials: 'include' }
      );
      if (iRes.ok) {
        const iData = await iRes.json();
        (iData.data || []).forEach(inv => hits.push({
          type: 'invoice',
          id: inv._id,
          title: inv.invoiceNumber,
          sub: `${inv.vendor?.companyName || ''} · ₹${Number(inv.invoiceAmount).toLocaleString('en-IN')}`,
          href: role === 'admin' ? '/admin/invoices' : '/branch/invoices',
          extra: new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        }));
      }

      // ── Branches (admin only) ─────────────────────────────────
      if (role === 'admin') {
        const bRes = await fetch(
          `${API}/api/users/branches`,
          { headers: authHeaders(), credentials: 'include' }
        );
        if (bRes.ok) {
          const bData = await bRes.json();
          const ql = q.toLowerCase();
          (bData.data || [])
            .filter(b => b.name?.toLowerCase().includes(ql) || b.email?.toLowerCase().includes(ql))
            .slice(0, 3)
            .forEach(b => hits.push({
              type: 'branch',
              id: b._id,
              title: b.name,
              sub: `${b.email} · ${b.division?.locationCode || ''}`,
              href: '/admin/branches',
              extra: b.isActive ? 'Active' : 'Inactive',
            }));
        }

        // ── Divisions ───────────────────────────────────────────
        const dRes = await fetch(
          `${API}/api/divisions`,
          { headers: authHeaders(), credentials: 'include' }
        );
        if (dRes.ok) {
          const dData = await dRes.json();
          const ql = q.toLowerCase();
          (dData.data || [])
            .filter(d => d.name?.toLowerCase().includes(ql) || d.location?.toLowerCase().includes(ql) || d.locationCode?.toLowerCase().includes(ql))
            .slice(0, 3)
            .forEach(d => hits.push({
              type: 'division',
              id: d._id,
              title: d.name,
              sub: `${d.location} · Serial: ${d.locationCode}`,
              href: '/admin/divisions',
              extra: d.locationCode,
            }));
        }
      }

      setResults(hits);
      setOpen(hits.length > 0);
      setActiveIdx(-1);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [role]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (item) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    router.push(item.href);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIdx >= 0) handleSelect(results[activeIdx]);
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const cat = (type) => CATEGORY_STYLES[type] || CATEGORY_STYLES.vendor;

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* Input */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
          className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t('search')}
          className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2B3B8A] focus:ring-1 focus:ring-[#2B3B8A] transition-colors"
        />
        {loading && (
          <svg className="animate-spin w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-full min-w-[380px] bg-white border border-gray-100 rounded-2xl shadow-xl z-[200] overflow-hidden">
          {/* Hint */}
          <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-medium">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</span>
            <span className="text-[11px] text-gray-300">↑↓ navigate · Enter select · Esc close</span>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {results.map((item, idx) => (
              <button key={`${item.type}-${item.id}`} onClick={() => handleSelect(item)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${activeIdx === idx ? 'bg-[#EEF2FF]' : 'hover:bg-gray-50'}`}>
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat(item.type).bg}`}>
                  {item.type === 'vendor' && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${cat(item.type).text}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  )}
                  {item.type === 'invoice' && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${cat(item.type).text}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  )}
                  {item.type === 'branch' && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${cat(item.type).text}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                    </svg>
                  )}
                  {item.type === 'division' && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${cat(item.type).text}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{item.title}</p>
                  <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat(item.type).bg} ${cat(item.type).text}`}>
                    {cat(item.type).label}
                  </span>
                  {item.extra && (
                    <span className="text-[11px] text-gray-400">{item.extra}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
            <p className="text-[11px] text-gray-400">
              Search by: vendor name · account no · mobile · invoice no · branch · division code
            </p>
          </div>
        </div>
      )}

      {/* No results */}
      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute top-full mt-2 left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-xl z-[200] px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-gray-500">No results for "{query}"</p>
          <p className="text-[11px] text-gray-400 mt-1">Try vendor name, account no, mobile, or invoice number</p>
        </div>
      )}
    </div>
  );
}
