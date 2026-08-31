'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/context/LanguageContext';
import SortableTh from '@/components/SortableTh';
import useClientSort from '@/components/useClientSort';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);

  // Point 11
  const { sort, setSort, sorted: sortedBranches } = useClientSort(branches, {
    name:      (b) => b.name,
    email:     (b) => b.email,
    location:  (b) => b.division?.name || b.location,
    code:      (b) => b.division?.locationCode || b.code,
    isActive:  (b) => (b.isActive ? 'Active' : 'Inactive'),
    createdAt: (b) => b.createdAt,
  });
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  // Create form
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', divisionId: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Edit modal
  const [editBranch, setEditBranch] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', divisionId: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Edit
  const openEdit = (branch) => {
    setEditBranch(branch);
    setEditForm({ name: branch.name, email: branch.email, divisionId: branch.division?._id || '' });
    setEditError('');
  };

  const handleEdit = async () => {
    setEditLoading(true); setEditError('');
    try {
      const res = await fetch(`${API}/api/users/branches/${editBranch._id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Update failed'); return; }
      setBranches(prev => prev.map(b => b._id === editBranch._id ? { ...b, name: editForm.name, email: editForm.email } : b));
      setEditBranch(null);
      fetchBranches();
    } catch { setEditError('Server error'); }
    finally { setEditLoading(false); }
  };

  // Delete
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/api/users/branches/${deleteTarget._id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      });
      if (res.ok) {
        setBranches(prev => prev.filter(b => b._id !== deleteTarget._id));
        setDeleteTarget(null);
      }
    } catch { /* silent */ }
    finally { setDeleteLoading(false); }
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">

      {/* Edit Modal */}
      {editBranch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-[480px] shadow-2xl">
            <h2 className="text-[20px] font-bold text-gray-900 mb-6">Edit Branch</h2>
            {editError && <div className="mb-4 p-3 bg-[#FDEDEC] rounded-xl text-[13px] text-red-700">{editError}</div>}
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Location Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Email Address</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Location</label>
                <select value={editForm.divisionId} onChange={e => setEditForm(p => ({ ...p, divisionId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]">
                  <option value="">Select Location</option>
                  {divisions.map(d => <option key={d._id} value={d._id}>{d.name} ({d.locationCode})</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditBranch(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleEdit} disabled={editLoading}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-colors ${editLoading ? 'bg-[#8492A6]' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b]'}`}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-[420px] shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-[#E74C3C]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 mb-2">Delete Branch?</h3>
            <p className="text-[13px] text-gray-500 mb-6">
              Are you sure you want to delete <span className="font-bold text-gray-800">"{deleteTarget.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-colors ${deleteLoading ? 'bg-[#8492A6]' : 'bg-[#E74C3C] hover:bg-red-600'}`}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        {formError && <div className="mb-5 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[13px] text-red-700">{formError}</div>}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Location Code<span className="text-[#E74C3C]">*</span></label>
              <select value={form.divisionId} onChange={(e) => {
                const val = e.target.value;
                set('divisionId', val);
                const div = divisions.find(d => d._id === val);
                if (div) set('name', div.location);
                else set('name', '');
              }}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] ${fieldErrors.divisionId ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}>
                <option value="">Select Location</option>
                {divisions.map(d => <option key={d._id} value={d._id}>{d.name} ({d.locationCode})</option>)}
              </select>
              {fieldErrors.divisionId && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.divisionId}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700"> Email <span className="text-[#E74C3C]">*</span></label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="e.g. jodhpur@ftc.com"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.email ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.email && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Location Name <span className="text-[#E74C3C]">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Jodhpur Branch"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.name ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.name && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Password <span className="text-[#E74C3C]">*</span></label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.password ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    {showPass ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                  </svg>
                </button>
              </div>
              {fieldErrors.password && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.password}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Confirm Password <span className="text-[#E74C3C]">*</span></label>
              <input type="password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.confirmPassword ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`} />
              {fieldErrors.confirmPassword && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.confirmPassword}</p>}
            </div>
          </div>
          <button type="submit" disabled={formLoading}
            className={`font-semibold px-8 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-sm'}`}>
            {formLoading ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating...</> : <>+ Create Branch</>}
          </button>
        </form>
      </div>

      {/* ── Branches Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">All Party</h2>
          <span className="text-[13px] text-gray-400 font-medium">{branches.length} total</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : branches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900">
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">#</th>
                  <SortableTh field="name" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Location Name</SortableTh>
                  <SortableTh field="email" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Email</SortableTh>
                  <SortableTh field="location" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Location</SortableTh>
                  <SortableTh field="code" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Code</SortableTh>
                  <SortableTh field="createdAt" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Created</SortableTh>
                  <SortableTh field="isActive" sort={sort} setSort={setSort} className="pb-3 pt-1 px-3 font-bold text-[13px]">Status</SortableTh>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium">
                {sortedBranches.map((branch, i) => (
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
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggle(branch._id, branch.isActive)}
                          className={`font-semibold px-3 py-1.5 rounded-lg text-[12px] transition-colors ${branch.isActive ? 'bg-[#1A1A1A] hover:bg-black text-white' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'}`}>
                          {branch.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => openEdit(branch)}
                          className="font-semibold px-3 py-1.5 rounded-lg text-[12px] bg-[#007BFF] hover:bg-[#0056b3] text-white transition-colors">
                          Edit
                        </button>
                        <button onClick={() => setDeleteTarget(branch)}
                          className="font-semibold px-3 py-1.5 rounded-lg text-[12px] bg-[#E74C3C] hover:bg-red-600 text-white transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">
            <p className="text-[14px] font-medium text-gray-500">No branches yet</p>
            <p className="text-[12px] text-gray-400 mt-1">Use the form above to create your first branch</p>
          </div>
        )}
      </div>
    </div>
  );
}


