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
    <label htmlFor={id} className="block text-[13px] font-medium text-gray-800">
      {label} {required && <span className="text-[#E74C3C]">*</span>}
    </label>
    <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 ${error ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
    {error && <p className="text-[12px] text-[#E74C3C] font-medium">{error}</p>}
    {hint && !error && <p className="text-[12px] text-gray-400">{hint}</p>}
  </div>
);

export default function AdminCreateVendorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    divisionId: '',
    accountNumber: '',
    companyName: '',
    personName: '',
    partyCity: '',
    partyType: '',
    mobileNumber: '',
    salesPerson: '',
    email: '',
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
    if (!form.divisionId) errors.divisionId = 'Location is required';
    if (!form.accountNumber.trim()) errors.accountNumber = 'Party Code is required';
    if (!form.companyName.trim()) errors.companyName = 'Party Name is required';
    if (!form.mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required';
    else if (!/^\d{10}$/.test(form.mobileNumber.trim())) errors.mobileNumber = 'Enter valid 10-digit mobile number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter valid email';
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

  const selectedDivision = divisions.find(d => d._id === form.divisionId);

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto">
      <div className="mb-6">
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
            <div className="mx-8 mt-6 p-4 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#E74C3C] shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-[14px] text-[#E74C3C] font-medium">{error}</p>
            </div>
          )}

          <div className="p-8 md:p-10">
            <h3 className="text-[16px] font-bold text-gray-900 mb-6">Vendor / Party Details</h3>

            {/* Row 1: Location, Party Code, Party Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-800">Location <span className="text-[#E74C3C]">*</span></label>
                <select value={form.divisionId} onChange={(e) => set('divisionId', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.divisionId ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select Location</option>
                  {divisions.map(d => <option key={d._id} value={d._id}>{d.name} — {d.location}</option>)}
                </select>
                {fieldErrors.divisionId && <p className="text-[12px] text-[#E74C3C] font-medium">{fieldErrors.divisionId}</p>}
              </div>

              <InputField label="Party Code" id="accountNumber" placeholder="e.g. TRJ028"
                value={form.accountNumber} onChange={(v) => set('accountNumber', v)} error={fieldErrors.accountNumber}
                hint={selectedDivision ? `Saved as: ${selectedDivision.name}-${form.accountNumber || 'XXXXX'}` : ''}
                required />

              <InputField label="Party Name" id="companyName" placeholder="e.g. MAHESHWARI MOTORS"
                value={form.companyName} onChange={(v) => set('companyName', v)} error={fieldErrors.companyName} required />
            </div>

            {/* Row 2: Party City, Party Type, Mobile No */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
              <InputField label="Party City" id="partyCity" placeholder="e.g. Beawar"
                value={form.partyCity} onChange={(v) => set('partyCity', v)} error={fieldErrors.partyCity} />

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-gray-800">Party Type</label>
                <select value={form.partyType} onChange={(e) => set('partyType', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A]">
                  <option value="">Select Type</option>
                  <option value="CO-DEALER">CO-DEALER</option>
                  <option value="CO-DISTRIBUTOR">CO-DISTRIBUTOR</option>
                  <option value="INDEPENDENT WORKSHOP">INDEPENDENT WORKSHOP</option>
                  <option value="MASS">MASS</option>
                  <option value="TRADER/RETAILER">TRADER/RETAILER</option>
                </select>
              </div>

              <InputField label="Mobile No." id="mobileNumber" type="tel" placeholder="e.g. 9876543210"
                value={form.mobileNumber} onChange={(v) => set('mobileNumber', v)} error={fieldErrors.mobileNumber}
                hint="10-digit — used for OTP during redemption" required />
            </div>

            {/* Row 3: Sales Person Name, Email Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InputField label="Sales Person Name" id="salesPerson" placeholder="e.g. Rajesh Kumar"
                value={form.salesPerson} onChange={(v) => set('salesPerson', v)} error={fieldErrors.salesPerson} />

              <InputField label="Email Address" id="email" type="email" placeholder="e.g. vendor@example.com"
                value={form.email} onChange={(v) => set('email', v)} error={fieldErrors.email}
                hint="Optional" />
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
