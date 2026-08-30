'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#2B3B8A', '#D97706', '#059669', '#0088FE', '#E74C3C', '#8B5CF6', '#EC4899', '#14B8A6'];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/dashboard/stats?year=${year}`, { headers: authHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const kpi1 = stats?.kpi1 || {};
  const kpi2 = stats?.kpi2 || {};
  // Point 9 — weekly redemption by branch
  const weeklyRedemptionData = stats?.weeklyRedemptionData || [];
  const branches = stats?.branches || [];
  const branchTotals = stats?.branchTotals || [];
  const pieData = stats?.pieData || [];

  const kpi2Items = [
    { title: 'Total Invoices Created', value: loading ? '...' : kpi2.totalInvoices?.toLocaleString() || '0', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /> },
    { title: 'Total Party', value: loading ? '...' : kpi2.totalVendors?.toLocaleString() || '0', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
    { title: 'Total FTC All Location', value: loading ? '...' : kpi2.totalDivisions?.toLocaleString() || '0', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
    { title: 'Total Incentives Uploaded', value: loading ? '...' : kpi2.totalUploads?.toLocaleString() || '0', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  ];

  // Find peak index for marker position

  return (
    <div className="p-8 md:p-10 max-w-[1500px] mx-auto">
      <div className="mb-6">
        <h2 className="text-[14px] text-gray-700 mb-1">Welcome to Friends Trading Corporation - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">Admin Portal</h1>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-sm text-gray-700 font-medium">Total Incentives Distributed</p>
          <h3 className="text-2xl font-bold text-black mt-2">{loading ? '...' : fmt(kpi1.totalIncentives)}</h3>
        </div>

        {/* ── POINT 8 — Incentive REDEEMED, not distributed ─────────────── */}
        <div className="bg-[#FDEDEC] border border-[#E74C3C]/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-sm text-gray-700 font-medium">Total Incentive Redeemed &mdash; This Week</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <h3 className="text-2xl font-bold text-black tabular-nums">{loading ? '...' : fmt(kpi1.weeklyRedeemed)}</h3>
            {!loading && kpi1.weeklyChange !== undefined && (
              <p className={`text-[11px] font-bold text-right leading-tight shrink-0 ${kpi1.weeklyChange >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                {kpi1.weeklyChange >= 0 ? '▲' : '▼'} {Math.abs(kpi1.weeklyChange)}%<br/>
                <span className="text-gray-500 font-normal">vs last week</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Monday to date</p>
        </div>

        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-sm text-gray-700 font-medium">Total Incentive Redeemed &mdash; This Month</p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <h3 className="text-2xl font-bold text-black tabular-nums">{loading ? '...' : fmt(kpi1.monthlyRedeemed)}</h3>
            {!loading && kpi1.monthlyChange !== undefined && (
              <p className={`text-[11px] font-bold text-right leading-tight shrink-0 ${kpi1.monthlyChange >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                {kpi1.monthlyChange >= 0 ? '▲' : '▼'} {Math.abs(kpi1.monthlyChange)}%<br/>
                <span className="text-gray-500 font-normal">vs last month</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Same point last month</p>
        </div>

        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-sm text-gray-700 font-medium">
            Total Incentive Redeemed &mdash; This Year
            {kpi1.fyLabel && <span className="text-gray-500 font-normal"> ({kpi1.fyLabel})</span>}
          </p>
          <div className="flex items-end justify-between mt-2 gap-2">
            <h3 className="text-2xl font-bold text-black tabular-nums">{loading ? '...' : fmt(kpi1.yearlyRedeemed)}</h3>
            {!loading && kpi1.yearlyChange !== undefined && (
              <p className={`text-[11px] font-bold text-right leading-tight shrink-0 ${kpi1.yearlyChange >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                {kpi1.yearlyChange >= 0 ? '▲' : '▼'} {Math.abs(kpi1.yearlyChange)}%<br/>
                <span className="text-gray-500 font-normal">vs last FY</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">1 April to date</p>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpi2Items.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-[#2B3B8A] rounded-full flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                {item.icon}
              </svg>
            </div>
            <div>
              <p className="text-[13px] text-gray-600 mb-0.5">{item.title}</p>
              <h3 className="text-[22px] font-bold text-black">{item.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5 mb-8">

        {/* Area Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 relative">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-black">Incentive Redeemed &mdash; Weekly</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {branchFilter === 'all' ? 'All locations' : branchFilter} &middot; last 12 weeks
              </p>
            </div>
            <div className="relative">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-4 py-1.5 pr-8 focus:outline-none cursor-pointer"
              >
                <option value="all">All Locations</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {branchFilter === 'all' ? (
                <LineChart data={weeklyRedemptionData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(v) => `₹${v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                    formatter={(v, n) => [`₹${Number(v).toLocaleString('en-IN')}`, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="line" />
                  {branches.map((b, i) => (
                    <Line
                      key={b}
                      type="monotone"
                      dataKey={b}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={weeklyRedemptionData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBranch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4196FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4196FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(v) => `₹${v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                    formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, branchFilter]}
                  />
                  <Area type="monotone" dataKey={branchFilter} stroke="#4196FF" strokeWidth={3} fillOpacity={1} fill="url(#colorBranch)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {branchFilter === 'all' && branchTotals.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1.5">
              {branchTotals.map((b, i) => (
                <button
                  key={b.name}
                  onClick={() => setBranchFilter(b.name)}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-70 transition-opacity"
                >
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[branches.indexOf(b.name) % CHART_COLORS.length] }} />
                  <span className="text-gray-600">{b.name}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{fmt(b.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col">
          <h3 className="text-[17px] font-bold text-black leading-tight mb-4">
            Incentives Distributed<br/>
            <span className="text-[#2B3B8A]">FTC Location Wise</span>
          </h3>

          {pieData.length > 0 ? (
            <>
              {/* Donut chart centered */}
              <div className="flex justify-center mb-4">
                <div className="relative w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n, p) => [`${v}% — ${fmt(p.payload.amount)}`, p.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-gray-400 font-medium">Total</p>
                    <p className="text-[12px] font-bold text-gray-900">{fmt(stats?.totalDivisionAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Scrollable legend */}
              <div className="overflow-y-auto max-h-[160px] space-y-2 pr-1">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[12px] font-semibold text-gray-800 font-mono truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[12px] font-bold text-gray-900">{item.value}%</span>
                      <span className="text-[11px] text-gray-400 ml-1.5">{fmt(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400 py-8">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
              <div>
                <p className="text-[13px] font-medium text-gray-500">No incentives distributed yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Upload incentives to see location-wise data</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Invoices */}
      {/* <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h3 className="text-[22px] font-bold text-black tracking-tight">All Invoices</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
              <span>Download In</span>
              <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
              <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
            </div>
            {['Timeline', 'Credited', 'Location/City'].map((filter) => (
              <div key={filter} className="relative">
                <select className="appearance-none bg-white border border-gray-200 text-gray-700 text-[13px] rounded-lg px-4 py-2 pr-8 focus:outline-none cursor-pointer">
                  <option value="">{filter}</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            ))}
            <div className="relative w-48">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Search" className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" />
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-500">
          Invoice data will populate here based on filters.
        </div>
      </div> */}
    </div>
  );
}
