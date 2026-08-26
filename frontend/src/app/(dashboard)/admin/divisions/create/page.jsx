'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const InputField = ({ label, id, placeholder, value, onChange, error, hint, required = false, mono = false }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[14px] font-medium text-gray-800">
      {label} {required && <span className="text-[#E74C3C]">*</span>}
    </label>
    <input
      id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 ${mono ? 'font-mono font-bold tracking-widest' : ''} ${error ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}
    />
    {error && <p className="text-[12px] text-[#E74C3C] font-medium">{error}</p>}
    {hint && !error && <p className="text-[12px] text-gray-400">{hint}</p>}
  </div>
);

export default function CreateDivisionPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', location: '', locationCode: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setFormError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Division name is required';
    if (!form.location.trim()) errors.location = 'Location / city is required';
    if (!form.locationCode.trim()) errors.locationCode = 'Location code is required';
    else if (form.locationCode.length > 5) errors.locationCode = 'Max 5 characters';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFormLoading(true); setFormError('');
    try {
      const res = await fetch(`${API}/api/divisions`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: form.name, location: form.location, locationCode: form.locationCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || 'Failed to create division'); return; }
      sessionStorage.setItem('divisionCreated', `Division "${data.data.name}" (${data.data.locationCode}) created successfully!`);
      router.push('/admin/divisions');
    } catch { setFormError('Server error. Please try again.'); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-3">
          <Link href="/admin/divisions" className="hover:text-[#2B3B8A] transition-colors">Divisions</Link>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-gray-800 font-medium">Create New Division</span>
        </div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {formError && (
            <div className="mx-8 mt-8 p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#E74C3C] shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-[14px] text-[#E74C3C] font-medium">{formError}</p>
            </div>
          )}

          <div className="flex flex-col lg:flex-row">

            {/* Left: Division Info */}
            <div className="w-full lg:w-1/2 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#2B3B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">Division Details</h3>
                  <p className="text-[13px] text-gray-500">Name, city and unique location code</p>
                </div>
              </div>

              <div className="space-y-5">
                <InputField label="Division Name" id="name" placeholder="e.g. AJMER BO"
                  value={form.name} onChange={(v) => set('name', v)} error={fieldErrors.name} required />

                <InputField label="Location / City" id="location" placeholder="e.g. Ajmer"
                  value={form.location} onChange={(v) => set('location', v)} error={fieldErrors.location} required />

                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-gray-800">
                    Location Code <span className="text-[#E74C3C]">*</span>
                  </label>
                  <input
                    type="text" value={form.locationCode} maxLength={5}
                    onChange={(e) => set('locationCode', e.target.value.toUpperCase())}
                    placeholder="e.g. AJM"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.locationCode ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}
                  />
                  {fieldErrors.locationCode
                    ? <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.locationCode}</p>
                    : <p className="text-[12px] text-gray-400">
                       Party Code prefix:{' '}
                        <span className="font-mono font-semibold text-[#2B3B8A]">{form.locationCode || 'XXX'}-XXXXX</span>
                      </p>
                  }
                </div>
              </div>
            </div>

            {/* Right: Info + Reference */}
            <div className="w-full lg:w-1/2 p-8 md:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">How It Works</h3>
                  <p className="text-[13px] text-gray-500">Division vs Branch explained</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-[#EEF2FF] border border-[#2B3B8A]/10 rounded-xl">
                  <p className="text-[13px] font-bold text-[#2B3B8A] mb-1">Division</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    A division is a location/area with a unique code (e.g. <span className="font-mono font-bold">AJM</span>). It is used to prefix Party Code numbers and group data by location.
                  </p>
                </div>
                <div className="p-4 bg-[#F4F7FB] border border-gray-100 rounded-xl">
                  <p className="text-[13px] font-bold text-gray-700 mb-1">Branch (Login Account)</p>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                    A branch is a login account assigned to a division. Create branches separately from the{' '}
                    <Link href="/admin/branches/create" className="text-[#2B3B8A] font-semibold hover:underline">Create Branch page</Link>.
                  </p>
                </div>
              </div>

              {/* Existing codes reference */}
              <div className="mt-6 bg-[#F8FAFC] border border-gray-100 rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-700 mb-3">Existing Branch Codes</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                  {[
                    ['AJM','AJMER BO'],['BEW','BEAWER'],['BKN','BIKANER RO'],['BT8','BALOTRA'],
                    ['CER','NAGOUR'],['CPS','MODI ARC'],['ETY','KISHANGARH'],['GMR','RATANADA'],
                    ['GYT','PALI'],['JNR','SUMERPUR'],['JOD','DPS CIRCLE'],['JOH','HO'],
                    ['KHA','AJMER RO'],['MHX','SIROHI'],['PO4','BIKANER RO'],['SDY','BARMER'],
                    ['SG5','MERTA'],['SYN','BIKANER AWH'],['VPG','BANAR'],['WSG','JHALAMAND'],
                  ].map(([code, name]) => (
                    <div key={code} className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#2B3B8A] w-9 shrink-0">{code}</span>
                      <span className="text-gray-500 truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 p-6 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/admin/divisions" className="text-[14px] font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back to Divisions
            </Link>
            <button type="submit" disabled={formLoading}
              className={`font-semibold px-10 py-3 rounded-xl flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-md'}`}>
              {formLoading
                ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating...</>
                : <>Create Division →</>
              }
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
