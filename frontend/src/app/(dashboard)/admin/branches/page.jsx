'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/context/LanguageContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  // Form state
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', divisionId: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users/branches`, { headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (res.ok) setBranches(data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchBranches();
    fetch(`${API}/api/divisions`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setDivisions(d.data); });
  }, []);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setFormError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Required';
    if (!form.email.trim()) errors.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email';
    if (!form.divisionId) errors.divisionId = 'Required';
    if (!form.password) errors.password = 'Required';
    else if (form.password.length < 8) errors.password = 'Min 8 characters';
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
      setFormSuccess(`Branch "${data.data.name}" created successfully!`);
      setForm({ name: '', email: '', password: '', confirmPassword: '', divisionId: '' });
      fetchBranches();
      setTimeout(() => setFormSuccess(''), 4000);
    } catch { setFormError('Server error. Please try again.'); }
    finally { setFormLoading(false); }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      const res = await fetch(`${API}/api/users/branches/${id}/toggle`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
      });
      if (res.ok) setBranches(prev => prev.map(b => b._id === id ? { ...b, isActive: !currentStatus } : b));
    } catch { /* silent */ }
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-[14px] text-gray-700 mb-1">{t('welcomeMsg')}</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">{t('adminPortal')}</h1>
      </div>

      {formSuccess && (
        <div className="p-4 bg-[#E4F8ED] border border-[#2ECC71]/20 rounded-xl text-[14px] text-green-800 font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {formSuccess}
        </div>
      )}

      {/* ── Create Branch Form ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-[18px] font-bold text-gray-900 mb-6 tracking-tight">{t('createBranch')}</h2>

        {formError && (
          <div className="mb-5 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[13px] text-red-700">{formError}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Branch Name */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">{t('branchName')} <span className="text-[#E74C3C]">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Jodhpur Branch"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.name ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.name && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">{t('emailAddress')} <span className="text-[#E74C3C]">*</span></label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="e.g. jodhpur@ftc.com"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.email ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.email && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.email}</p>}
            </div>

            {/* Division */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">{t('division')} <span className="text-[#E74C3C]">*</span></label>
              <select value={form.divisionId} onChange={(e) => set('divisionId', e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.divisionId ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}>
                <option value="">{t('selectDivision')}</option>
                {divisions.map(d => <option key={d._id} value={d._id}>{d.name} ({d.locationCode})</option>)}
              </select>
              {fieldErrors.divisionId && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.divisionId}</p>}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">{t('password')} <span className="text-[#E74C3C]">*</span></label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.password ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    {showPass
                      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                  </svg>
                </button>
              </div>
              {fieldErrors.password && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">{t('confirmPassword2')} <span className="text-[#E74C3C]">*</span></label>
              <input type="password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.confirmPassword ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.confirmPassword && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.confirmPassword}</p>}
            </div>
          </div>

          <button type="submit" disabled={formLoading}
            className={`font-semibold px-8 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-sm'}`}>
            {formLoading
              ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>{t('creating')}</>
              : <>+ {t('createBranch')}</>
            }
          </button>
        </form>
      </div>

      {/* ── Branches Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">{t('allBranches')}</h2>
          <span className="text-[13px] text-gray-400 font-medium">{branches.length} {t('total')}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : branches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900">
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">#</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Branch Name</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Email</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Division</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Location Code</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Created</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Status</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium">
                {branches.map((branch, i) => (
                  <tr key={branch._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-3 text-gray-400 text-[13px]">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-4 px-3 font-semibold text-gray-900">{branch.name}</td>
                    <td className="py-4 px-3 text-gray-600">{branch.email}</td>
                    <td className="py-4 px-3 text-gray-600">{branch.division?.name || '—'}</td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-bold text-[#2B3B8A] bg-[#EEF2FF] px-2.5 py-1 rounded-lg text-[13px]">
                        {branch.division?.locationCode || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-gray-400 text-[13px]">{new Date(branch.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-3">
                      <span className={`px-3 py-1 rounded-lg border text-[12px] font-semibold ${branch.isActive ? 'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20' : 'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20'}`}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <button onClick={() => handleToggle(branch._id, branch.isActive)}
                        className={`font-semibold px-4 py-1.5 rounded-lg text-[12px] transition-colors ${branch.isActive ? 'bg-[#1A1A1A] hover:bg-black text-white' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'}`}>
                        {branch.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-[14px] font-medium text-gray-500">No branches yet</p>
            <p className="text-[12px] text-gray-400 mt-1">Use the form above to create your first branch</p>
          </div>
        )}
      </div>
    </div>
  );
}
