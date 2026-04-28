'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// Defined OUTSIDE component — prevents focus loss on every keystroke
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

export default function AdminCreateVendorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    companyName: '',
    personName: '',
    accountNumber: '',
    mobileNumber: '',
    email: '',
    address: '',
    salesPerson: '',
    divisionId: '',
  });

  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setDivisions(d.data); });
  }, []);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.companyName.trim()) errors.companyName = 'Company name required';
    if (!form.personName.trim()) errors.personName = 'Person name required';
    if (!form.accountNumber.trim()) errors.accountNumber = 'Account number required';
    if (!form.mobileNumber.trim()) errors.mobileNumber = 'Mobile number required';
    else if (!/^\d{10}$/.test(form.mobileNumber.trim())) errors.mobileNumber = 'Enter valid 10-digit mobile number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter valid email';
    if (!form.divisionId) errors.divisionId = 'Division is required';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/vendors`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to create vendor'); return; }
      router.push('/admin/vendors');
    } catch {
      setError('Server error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // Get selected division prefix for preview
  const selectedDivision = divisions.find(d => d._id === form.divisionId);

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-3">
          <Link href="/admin/vendors" className="hover:text-[#2B3B8A] transition-colors">Vendors</Link>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-gray-800 font-medium">Create New Vendor</span>
        </div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {error && (
            <div className="mx-8 mt-8 p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#E74C3C] shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-[14px] text-[#E74C3C] font-medium">{error}</p>
            </div>
          )}

          <div className="flex flex-col lg:flex-row">

            {/* Left: Company Info */}
            <div className="w-full lg:w-1/2 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#2B3B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">Company Information</h3>
                  <p className="text-[13px] text-gray-500">Basic vendor details</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Division selector — admin only */}
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-gray-800">Division <span className="text-[#E74C3C]">*</span></label>
                  <select value={form.divisionId} onChange={(e) => set('divisionId', e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.divisionId ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select Division</option>
                    {divisions.map(d => <option key={d._id} value={d._id}>{d.name} ({d.locationCode})</option>)}
                  </select>
                  {fieldErrors.divisionId && <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.divisionId}</p>}
                </div>

                <InputField label="Vendor Company Name" id="companyName" placeholder="e.g. Sharma Auto Parts Pvt Ltd"
                  value={form.companyName} onChange={(v) => set('companyName', v)} error={fieldErrors.companyName} required />
                <InputField label="Contact Person Name" id="personName" placeholder="e.g. Ramesh Sharma"
                  value={form.personName} onChange={(v) => set('personName', v)} error={fieldErrors.personName} required />
                <InputField label="Vendor Account Number" id="accountNumber" placeholder="e.g. 7792811100"
                  value={form.accountNumber} onChange={(v) => set('accountNumber', v)} error={fieldErrors.accountNumber}
                  hint={selectedDivision ? `Will be saved as: ${selectedDivision.locationCode}-${form.accountNumber || 'XXXXXXXXXX'}` : 'Select division first'}
                  required />
                <InputField label="Full Address" id="address" placeholder="e.g. 100, MG Road, Jodhpur, Rajasthan"
                  value={form.address} onChange={(v) => set('address', v)} error={fieldErrors.address} />
                <InputField label="Sales Person" id="salesPerson" placeholder="e.g. Rajesh Kumar"
                  value={form.salesPerson} onChange={(v) => set('salesPerson', v)} error={fieldErrors.salesPerson} />
              </div>
            </div>

            {/* Right: Contact Info */}
            <div className="w-full lg:w-1/2 p-8 md:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#2B3B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">Contact Details</h3>
                  <p className="text-[13px] text-gray-500">Mobile & email for OTP and communication</p>
                </div>
              </div>

              <div className="space-y-5">
                <InputField label="Mobile Number" id="mobileNumber" type="tel" placeholder="e.g. 9876543210"
                  value={form.mobileNumber} onChange={(v) => set('mobileNumber', v)} error={fieldErrors.mobileNumber}
                  hint="10-digit mobile number — used for OTP during redemption" required />
                <InputField label="Email Address" id="email" type="email" placeholder="e.g. vendor@example.com"
                  value={form.email} onChange={(v) => set('email', v)} error={fieldErrors.email}
                  hint="Optional — for email notifications" />
              </div>

              <div className="mt-8 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-4 flex gap-3 items-start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#2B3B8A] shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div className="text-[12px] text-gray-600 leading-relaxed">
                  <span className="font-bold text-gray-900 block mb-1">Account Number Format</span>
                  The account number will be prefixed with the selected division's location code.
                  {selectedDivision && (
                    <><br /><span className="font-mono text-[#2B3B8A] font-semibold">{selectedDivision.locationCode}-{form.accountNumber || 'XXXXXXXXXX'}</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 p-6 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/admin/vendors" className="text-[14px] font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back to Vendors
            </Link>
            <button type="submit" disabled={loading}
              className={`font-semibold px-10 py-3 rounded-xl flex items-center gap-2 transition-all ${loading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-md'}`}>
              {loading ? (
                <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating...</>
              ) : <>Create Vendor →</>}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
