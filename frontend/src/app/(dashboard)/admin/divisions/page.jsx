'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [form, setForm] = useState({ name: '', location: '', locationCode: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Edit modal
  const [editDiv, setEditDiv] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', location: '', locationCode: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Required';
    if (!form.location.trim()) errors.location = 'Required';
    if (!form.locationCode.trim()) errors.locationCode = 'Required';
    else if (form.locationCode.length > 5) errors.locationCode = 'Max 5 chars';
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
      setFormSuccess(`Division "${data.data.name}" (${data.data.locationCode}) created!`);
      setForm({ name: '', location: '', locationCode: '' });
      fetchDivisions();
      setTimeout(() => setFormSuccess(''), 4000);
    } catch { setFormError('Server error. Please try again.'); }
    finally { setFormLoading(false); }
  };

  // Edit
  const openEdit = (div) => {
    setEditDiv(div);
    setEditForm({ name: div.name, location: div.location, locationCode: div.locationCode });
    setEditError('');
  };

  const handleEdit = async () => {
    setEditLoading(true); setEditError('');
    try {
      const res = await fetch(`${API}/api/divisions/${editDiv._id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: editForm.name.toUpperCase(), location: editForm.location }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Update failed'); return; }
      setDivisions(prev => prev.map(d => d._id === editDiv._id ? { ...d, name: editForm.name.toUpperCase(), location: editForm.location } : d));
      setEditDiv(null);
    } catch { setEditError('Server error'); }
    finally { setEditLoading(false); }
  };

  // Delete
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/api/divisions/${deleteTarget._id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      });
      if (res.ok) {
        setDivisions(prev => prev.filter(d => d._id !== deleteTarget._id));
        setDeleteTarget(null);
      }
    } catch { /* silent */ }
    finally { setDeleteLoading(false); }
  };

  return (
    <div className="p-8 md:p-10 max-w-[1600px] mx-auto space-y-6">

      {/* Edit Modal */}
      {editDiv && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-[480px] shadow-2xl">
            <h2 className="text-[20px] font-bold text-gray-900 mb-6">Edit Location</h2>
            {editError && <div className="mb-4 p-3 bg-[#FDEDEC] rounded-xl text-[13px] text-red-700">{editError}</div>}
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Location Code</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Location Name</label>
                <input type="text" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">Serial No. <span className="text-gray-400 font-normal">(cannot change)</span></label>
                <input type="text" value={editForm.locationCode} disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm font-mono bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditDiv(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
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
            <h3 className="text-[18px] font-bold text-gray-900 mb-2">Delete Division?</h3>
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
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      {/* Success / Error banners */}
      {formSuccess && (
        <div className="p-4 bg-[#E4F8ED] border border-[#2ECC71]/20 rounded-xl text-[14px] text-green-800 font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {formSuccess}
        </div>
      )}

      {/* ── Create Division Form ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-[18px] font-bold text-gray-900 mb-6 tracking-tight">Create New Location</h2>

        {formError && (
          <div className="mb-5 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl text-[13px] text-red-700">{formError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {/* Division Name = Location Code like AJM */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Location Code <span className="text-[#E74C3C]">*</span></label>
              <input
                type="text" value={form.name} onChange={(e) => set('name', e.target.value.toUpperCase())}
                placeholder="e.g. AJM"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 placeholder:font-normal placeholder:tracking-normal ${fieldErrors.name ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}
              />
              {fieldErrors.name && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.name}</p>}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Location Name<span className="text-[#E74C3C]">*</span></label>
              <input
                type="text" value={form.location} onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Ajmer"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 ${fieldErrors.location ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}
              />
              {fieldErrors.location && <p className="text-[11px] text-[#E74C3C]">{fieldErrors.location}</p>}
            </div>

            {/* Serial Number = locationCode */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-gray-700">Serial No. <span className="text-[#E74C3C]">*</span></label>
              <input
                type="text" value={form.locationCode} maxLength={5}
                onChange={(e) => set('locationCode', e.target.value)}
                placeholder="e.g. 1"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] placeholder:text-gray-400 placeholder:font-normal ${fieldErrors.locationCode ? 'border-[#E74C3C] bg-red-50' : 'border-gray-200'}`}
              />
              {fieldErrors.locationCode
                ? <p className="text-[11px] text-[#E74C3C]">{fieldErrors.locationCode}</p>
                : <p className="text-[11px] text-gray-400">Invoice prefix: <span className="font-mono font-semibold text-[#2B3B8A]">{form.locationCode || 'N'}/XXXXX</span></p>
              }
            </div>
          </div>

          <button type="submit" disabled={formLoading}
            className={`font-semibold px-8 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all ${formLoading ? 'bg-[#8492A6] text-white cursor-not-allowed' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white shadow-sm'}`}>
            {formLoading
              ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating...</>
              : <>+ Create Location</>
            }
          </button>
        </form>
      </div>

      {/* ── Divisions Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">All Location</h2>
          <span className="text-[13px] text-gray-400 font-medium">{divisions.length} total</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : divisions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-900">
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">#</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Location Code</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Location</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Serial No.</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Invoice Prefix</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Vendor Prefix</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Status</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Created</th>
                  <th className="pb-3 pt-1 px-3 font-bold text-[13px]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 font-medium">
                {divisions.map((div, i) => (
                  <tr key={div._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-3 text-gray-400 text-[13px]">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-4 px-3 font-semibold text-gray-900 font-mono">{div.name}</td>
                    <td className="py-4 px-3 text-gray-600">{div.location}</td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-bold text-[#2B3B8A] bg-[#EEF2FF] px-2.5 py-1 rounded-lg text-[13px]">
                        {div.locationCode}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono text-[12px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        {div.locationCode}/XXXXX
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono text-[12px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        {div.name}-XXXXX
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={`px-3 py-1 rounded-lg border text-[12px] font-semibold ${div.isActive ? 'text-[#2ECC71] bg-[#E4F8ED] border-[#2ECC71]/20' : 'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20'}`}>
                        {div.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-gray-400 text-[13px]">{new Date(div.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(div)}
                          className="font-semibold px-3 py-1.5 rounded-lg text-[12px] bg-[#007BFF] hover:bg-[#0056b3] text-white transition-colors">
                          Edit
                        </button>
                        <button onClick={() => setDeleteTarget(div)}
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30 mx-auto mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <p className="text-[14px] font-medium text-gray-500">No Location yet</p>
            <p className="text-[12px] text-gray-400 mt-1">Use the form above to create your first Location</p>
          </div>
        )}
      </div>
    </div>
  );
}
