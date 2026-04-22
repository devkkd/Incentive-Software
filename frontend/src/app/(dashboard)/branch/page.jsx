'use client';

import React, { useState, useRef, useMemo } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function BranchDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ date: '', number: '', amount: '', location: '' });
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState(null);

  // Wallet history
  const [walletHistory, setWalletHistory] = useState([]);

  // Redemption
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const otpInputRefs = useRef([]);

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Live calculation: invoice amount - redeem amount = total payable
  const invoiceAmt = parseFloat(invoiceForm.amount) || 0;
  const redeemAmt = parseFloat(redeemAmount) || 0;
  const totalPayable = useMemo(() => Math.max(0, invoiceAmt - redeemAmt), [invoiceAmt, redeemAmt]);

  // Insufficient balance check
  const walletBalance = selectedVendor ? parseFloat(selectedVendor.walletBalance) : 0;
  const isInsufficientBalance = redeemAmt > 0 && redeemAmt > walletBalance;

  // --- Search Vendor ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    setSelectedVendor(null);
    setCreatedInvoice(null);
    setWalletHistory([]);
    setRedeemAmount('');
    setOtpSent(false);
    setOtpVerified(false);

    try {
      const res = await fetch(`${API}/api/vendors/search?q=${searchQuery}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setSearchError(data.message || 'Vendor not found'); return; }
      setSelectedVendor(data.data);
      fetchWalletHistory(data.data._id);
    } catch {
      setSearchError('Unable to connect to server');
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchWalletHistory = async (vendorId) => {
    try {
      const res = await fetch(`${API}/api/vendors/${vendorId}/transactions`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) setWalletHistory(data.data);
    } catch { /* silent */ }
  };

  // --- Create Invoice (no wallet credit) ---
  const handleCreateInvoice = async () => {
    if (!invoiceForm.date || !invoiceForm.number || !invoiceForm.amount || !invoiceForm.location) {
      setInvoiceError('All fields are required');
      return;
    }
    setInvoiceLoading(true);
    setInvoiceError('');

    try {
      const res = await fetch(`${API}/api/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          vendorId: selectedVendor._id,
          invoiceDate: invoiceForm.date,
          invoiceNumber: invoiceForm.number,
          invoiceAmount: invoiceForm.amount,
          location: invoiceForm.location,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setInvoiceError(data.message || 'Failed to create invoice'); return; }
      setCreatedInvoice(data.data);
    } catch {
      setInvoiceError('Server error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // --- OTP ---
  const handleSendOTP = () => {
    setRedeemError('');
    if (!redeemAmount || redeemAmt <= 0) { setRedeemError('Please enter a valid amount'); return; }
    if (isInsufficientBalance) return; // blocked by UI
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
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOTP = () => {
    if (otp.join('') === '888888') { setOtpVerified(true); setOtpError(''); }
    else setOtpError('Invalid OTP. Use 888888 for testing.');
  };

  // --- Submit: debit wallet ---
  const handleSubmit = async () => {
    if (!otpVerified) return;
    setSubmitLoading(true);

    try {
      const res = await fetch(`${API}/api/invoices/redeem`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          vendorId: selectedVendor._id,
          redeemAmount: redeemAmt,
          invoiceId: createdInvoice?._id || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRedeemError(data.message);
        return;
      }

      // Update wallet balance in UI
      setSelectedVendor(prev => ({ ...prev, walletBalance: data.data.newWalletBalance }));
      fetchWalletHistory(selectedVendor._id);
      setShowSuccessModal(true);
    } catch {
      setRedeemError('Server error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    setOtpSent(false);
    setOtpVerified(false);
    setRedeemAmount('');
    setOtp(['', '', '', '', '', '']);
    setRedeemError('');
    setCreatedInvoice(null);
    setInvoiceForm({ date: '', number: '', amount: '', location: '' });
  };

  return (
    <div className="p-8 md:p-10 relative">
      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 bg-[#00B65E] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-10 h-10 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Redemption Successful</h2>
            <p className="text-[15px] text-gray-600 mb-2">
              ₹{redeemAmt.toFixed(2)} redeemed from wallet.
            </p>
            <p className="text-[13px] text-gray-500 mb-8">
              New wallet balance: <span className="font-bold text-black">₹{Number(selectedVendor?.walletBalance).toFixed(2)}</span>
            </p>
            <button onClick={closeModal} className="bg-[#2B3B8A] hover:bg-[#1a2d6b] transition-colors text-white font-semibold w-full py-3.5 rounded-xl flex items-center justify-center gap-2">
              Done →
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h2 className="text-[15px] text-gray-700 mb-1">Welcome to Faith Trust Commitment - Incentive Management</h2>
        <h1 className="text-[28px] font-bold text-black mb-8 tracking-tight">Jodhpur Division</h1>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col">

          {/* ROW 1: Search + Vendor Info */}
          <div className="flex flex-col md:flex-row border-b border-gray-100 min-h-[220px]">
            <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col justify-center">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Create an Invoice</h3>
              <form onSubmit={handleSearch} className="space-y-2">
                <label className="block text-sm font-medium text-gray-800">Vendor Account Number / Mobile Number</label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter account number or mobile"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className={`font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-colors ${
                      searchQuery ? 'bg-[#2B3B8A] text-white hover:bg-[#1f2b66]' : 'bg-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    {searchLoading ? 'Searching...' : 'Submit →'}
                  </button>
                </div>
                {searchError && !selectedVendor && <p className="text-red-500 text-xs mt-1 opacity-0 h-0">.</p>}
              </form>
            </div>

            <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
              {selectedVendor && (
                <div className="flex flex-col xl:flex-row items-start justify-between gap-6">
                  <div className="space-y-2 text-[13px] text-gray-700 font-medium">
                    <p className="text-[16px] font-bold text-black">{selectedVendor.companyName}</p>
                    <p>{selectedVendor.personName}</p>
                    <p className="text-[#2B3B8A] font-bold">{selectedVendor.accountNumber}</p>
                    <p>{selectedVendor.mobileNumber}</p>
                    <p className="max-w-[250px]">{selectedVendor.address}</p>
                  </div>
                  <div className="bg-[#E4F8ED] p-5 rounded-2xl w-full xl:w-[260px] shrink-0">
                    <p className="text-[13px] text-gray-700 font-medium mb-1">Incentives Wallet</p>
                    <h2 className="text-[28px] font-bold text-black mb-3">₹{Number(walletBalance).toFixed(2)}</h2>
                    <div className="text-[11px] text-gray-600">
                      <p>Last Redemption</p>
                      <p>₹{selectedVendor.lastRedemptionAmount} | {selectedVendor.lastRedemptionDate ? new Date(selectedVendor.lastRedemptionDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor not found */}
              {searchError && !selectedVendor && (
                <div className="animate-in fade-in duration-300">
                  <h3 className="text-[18px] font-bold text-gray-900 mb-2">Account Not Found</h3>
                  <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
                    The Vendor Account Number or Mobile Number could not be found. You can create a new account to continue.
                  </p>
                  <Link
                    href="/branch/vendors/create"
                    className="inline-flex items-center gap-2 bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-[14px]"
                  >
                    Create An Account →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {selectedVendor && (
            <>
              {/* ROW 2: Invoice Form + Redemption */}
              <div className="flex flex-col md:flex-row border-b border-gray-100">

                {/* LEFT: Invoice Form */}
                <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Create an Invoice</h3>

                  {invoiceError && (
                    <div className="mb-4 p-3 bg-red-50 rounded-xl text-[13px] text-red-600">{invoiceError}</div>
                  )}

                  {createdInvoice && (
                    <div className="mb-4 p-3 bg-[#E4F8ED] rounded-xl text-[13px] text-green-800 font-medium">
                      ✓ Invoice created: <span className="font-bold">{createdInvoice.invoiceNumber}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={invoiceForm.date}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Number</label>
                      <input
                        type="text"
                        value={invoiceForm.number}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, number: e.target.value })}
                        placeholder="041234567890"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Invoice Amount (₹)</label>
                      <input
                        type="number"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                        placeholder="5680.00"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-800">Location/City</label>
                      <input
                        type="text"
                        value={invoiceForm.location}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, location: e.target.value })}
                        placeholder="Jodhpur"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCreateInvoice}
                    disabled={invoiceLoading}
                    className="bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white font-semibold px-8 py-2.5 rounded-xl self-start flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {invoiceLoading ? 'Creating...' : 'Create →'}
                  </button>

                  {/* Invoice Summary */}
                  <div className="border-t border-dashed border-gray-300 pt-6 mt-6 space-y-3 text-[13px]">
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Date</span>
                      <span className="text-gray-800">{invoiceForm.date || 'DD/MM/YYYY'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Number</span>
                      <span className="text-gray-800">{createdInvoice ? createdInvoice.invoiceNumber : '#0000'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Amount (₹)</span>
                      <span className="text-gray-800">{invoiceAmt > 0 ? `₹${invoiceAmt.toFixed(2)}` : '₹0.00'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Location/City</span>
                      <span className="text-gray-800">{invoiceForm.location || 'City Name'}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Redemption */}
                <div className="w-full md:w-1/2 p-8 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Incentives Wallet Redemption</h3>

                  <div className="space-y-1.5 mb-6">
                    <label className="text-[13px] font-medium text-gray-800">Redeem Incentives Wallet Amount (₹)</label>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        value={redeemAmount}
                        onChange={(e) => {
                          setRedeemAmount(e.target.value);
                          setRedeemError('');
                          setOtpSent(false);
                          setOtpVerified(false);
                        }}
                        placeholder="5680.00"
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 transition-colors ${
                          isInsufficientBalance ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#2B3B8A]'
                        }`}
                      />
                      <button
                        onClick={handleSendOTP}
                        disabled={isInsufficientBalance || !redeemAmount}
                        className={`font-semibold px-6 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2 transition-colors ${
                          isInsufficientBalance || !redeemAmount
                            ? 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                            : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
                        }`}
                      >
                        Send OTP →
                      </button>
                    </div>

                    {/* Insufficient balance warning */}
                    {isInsufficientBalance && (
                      <div className="flex items-center gap-2 mt-2 p-3 bg-[#FDEDEC] border border-[#E74C3C]/20 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#E74C3C] shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="text-[13px] text-[#E74C3C] font-semibold">
                          Insufficient Balance! Only ₹{walletBalance.toFixed(2)} available in wallet
                        </p>
                      </div>
                    )}

                    {redeemError && !isInsufficientBalance && (
                      <p className="text-red-500 text-xs mt-1">{redeemError}</p>
                    )}
                  </div>

                  {/* OTP Section */}
                  {otpSent && (
                    <div className="mb-6 animate-in fade-in duration-300">
                      <div className="border-t border-dashed border-gray-300 pt-6 mb-4"></div>
                      <p className="text-[13px] text-gray-800 font-medium mb-3">
                        Enter OTP sent to {selectedVendor.mobileNumber}
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
                              className="w-[50px] h-[52px] text-center text-lg font-medium border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white"
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleVerifyOTP}
                          className={`font-semibold px-6 py-3.5 rounded-xl whitespace-nowrap flex items-center gap-2 transition-colors ${
                            otpVerified ? 'bg-[#00B65E] text-white' : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
                          }`}
                        >
                          {otpVerified ? 'Verified ✓' : 'Verify OTP →'}
                        </button>
                      </div>
                      {otpError && <p className="text-red-500 text-xs mt-1">{otpError}</p>}
                    </div>
                  )}

                  {/* Live Calculation */}
                  <div className="border-t border-dashed border-gray-300 pt-6 mt-auto space-y-3 text-[13px]">
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Amount</span>
                      <span className="text-gray-800">₹{invoiceAmt.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Wallet Redemption</span>
                      <span className={`font-semibold ${redeemAmt > 0 && !isInsufficientBalance ? 'text-[#E74C3C]' : 'text-gray-800'}`}>
                        {redeemAmt > 0 && !isInsufficientBalance ? `-₹${redeemAmt.toFixed(2)}` : '₹0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-black text-[15px] border-t border-gray-200 pt-3">
                      <span>Pay Total Amount</span>
                      <span>₹{totalPayable.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="border-b border-gray-100 p-8 flex items-center justify-center bg-[#F8FAFC]">
                <button
                  onClick={handleSubmit}
                  disabled={!otpVerified || submitLoading}
                  className={`font-semibold px-10 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 ${
                    otpVerified && !submitLoading
                      ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md'
                      : 'bg-[#8492A6] text-white opacity-80 cursor-not-allowed'
                  }`}
                >
                  {submitLoading ? 'Processing...' : 'Submit →'}
                </button>
              </div>

              {/* Wallet History */}
              <div className="p-8">
                <h3 className="text-[22px] font-bold text-black mb-6">Incentives Wallet History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="pb-4 font-bold text-black">#</th>
                        <th className="pb-4 font-bold text-black">Date</th>
                        <th className="pb-4 font-bold text-black">Credited</th>
                        <th className="pb-4 font-bold text-black">Debited</th>
                        <th className="pb-4 font-bold text-black">Balance After</th>
                        <th className="pb-4 font-bold text-black">Invoice No</th>
                        <th className="pb-4 font-bold text-black">Location</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 font-medium">
                      {walletHistory.length > 0 ? walletHistory.map((row, i) => (
                        <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-4">{i + 1}</td>
                          <td className="py-4">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="py-4 text-[#2ECC71] font-semibold">
                            {row.type === 'credit' ? `+₹${row.amount}` : 'NA'}
                          </td>
                          <td className="py-4 text-[#E74C3C] font-semibold">
                            {row.type === 'debit' ? `-₹${row.amount}` : 'NA'}
                          </td>
                          <td className="py-4">₹{row.balanceAfter}</td>
                          <td className="py-4">{row.invoice?.invoiceNumber || 'N/A'}</td>
                          <td className="py-4">{row.location || 'N/A'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-gray-400">No transactions yet</td>
                        </tr>
                      )}
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
