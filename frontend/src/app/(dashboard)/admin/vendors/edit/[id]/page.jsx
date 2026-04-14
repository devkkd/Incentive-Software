'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { dummyVendors } from '@/data/dummyVendors';

export default function AdminEditVendorPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params?.id;

  // Initialize form state
  const [formData, setFormData] = useState({
    companyName: '',
    personName: '',
    mobileNumber: '',
    accountNumber: '',
    address: '',
    city: 'Jodhpur', 
    state: 'Rajasthan', 
  });

  // Fetch and populate data on mount
  useEffect(() => {
    if (vendorId) {
      const vendor = dummyVendors.find(v => v.id === vendorId);
      if (vendor) {
        setFormData({
          companyName: vendor.companyName.toUpperCase(),
          personName: vendor.personName,
          mobileNumber: vendor.mobileNumber,
          accountNumber: vendor.accountNumber,
          address: vendor.address.split(',')[0] + ', abcd Street', 
          city: 'Jodhpur',
          state: 'Rajasthan',
        });
      }
    }
  }, [vendorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate save action
    alert('Changes saved successfully!');
    router.push('/admin/vendors'); // Redirect back to Admin Vendors list
  };

  // Loading or not found state
  if (!formData.companyName && vendorId) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center h-full">
         <p className="text-gray-500 font-medium">Loading vendor data...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 md:p-10 overflow-auto relative z-10 flex flex-col items-center justify-center min-h-full">
      
      {/* Edit Form Card */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 w-full max-w-[900px]">
        
        <form onSubmit={handleSubmit}>
          <div className="p-8 md:p-10">
            <h2 className="text-[22px] font-bold text-gray-900 mb-8 tracking-tight">
              Edit Account
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              
              {/* Left Column */}
              <div className="space-y-6 border-r-0 md:border-r border-gray-100 md:pr-10">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Vendor Company Name</label>
                  <input 
                    type="text" 
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Vendor Person Name</label>
                  <input 
                    type="text" 
                    name="personName"
                    value={formData.personName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#A0ABC0]">Vendor Mobile Number</label>
                  <input 
                    type="text" 
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#A0ABC0] bg-gray-50/50 cursor-not-allowed focus:outline-none" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#A0ABC0]">Account Vendor Number / Party Code</label>
                  <input 
                    type="text" 
                    name="accountNumber"
                    value={formData.accountNumber}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#A0ABC0] bg-gray-50/50 cursor-not-allowed focus:outline-none" 
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6 md:pl-2">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">Vendor Address</label>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">City</label>
                  <input 
                    type="text" 
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-800">State</label>
                  <input 
                    type="text" 
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] transition-colors" 
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Footer / Submit Button */}
          <div className="border-t border-gray-100 p-8 flex justify-center bg-white rounded-b-[20px]">
            <button 
              type="submit"
              className="bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white font-semibold px-8 py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              Save Changes <span>→</span>
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}