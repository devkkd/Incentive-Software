'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const InputField = ({ label, id, type = 'text', placeholder, value, onChange, error, hint, required = false }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[14px] font-medium text-gray-800">
      {label} {required && <span className="text-[#E74C3C]">*</span>}
    </label>
    <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 ${error ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
    {error && <p className="text-[12px] text-[#E74C3C] font-medium">{error}</p>}
    {hint && !error && <p className="text-[12px] text-gray-400">{hint}</p>}
  </div>
);

export default function CreateBranchPage() {
  const router = useRouter();
  const [divisions, setDivisions] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', divisionId: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data); });
  }, []);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setFormError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Branch name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address';
    if (!form.divisionId) errors.divisionId = 'Division is required';
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFormLoading(true); setFormError('');
    try {
      const res = await fetch(`${API}/api/users/branches`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, divisionId: form.divisionId }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || 'Failed to create branch'); return; }
      sessionStorage.setItem('branchCreated', `Branch "${data.data.name}" created successfully!`);
      router.push('/admin/branches');
    } catch { setFormError('Server error. Please try again.'); }
    finally { setFormLoading(false); }
  };

  const selectedDivision = divisions.find(d => d._id === form.divisionId);

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      {/* Breadcrumb + Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-3">
          <Link href="/admin/branches" className="hover:text-[#2B3B8A] transition-colors">Branches</Link>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-gray-800 font-medium">Create New Branch</span>
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

            {/* Left: Branch Info */}
            <div className="w-full lg:w-1/2 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#2B3B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">Branch Information</h3>
                  <p className="text-[13px] text-gray-500">Name and assigned division</p>
                </div>
              </div>

              <div className="space-y-5">
                <InputField label="Branch Name" id="name" placeholder="e.g. Jodhpur Branch"
                  value={form.name} onChange={(v) => set('name', v)} error={fieldErrors.name} required />

                {/* Division */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-gray-800">Division <span className="text-[#E74C3C]">*</span></label>
                  <select value={form.divisionId} onChange={(e) => set('divisionId', e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.divisionId ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select Division</option>
                    {divisions.map(d => <option key={d._id} value={d._id}>{d.name} ({d.locationCode})</option>)}
                  </select>
                  {fieldErrors.divisionId && <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.divisionId}</p>}
                  {selectedDivision && !fieldErrors.divisionId && (
                    <p className="text-[12px] text-gray-400">Location: <span className="font-semibold text-[#2B3B8A]">{selectedDivision.location}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Login Credentials */}
            <div className="w-full lg:w-1/2 p-8 md:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#2B3B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">Login Credentials</h3>
                  <p className="text-[13px] text-gray-500">Email and password for branch login</p>
                </div>
              </div>

              <div className="space-y-5">
                <InputField label="Email Address" id="email" type="email" placeholder="e.g. jodhpur@ftc.com"
                  value={form.email} onChange={(v) => set('email', v)} error={fieldErrors.email}
                  hint="Branch user will login with this email" required />

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-gray-800">Password <span className="text-[#E74C3C]">*</span></label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters"
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.password ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        {showPass
                          ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                      </svg>
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-gray-800">Confirm Password <span className="text-[#E74C3C]">*</span></label>
                  <div className="relative">
                    <input type={showConfirmPass ? 'text' : 'password'} value={form.confirmPassword}
                      onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password"
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.confirmPassword ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        {showConfirmPass
                          ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                      </svg>
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              <div className="mt-6 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 flex gap-3 items-start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#2B3B8A] shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  The branch user will be able to login at the branch login page using this email and password.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 p-6 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/admin/branches" className="text-[14px] font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back to Branches
            </Link>
            <button type="submit" disabled={formLoading}
              className={`font-semibold px-10 py-3 rounded-xl flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-md'}`}>
              {formLoading ? (
                <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating...</>
              ) : <>Create Branch →</>}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
