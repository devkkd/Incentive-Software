'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', locationCode: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchDivisions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) setDivisions(data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDivisions(); }, []);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setFormError('');
  };

  // Auto-generate location code from name
  const handleNameChange = (value) => {
    set('name', value);
    if (!form.locationCode) {
      const code = value.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5);
      setForm(prev => ({ ...prev, name: value, locationCode: code }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Division name required';
    if (!form.location.trim()) errors.location = 'Location required';
    if (!form.locationCode.trim()) errors.locationCode = 'Location code required';
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
        body: JSON.stringify({ ...form, locationCode: form.locationCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message); return; }
      setFormSuccess(`Division "${data.data.name}" created successfully!`);
      setForm({ name: '', location: '', locationCode: '' });
      setShowForm(false);
      fetchDivisions();
      setTimeout(() => setFormSuccess(''), 4000);
    } catch { setFormError('Server error'); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      {/* Success */}
      {formSuccess && (
        <div className="p-4 bg-[#E4F8ED] border border-[#2ECC71]/20 rounded-xl text-[14px] text-green-800 font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {formSuccess}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">Create New Division / Branch</h2>
            <button onClick={() => { setShowForm(false); setFormError(''); setFieldErrors({}); }}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {formError && (
            <div className="mb-5 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[13px] text-red-700">{formError}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              {/* Division Name */}
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-gray-800">Division Name <span className="text-[#E74C3C]">*</span></label>
                <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Jodhpur Division"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.name ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                {fieldErrors.name && <p className="text-[12px] text-[#E74C3C]">{fieldErrors.name}</p>}
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-gray-800">Location / City <span className="text-[#E74C3C]">*</span></label>
                <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Jodhpur"
                  className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.location ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                {fieldErrors.location && <p className="text-[12px] text-[#E74C3C]">{fieldErrors.location}</p>}
              </div>

              {/* Location Code */}
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-gray-800">Location Code <span className="text-[#E74C3C]">*</span></label>
                <input type="text" value={form.locationCode}
                  onChange={(e) => set('locationCode', e.target.value.toUpperCase())}
                  placeholder="e.g. JDH"
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.locationCode ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                {fieldErrors.locationCode
                  ? <p className="text-[12px] text-[#E74C3C]">{fieldErrors.locationCode}</p>
                  : <p className="text-[12px] text-gray-400">Used as prefix: <span className="font-mono font-semibold text-[#2B3B8A]">{form.locationCode || 'XXX'}-00001</span></p>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button type="submit" disabled={formLoading}
                className={`font-semibold px-8 py-3 rounded-xl flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-md'}`}>
                {formLoading ? 'Creating...' : 'Create Division →'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormError(''); setFieldErrors({}); }}
                className="font-semibold px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Divisions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">FTC Incentive All Divisions</h2>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Division
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : divisions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {divisions.map((div) => (
              <div key={div._id} className="border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#2B3B8A] rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-[13px] font-mono">{div.locationCode}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${div.isActive ? 'bg-[#E4F8ED] text-[#2ECC71]' : 'bg-gray-100 text-gray-500'}`}>
                    {div.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-gray-900 mb-1">{div.name}</h3>
                <p className="text-[13px] text-gray-500 mb-3">{div.location}</p>
                <div className="text-[12px] text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2">
                  Prefix: <span className="font-semibold text-[#2B3B8A]">{div.locationCode}-XXXXX</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 opacity-40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <p className="text-[14px] font-medium text-gray-500">No divisions found</p>
              <p className="text-[12px] text-gray-400">Click "Create Division" to add your first division</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
