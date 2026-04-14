'use client';

// Important: Run `npm install recharts` in your terminal to use the charts
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Dummy Chart Data
const areaData = [
  { name: 'JAN', value: 95000 }, { name: 'FEB', value: 105000 },
  { name: 'MAR', value: 98000 }, { name: 'APR', value: 85000 },
  { name: 'MAY', value: 120000, peak: 96560.90 }, // Peak as per design
  { name: 'JUN', value: 80000 }, { name: 'JUL', value: 25000 },
  { name: 'AUG', value: 25000 }, { name: 'SEP', value: 25000 },
  { name: 'OCT', value: 25000 }, { name: 'NOV', value: 25000 },
  { name: 'DEC', value: 25000 }
];

const pieData = [
  { name: 'Jodhpur', value: 48, color: '#2B3B8A' },
  { name: 'Jaipur', value: 22, color: '#D97706' }, // Orange
  { name: 'Bikaner', value: 15, color: '#059669' }, // Green
  { name: 'Udaipur', value: 10, color: '#0088FE' }, // Blue
  { name: 'Other Division', value: 5, color: '#9CA3AF' } // Gray
];

export default function AdminDashboardPage() {
  return (
    <div className="p-8 md:p-10 max-w-[1500px] mx-auto">
      
      {/* Page Titles */}
      <div className="mb-6">
        <h2 className="text-[14px] text-gray-700 mb-1">
          Welcome to Faith Trust Commitment - Incentive Management
        </h2>
        <h1 className="text-[28px] font-bold text-black tracking-tight">
          Admin Portal
        </h1>
      </div>

      {/* --- KPI CARDS ROW 1 --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
        
        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-gray-700 mb-2 font-medium">Total Incentives Distributed</p>
          <h3 className="text-2xl font-bold text-black">₹14,60,560.90</h3>
        </div>

        <div className="bg-[#FDEDEC] border border-[#E74C3C]/30 rounded-2xl p-6 shadow-sm relative">
          <p className="text-sm text-gray-700 mb-2 font-medium">Average Weekly Incentives Distributed</p>
          <h3 className="text-2xl font-bold text-black">₹10,560.90</h3>
          <p className="text-[10px] font-bold text-[#E74C3C] absolute bottom-6 right-6 flex items-center">
            ▼ 14% Decrease in <br/>Last Week
          </p>
        </div>

        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm relative">
          <p className="text-sm text-gray-700 mb-2 font-medium">Average Monthly Incentives Distributed</p>
          <h3 className="text-2xl font-bold text-black">₹56,560.90</h3>
          <p className="text-[10px] font-bold text-[#2ECC71] absolute bottom-6 right-6 flex items-center">
            ▲ 12% Increase in <br/>Last Month
          </p>
        </div>

        <div className="bg-[#E4F8ED] border border-[#2ECC71]/30 rounded-2xl p-6 shadow-sm relative">
          <p className="text-sm text-gray-700 mb-2 font-medium">Average Yearly Incentives Distributed</p>
          <h3 className="text-2xl font-bold text-black">₹4,60,560.90</h3>
          <p className="text-[10px] font-bold text-[#2ECC71] absolute bottom-6 right-6 flex items-center">
            ▲ 28% Increase in <br/>Last Year
          </p>
        </div>
      </div>

      {/* --- KPI CARDS ROW 2 --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {[
          { title: "Total Invoices Created", value: "367", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /> },
          { title: "Total Vendors/Party", value: "657", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
          { title: "Total FTC All Division", value: "6", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
          { title: "Total Incentives Uploaded", value: "456", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> }
        ].map((item, idx) => (
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

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5 mb-8">
        
        {/* Left Chart: Area Graph */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-black">Incentives Distributed</h3>
            <div className="relative">
              <select className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-4 py-1.5 pr-8 focus:outline-none cursor-pointer">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4196FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4196FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(value) => `₹${value / 1000}K`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#4196FF" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Custom Tooltip Peak Marker (from design) */}
          <div className="absolute left-[38%] top-[80px] -translate-x-1/2 bg-[#007BFF] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md z-10 pointer-events-none">
            ₹96,560.90
          </div>
          <div className="absolute left-[38%] top-[105px] h-[220px] border-l border-dashed border-gray-400 z-0 pointer-events-none"></div>
        </div>

        {/* Right Chart: Doughnut Graph */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-[17px] font-bold text-black leading-tight max-w-[200px]">
              Incentives Distributed <br/>FTC Division Wise
            </h3>
            <div className="relative shrink-0">
              <select className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-4 py-1.5 pr-8 focus:outline-none cursor-pointer">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-between mt-4 relative">
            <div className="w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text */}
              <div className="absolute top-[48%] left-[28%] -translate-x-1/2 -translate-y-1/2 text-white font-bold text-[11px] pointer-events-none z-10">
                48%
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex flex-col gap-4">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: item.color }}></div>
                  <div className="text-[11px] text-gray-800 font-medium leading-tight">
                    <p>{item.name} {item.value}%</p>
                    <p className="text-gray-500">₹96,560.90</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center mt-4">
            <h3 className="text-xl font-bold text-black">₹4,60,560.90</h3>
          </div>
        </div>

      </div>

      {/* --- BOTTOM SECTION: ALL INVOICES TABLE HEADER --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h3 className="text-[22px] font-bold text-black tracking-tight">All Invoices</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
              <span>Download In</span>
              <div className="bg-[#E74C3C] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-red-600 transition-colors">PDF</div>
              <div className="bg-[#2ECC71] text-white text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer hover:bg-green-600 transition-colors">XLS</div>
            </div>

            {/* Filters */}
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

            {/* Search Input */}
            <div className="relative w-48">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
              />
            </div>
          </div>
        </div>

        {/* Table placeholder for future implementation */}
        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-500">
          Invoice data will populate here based on filters.
        </div>
      </div>

    </div>
  );
}