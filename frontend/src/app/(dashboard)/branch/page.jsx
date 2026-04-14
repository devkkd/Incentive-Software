'use client';

import React, { useState, useRef } from 'react';
import { dummyVendors } from '@/data/dummyVendors';

export default function BranchDashboard() {
  // Global States
  const [searchQuery, setSearchQuery] = useState('1234567890');
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Form States
  const [invoiceForm, setInvoiceForm] = useState({ date: '', number: '', amount: '', location: '' });
  const [invoiceSummary, setInvoiceSummary] = useState({ date: 'DD/MM/YYYY', number: '#0000', amount: '₹0.00', location: 'City Name' });
  const [redeemAmount, setRedeemAmount] = useState('');
  
  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const otpInputRefs = useRef([]);

  // Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Handlers
  const handleSearch = (e) => {
    e.preventDefault();
    const vendor = dummyVendors.find(v => v.accountNumber === searchQuery || v.mobileNumber === searchQuery);
    if (vendor) {
      setSelectedVendor(vendor);
      setOtpSent(false);
      setOtpVerified(false);
      setOtp(['', '', '', '', '', '']);
      setRedeemAmount('');
    } else {
      alert("Vendor not found. Use 1234567890 for testing.");
      setSelectedVendor(null);
    }
  };

  const handleCreateInvoice = () => {
    setInvoiceSummary({
      date: invoiceForm.date || 'DD/MM/YYYY',
      number: invoiceForm.number || '#0000',
      amount: invoiceForm.amount ? `₹${invoiceForm.amount}` : '₹0.00',
      location: invoiceForm.location || 'City Name'
    });
  };

  const handleSendOTP = () => {
    if (!redeemAmount) {
      alert("Please enter an amount to redeem.");
      return;
    }
    setOtpSent(true);
    setOtpVerified(false);
    setOtpError('');
    setOtp(['', '', '', '', '', '']);
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOTP = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp === '888888') {
      setOtpVerified(true);
      setOtpError('');
    } else {
      setOtpError('Invalid OTP. Please use 888888.');
    }
  };

  const handleSubmit = () => {
    if (otpVerified) {
      setShowSuccessModal(true);
    }
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    setOtpSent(false);
    setOtpVerified(false);
    setRedeemAmount('');
    setOtp(['', '', '', '', '', '']);
  };

  return (
    <div className="p-8 md:p-10 relative">
      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 bg-[#00B65E] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-10 h-10 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">Redemption Successful</h2>
            <p className="text-[15px] text-gray-600 mb-8 leading-relaxed px-4">
              Your Incentives Wallet amount has been redeemed successfully.
            </p>
            <button 
              onClick={closeModal}
              className="bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white font-semibold w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              Done <span>→</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h2 className="text-[15px] text-gray-700 mb-1">
          Welcome to Faith Trust Commitment - Incentive Management
        </h2>
        <h1 className="text-[28px] font-bold text-black mb-8 tracking-tight">
          Jodhpur Division
        </h1>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col min-h-[300px]">
          {/* Row 1: Top Search and Vendor Profile */}
          <div className="flex flex-col md:flex-row border-b border-gray-100 min-h-[220px]">
            <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col justify-center">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Create an Invoice</h3>
              <form onSubmit={handleSearch} className="space-y-2">
                <label className="block text-sm font-medium text-gray-800">
                  Vendor Account Number / Mobile Number
                </label>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Vendor Account Number / Mobile Number"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 text-sm"
                  />
                  <button 
                    type="submit"
                    className={`font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap
                      ${searchQuery ? 'bg-[#2B3B8A] text-white hover:bg-[#1f2b66]' : 'bg-[#CBD5E1] text-[#64748B] hover:bg-gray-300'}`}
                  >
                    Submit <span>→</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-1/2 p-8 bg-white flex flex-col justify-center">
              {selectedVendor && (
                <div className="flex flex-col xl:flex-row items-start justify-between gap-6">
                  <div className="space-y-3 text-[13px] text-gray-700 font-medium">
                    <p className="text-[16px] font-bold text-black">{selectedVendor.companyName} (Vendor Company Name)</p>
                    <p>{selectedVendor.personName} (Vendor Person Name)</p>
                    <p>{selectedVendor.accountNumber} (Vendor Account Number)</p>
                    <p>{selectedVendor.mobileNumber} (Vendor Mobile Number)</p>
                    <p className="max-w-[250px]">{selectedVendor.address} (Vendor Address)</p>
                  </div>
                  <div className="bg-[#E4F8ED] p-5 rounded-2xl w-full xl:w-[280px] shrink-0">
                    <p className="text-[13px] text-gray-700 font-medium mb-1">Incentives Wallet Available Amount</p>
                    <h2 className="text-[32px] font-bold text-black mb-4">₹{selectedVendor.walletAvailable}</h2>
                    <div className="text-[11px] text-gray-600 font-medium">
                      <p className="mb-0.5">Last Redemption</p>
                      <p>Amount : <span className="font-bold text-black">₹{selectedVendor.lastRedemptionAmount}</span> | Date : <span className="font-bold text-black">{selectedVendor.lastRedemptionDate}</span></p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedVendor && (
            <>
              {/* Row 2: Forms Split */}
              <div className="flex flex-col md:flex-row border-b border-gray-100">
                <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Create an Invoice</h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Date</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={invoiceForm.date}
                          onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})}
                          placeholder="20/03/2026" 
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" 
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </div>
                    </div>
                    {/* ... (rest of invoice form inputs) */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Number</label>
                      <input 
                        type="text" 
                        value={invoiceForm.number}
                        onChange={(e) => setInvoiceForm({...invoiceForm, number: e.target.value})}
                        placeholder="041234567890" 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Amount (₹)</label>
                      <input 
                        type="text" 
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                        placeholder="5680.00" 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Location/City</label>
                      <input 
                        type="text" 
                        value={invoiceForm.location}
                        onChange={(e) => setInvoiceForm({...invoiceForm, location: e.target.value})}
                        placeholder="Jodhpur" 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" 
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleCreateInvoice}
                    className="bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-8 py-2.5 rounded-xl self-start flex items-center justify-center gap-2 mb-8 transition-colors"
                  >
                    Create <span>→</span>
                  </button>

                  <div className="border-t border-dashed border-gray-300 pt-6 mt-auto space-y-4 text-[13px]">
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Date</span> <span className="text-gray-800">{invoiceSummary.date}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Number</span> <span className="text-gray-800">{invoiceSummary.number}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Amount (₹)</span> <span className="text-gray-800">{invoiceSummary.amount}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Location/City</span> <span className="text-gray-800">{invoiceSummary.location}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/2 p-8 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Incentives Wallet Redemption</h3>
                  <div className="space-y-1.5 mb-8">
                    <label className="text-[13px] font-medium text-gray-800">Redeem Incentives Wallet Amount (₹)</label>
                    <div className="flex gap-4">
                      <input 
                        type="text" 
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                        placeholder="5680.00" 
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]" 
                      />
                      <button 
                        onClick={handleSendOTP}
                        className="bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white font-semibold px-6 py-2.5 rounded-xl whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        Send OTP <span>→</span>
                      </button>
                    </div>
                  </div>

                  {otpSent && (
                    <div className="mb-8 animate-in fade-in duration-300">
                      <div className="border-t border-dashed border-gray-300 pt-6 mb-6"></div>
                      <p className="text-[13px] text-gray-800 font-medium mb-3">
                        Enter the 6-digit code Sent To Your Mobile Number ({selectedVendor.mobileNumber})
                      </p>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex gap-3">
                          {otp.map((digit, index) => (
                            <input
                              key={index}
                              ref={(el) => (otpInputRefs.current[index] = el)}
                              type="text"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpChange(index, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(index, e)}
                              className="w-[50px] h-[52px] text-center text-lg font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-all bg-white"
                            />
                          ))}
                        </div>
                        <button 
                          onClick={handleVerifyOTP}
                          className={`font-semibold px-6 py-3.5 rounded-xl whitespace-nowrap flex items-center justify-center gap-2 transition-colors
                            ${otpVerified ? 'bg-[#00B65E] text-white' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'}`}
                        >
                          {otpVerified ? 'Verified ✓' : 'Verify OTP →'}
                        </button>
                      </div>
                      {otpError && <p className="text-red-500 text-xs mt-1">{otpError}</p>}
                    </div>
                  )}

                  <div className="border-t border-dashed border-gray-300 pt-6 mt-auto flex justify-between items-center">
                     <span className="font-bold text-black text-[15px]">Pay Total Amount</span>
                     <span className="font-bold text-black text-[18px]">
                       {redeemAmount ? `₹${parseFloat(redeemAmount).toFixed(2)}` : '₹0.00'}
                     </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons & History Table */}
              <div className="border-b border-gray-100 p-8 flex items-center justify-center gap-4 bg-[#F8FAFC]">
                <button 
                  onClick={handleSubmit}
                  disabled={!otpVerified}
                  className={`font-semibold px-10 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300
                    ${otpVerified ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md' : 'bg-[#8492A6] text-white opacity-80 cursor-not-allowed'}`}
                >
                  Submit <span>→</span>
                </button>
              </div>

              <div className="p-8">
                {/* ... (History table code remains the same as your original) */}
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[22px] font-bold text-black tracking-tight">Incentives Wallet History</h3>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                    {/* ... Table Header & Body */}
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="pb-4 font-bold text-black">#</th>
                        <th className="pb-4 font-bold text-black">Date and Time</th>
                        <th className="pb-4 font-bold text-black">Credited</th>
                        <th className="pb-4 font-bold text-black">Debited</th>
                        <th className="pb-4 font-bold text-black">Wallet Available Amount</th>
                        <th className="pb-4 font-bold text-black">Invoice Date</th>
                        <th className="pb-4 font-bold text-black">Invoice Number</th>
                        <th className="pb-4 font-bold text-black">Invoice Amount (₹)</th>
                        <th className="pb-4 font-bold text-black">Location/City</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 font-medium">
                      {selectedVendor.history.map((row, index) => (
                        <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-4">{row.id}</td>
                          <td className="py-4">{row.date}</td>
                          <td className="py-4 text-[#2ECC71]">{row.credited}</td>
                          <td className="py-4 text-[#E74C3C]">{row.debited}</td>
                          <td className="py-4">{row.available}</td>
                          <td className="py-4">{row.invDate}</td>
                          <td className="py-4">{row.invNum}</td>
                          <td className="py-4">{row.invAmount}</td>
                          <td className="py-4">{row.location}</td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}