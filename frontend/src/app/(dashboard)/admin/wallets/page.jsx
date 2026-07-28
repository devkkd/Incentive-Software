'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function WalletManagementPage() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Wallet Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletDesc, setNewWalletDesc] = useState('');
  const [newWalletMonth, setNewWalletMonth] = useState('');
  const [newWalletYear, setNewWalletYear] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Selected Wallet Parties Drawer / Modal
  const [selectedWallet, setSelectedWallet] = useState(null); // wallet object
  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [partySearch, setPartySearch] = useState('');

  // Action Loading states
  const [holdingWalletId, setHoldingWalletId] = useState(null);
  const [holdingMwId, setHoldingMwId] = useState(null);

  const fetchWallets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/wallets`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch wallets');
      setWallets(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleCreateWallet = async (e) => {
    e.preventDefault();
    if (!newWalletName.trim()) {
      setCreateError('Wallet name is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${API}/api/wallets`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newWalletName.trim(),
          description: newWalletDesc.trim(),
          month: newWalletMonth ? parseInt(newWalletMonth, 10) : undefined,
          year: newWalletYear ? parseInt(newWalletYear, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create wallet');

      setShowCreateModal(false);
      setNewWalletName('');
      setNewWalletDesc('');
      setNewWalletMonth('');
      setNewWalletYear('');
      fetchWallets();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleHoldWallet = async (wallet) => {
    const actionName = wallet.isHold ? 'release from hold' : 'put on hold';
    let reason = null;
    if (!wallet.isHold) {
      reason = window.prompt(`Reason for putting entire wallet "${wallet.name}" on hold (optional):`);
      if (reason === null) return; // User cancelled
    }

    setHoldingWalletId(wallet._id);
    try {
      const res = await fetch(`${API}/api/wallets/${wallet._id}/hold`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          isHold: !wallet.isHold,
          holdReason: reason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${actionName}`);

      fetchWallets();
      if (selectedWallet && selectedWallet._id === wallet._id) {
        openWalletParties(wallet);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setHoldingWalletId(null);
    }
  };

  const openWalletParties = async (wallet) => {
    setSelectedWallet(wallet);
    setLoadingParties(true);
    setPartySearch('');
    try {
      const res = await fetch(`${API}/api/wallets/${wallet._id}/parties`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch parties');
      setParties(data.data || []);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoadingParties(false);
    }
  };

  const handleTogglePartyHold = async (party) => {
    const actionName = party.isHold ? 'release balance' : 'hold balance';
    let reason = null;
    if (!party.isHold) {
      reason = window.prompt(`Reason for holding balance of party "${party.companyName}" (optional):`);
      if (reason === null) return;
    }

    setHoldingMwId(party.monthlyWalletId);
    try {
      const res = await fetch(`${API}/api/wallets/party-hold`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          monthlyWalletId: party.monthlyWalletId,
          isHold: !party.isHold,
          holdReason: reason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${actionName}`);

      // Refresh parties list
      if (selectedWallet) {
        openWalletParties(selectedWallet);
      }
      fetchWallets();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setHoldingMwId(null);
    }
  };

  // Filtered wallets
  const filteredWallets = wallets.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === 'active') return matchesSearch && !w.isHold;
    if (statusFilter === 'hold') return matchesSearch && w.isHold;
    return matchesSearch;
  });

  // Filtered parties in selected wallet
  const filteredParties = parties.filter((p) => {
    const q = partySearch.toLowerCase();
    return (
      p.companyName.toLowerCase().includes(q) ||
      p.personName.toLowerCase().includes(q) ||
      p.accountNumber.toLowerCase().includes(q) ||
      (p.mobileNumber && p.mobileNumber.includes(q))
    );
  });

  // Summary Metrics
  const totalSystemBalance = wallets.reduce((acc, w) => acc + (w.totalBalance || 0), 0);
  const totalSystemCredited = wallets.reduce((acc, w) => acc + (w.totalCredited || 0), 0);
  const heldWalletsCount = wallets.filter((w) => w.isHold).length;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[#2B3B8A]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </div>
            Wallet Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system wallets, view party balances, and control wallet & party hold status.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-[#2B3B8A] hover:bg-[#1f2c6e] text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Wallet
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total Wallets</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{wallets.length}</h3>
            <p className="text-xs text-gray-500 mt-1">{wallets.length - heldWalletsCount} active</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total System Balance</p>
            <h3 className="text-2xl font-bold text-[#16a34a] mt-1">₹{totalSystemBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-gray-500 mt-1">Across all party wallets</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total System Credited</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{totalSystemCredited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-gray-500 mt-1">Total lifetime credited</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-[#2B3B8A]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Wallets On Hold</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{heldWalletsCount}</h3>
            <p className="text-xs text-gray-500 mt-1">Redemptions restricted</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Controls Header */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search wallets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-[#2B3B8A] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#2B3B8A] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Wallets
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-[#16a34a] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Active Only
            </button>
            <button
              onClick={() => setStatusFilter('hold')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'hold'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              On Hold
            </button>
          </div>
        </div>

        {/* Wallets Table */}
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="animate-spin w-8 h-8 mx-auto text-[#2B3B8A] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading wallets data...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 font-medium">
            Error: {error}
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto text-gray-300 mb-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            No wallets found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Wallet Name</th>
                  <th className="px-6 py-4">Current Balance</th>
                  <th className="px-6 py-4">Credited Amount</th>
                  <th className="px-6 py-4">Parties Count</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredWallets.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{w.name}</div>
                      {w.description && <div className="text-xs text-gray-400 mt-0.5">{w.description}</div>}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      ₹{w.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      ₹{w.totalCredited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {w.totalParties} parties ({w.partiesWithBalance} active)
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {w.isHold ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          On Hold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openWalletParties(w)}
                          className="px-3 py-1.5 bg-[#2B3B8A]/10 hover:bg-[#2B3B8A] text-[#2B3B8A] hover:text-white font-semibold text-xs rounded-lg transition-colors"
                        >
                          View Parties
                        </button>
                        <button
                          onClick={() => handleToggleHoldWallet(w)}
                          disabled={holdingWalletId === w._id}
                          className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 ${
                            w.isHold
                              ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white'
                              : 'bg-amber-100 hover:bg-amber-600 text-amber-800 hover:text-white'
                          }`}
                        >
                          {holdingWalletId === w._id ? 'Updating...' : w.isHold ? 'Unhold Wallet' : 'Hold Wallet'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Wallet */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Wallet</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Wallet Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Scheme 2026, May 2025"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-[#2B3B8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Notes about this wallet..."
                  value={newWalletDesc}
                  onChange={(e) => setNewWalletDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-[#2B3B8A] h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Month (Optional)
                  </label>
                  <select
                    value={newWalletMonth}
                    onChange={(e) => setNewWalletMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                  >
                    <option value="">-- None --</option>
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Year (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2026"
                    value={newWalletYear}
                    onChange={(e) => setNewWalletYear(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm font-semibold bg-[#2B3B8A] hover:bg-[#1f2c6e] text-white rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Drawer: Wallet Parties List */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white h-full max-w-4xl w-full p-6 shadow-2xl flex flex-col justify-between border-l border-gray-200 overflow-y-auto">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedWallet.name}</h2>
                    {selectedWallet.isHold ? (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                        Entire Wallet On Hold
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                        Active Wallet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Parties holding balances in this wallet
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWallet(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Search */}
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="Search party by name, code, mobile..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                />
              </div>

              {/* Parties Table */}
              {loadingParties ? (
                <div className="py-12 text-center text-gray-500">
                  Loading party balances...
                </div>
              ) : filteredParties.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No parties found in this wallet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Party Name</th>
                        <th className="px-4 py-3">Party Code</th>
                        <th className="px-4 py-3">Credited</th>
                        <th className="px-4 py-3">Wallet Balance</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {filteredParties.map((p) => (
                        <tr key={p.monthlyWalletId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {p.companyName}
                            <div className="text-[10px] text-gray-400 font-normal">{p.personName} • {p.mobileNumber}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-gray-600">
                            {p.accountNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-600">
                            ₹{p.creditedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            ₹{p.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            {p.isHold ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                                Party On Hold
                              </span>
                            ) : p.walletIsHold ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800">
                                Wallet On Hold
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleTogglePartyHold(p)}
                              disabled={holdingMwId === p.monthlyWalletId}
                              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                                p.isHold
                                  ? 'bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white'
                                  : 'bg-amber-100 hover:bg-amber-600 text-amber-800 hover:text-white'
                              }`}
                            >
                              {holdingMwId === p.monthlyWalletId ? 'Saving...' : p.isHold ? 'Release Hold' : 'Hold Party'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedWallet(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
