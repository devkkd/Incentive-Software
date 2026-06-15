'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function AdminEditVendorPage() {
  const params  = useParams();
  const router  = useRouter();
  const vendorId = params?.id;

  const [formData, setFormData] = useState({
    companyName:  '',
    personName:   '',
    mobileNumber: '',
    email:        '',
    address:      '',
    partyCity:    '',
    partyType:    '',
    salesPerson:  '',
    accountNumber: '',
    status:       'active',
  });

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  // Fetch vendor on mount
  useEffect(() => {
    if (!vendorId) return;
    const fetchVendor = async () => {
      try {
        const res  = await fetch(`${API}/api/vendors/${vendorId}`, { headers: authHeaders(), credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { setError(data.message || 'Failed to load vendor'); return; }
        const v = data.data;
        setFormData({
          companyName:   v.companyName  || '',
          personName:    v.personName   || '',
          mobileNumber:  v.mobileNumber || '',
          email:         v.email        || '',
          address:       v.address      || '',
          partyCity:     v.partyCity    || '',
          partyType:     v.partyType    || '',
          salesPerson:   v.salesPerson  || '',
          accountNumber: v.accountNumber || '',
          status:        v.status       || 'active',
        });
      } catch {
        setError('Unable to connect to server');
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!formData.companyName.trim()) { setError('Party name is required'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/vendors/${vendorId}`, {
        method:  'PUT',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          companyName:  formData.companyName.trim(),
          personName:   formData.personName.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          email:        formData.email.trim() || null,
          address:      formData.address.trim(),
          partyCity:    formData.partyCity.trim(),
          partyType:    formData.partyType.trim(),
          salesPerson:  formData.salesPerson.trim(),
          status:       formData.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to save changes'); return; }
      setSuccess('Changes saved successfully!');
      setTimeout(() => router.push('/admin/vendors'), 1200);
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-[14px]">Loading party details...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 md:p-10 overflow-auto relative z-10 flex flex-col items-center justify-start min-h-full">
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 w-full max-w-[900px]">
        <form onSubmit={handleSubmit}>
          <div className="p-8 md:p-10">
            <div className="mb-8">
              <button type="button" onClick={() => router.back()}
                className="text-[13px] text-gray-500 hover:text-gray-800 flex items-center gap-1.5 mb-4 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
              <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Edit Party</h2>
              <p className="text-[13px] text-gray-500 mt-1 font-mono">{formData.accountNumber}</p>
            </div>

            {error   && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">{error}</div>}
            {success && <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-xl text-[13px] text-green-700 font-medium">{success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">

              {/* Left Column */}
              <div className="space-y-5 md:border-r border-gray-100 md:pr-10">

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Party Name <span className="text-red-400">*</span></label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Contact Person</label>
                  <input type="text" name="personName" value={formData.personName} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Mobile Number</label>
                  <input type="text" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange}
                    maxLength={10}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-500">Party Code</label>
                  <input type="text" value={formData.accountNumber} readOnly
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm text-gray-400 bg-gray-50 cursor-not-allowed" />
                </div>

              </div>

              {/* Right Column */}
              <div className="space-y-5 md:pl-2">

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Location / City</label>
                  <input type="text" name="partyCity" value={formData.partyCity} onChange={handleChange}
                    placeholder="e.g. Jodhpur"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Party Type</label>
                  <input type="text" name="partyType" value={formData.partyType} onChange={handleChange}
                    placeholder="e.g. CO-DEALER, DEALER"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Sales Person</label>
                  <input type="text" name="salesPerson" value={formData.salesPerson} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 p-8 flex justify-center bg-white rounded-b-[20px]">
            <button type="submit" disabled={saving}
              className="bg-[#2B3B8A] hover:bg-[#1a2d6b] disabled:opacity-60 transition-colors text-white font-semibold px-10 py-3 rounded-xl flex items-center gap-2 shadow-sm">
              {saving ? 'Saving...' : 'Save Changes →'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
