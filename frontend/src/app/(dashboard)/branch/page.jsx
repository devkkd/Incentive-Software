'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  const [userBranch, setUserBranch] = useState(null);

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ date: '', number: '', amount: '', location: '', remark: '' });
  const [invoiceError, setInvoiceError] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [divisions, setDivisions] = useState([]);

  // Wallet history
  const [walletHistory, setWalletHistory] = useState([]);

  // Monthly sub-wallets
  const [monthlyWallets, setMonthlyWallets] = useState([]);
  const [monthlyWalletsLoaded, setMonthlyWalletsLoaded] = useState(false);
  // redemptionSplits: [{monthlyWalletId, label, available, amount}]
  const [redemptionSplits, setRedemptionSplits] = useState([]);
  const [walletSelectError, setWalletSelectError] = useState('');

  // Redemption
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const otpInputRefs = useRef([]);

  // OTP rate-limit state
  // otpUnlockAt: absolute timestamp (ms) when the 30-min cooldown ends — null = not blocked
  const [otpCount, setOtpCount] = useState(0);          // 0-3, synced from backend
  const [otpUnlockAt, setOtpUnlockAt] = useState(null); // ms epoch
  const [cooldownSecs, setCooldownSecs] = useState(0);  // live countdown seconds
  const cooldownRef = useRef(null);

  // Start / restart the live countdown timer
  const startCooldown = (unlockAtMs) => {
    setOtpUnlockAt(unlockAtMs);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((unlockAtMs - Date.now()) / 1000));
      setCooldownSecs(remaining);
      if (remaining === 0) {
        clearInterval(cooldownRef.current);
        setOtpUnlockAt(null);
        setOtpCount(0); // reset counter — new 30-min window starts
      }
    };
    tick(); // run immediately
    cooldownRef.current = setInterval(tick, 1000);
  };

  // Clean up interval on unmount
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const isOtpBlocked = otpUnlockAt !== null && cooldownSecs > 0;

  // Format seconds into mm:ss
  const formatCooldown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Live calculation: invoice amount - redeem amount = total payable
  const invoiceAmt = parseFloat(invoiceForm.amount) || 0;
  const redeemAmt = parseFloat(redeemAmount) || 0;
  const totalPayable = useMemo(() => Math.max(0, invoiceAmt - redeemAmt), [invoiceAmt, redeemAmt]);

  // Available (unhold) balance — sum of monthly wallet balances returned by backend
  // Backend already excludes held MonthlyWallets and held master Wallets from the list,
  // so this sum reflects only the amount the branch can actually redeem.
  const walletBalance = useMemo(() => {
    if (!selectedVendor) return 0;
    if (!monthlyWalletsLoaded) {
      // Still fetching — show vendor.walletBalance as placeholder
      return parseFloat(selectedVendor.walletBalance) || 0;
    }
    // Fetch complete: sum only the unhold wallets returned by backend
    return parseFloat(
      monthlyWallets.reduce((s, mw) => s + (parseFloat(mw.balance) || 0), 0).toFixed(2)
    );
  }, [selectedVendor, monthlyWallets, monthlyWalletsLoaded]);

  const isInsufficientBalance = redeemAmt > 0 && redeemAmt > walletBalance;
  const exceedsInvoiceAmount = redeemAmt > 0 && invoiceAmt > 0 && redeemAmt > invoiceAmt;

  // --- Search Vendor ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    setSelectedVendor(null);
    setCreatedInvoice(null);
    setWalletHistory([]);
    setMonthlyWallets([]);
    setMonthlyWalletsLoaded(false);
    setRedemptionSplits([]);
    setWalletSelectError('');
    setRedeemAmount('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCount(0);
    setOtpUnlockAt(null);
    setCooldownSecs(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);

    try {
      const res = await fetch(`${API}/api/vendors/search?q=${searchQuery}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setSearchError(data.message || 'Vendor not found'); return; }
      setSelectedVendor(data.data);
      fetchWalletHistory(data.data._id);
      fetchMonthlyWallets(data.data._id);
      
      // Auto-fill invoice form with today's date only — location comes from invoice prefix
      const today = new Date().toISOString().split('T')[0];
      setInvoiceForm(prev => ({
        ...prev,
        date: today,
        location: '',
      }));
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

  const fetchMonthlyWallets = async (vendorId) => {
    try {
      const res = await fetch(`${API}/api/incentives/monthly-wallets/${vendorId}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setMonthlyWallets(data.data || []);
        setMonthlyWalletsLoaded(true);
        // Reset splits when vendor changes
        setRedemptionSplits([]);
        setWalletSelectError('');
      }
    } catch { /* silent */ }
  };

  // Computed: total allocated in splits
  const totalSplitAmount = useMemo(
    () => parseFloat(redemptionSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2)),
    [redemptionSplits]
  );

  // Add or update a split for a monthly wallet, then auto-sync redeemAmount
  const handleSplitChange = (walletId, label, available, value) => {
    const amt = parseFloat(value) || 0;
    setRedemptionSplits(prev => {
      let updated;
      const existing = prev.find(r => r.monthlyWalletId === walletId);
      if (amt <= 0) {
        updated = prev.filter(r => r.monthlyWalletId !== walletId);
      } else if (existing) {
        updated = prev.map(r => r.monthlyWalletId === walletId ? { ...r, amount: amt } : r);
      } else {
        updated = [...prev, { monthlyWalletId: walletId, label, available, amount: amt }];
      }
      // Auto-sync total redeem amount from splits
      const newTotal = parseFloat(updated.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2));
      setRedeemAmount(newTotal > 0 ? String(newTotal) : '');
      setOtpSent(false);
      setOtpVerified(false);
      return updated;
    });
    setWalletSelectError('');
    setRedeemError('');
  };

  // "Use Full" — fill entire available balance of a wallet into its split
  const handleUseFullWallet = (mw) => {
    if (mw.balance <= 0) return;
    handleSplitChange(mw._id, mw.label, mw.balance, String(mw.balance));
  };

  // "Use All Wallets" — fill all non-zero wallets to max, capped at invoice amount if set
  const handleUseAllWallets = () => {
    const cap = invoiceAmt > 0 ? invoiceAmt : Infinity;
    let remaining = cap;
    const splits = [];
    const sorted = [...monthlyWallets].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    for (const mw of sorted) {
      if (mw.balance <= 0 || remaining <= 0) continue;
      const use = parseFloat(Math.min(mw.balance, remaining).toFixed(2));
      splits.push({ monthlyWalletId: mw._id, label: mw.label, available: mw.balance, amount: use });
      remaining = parseFloat((remaining - use).toFixed(2));
    }
    setRedemptionSplits(splits);
    const newTotal = parseFloat(splits.reduce((s, r) => s + r.amount, 0).toFixed(2));
    setRedeemAmount(newTotal > 0 ? String(newTotal) : '');
    setOtpSent(false);
    setOtpVerified(false);
    setWalletSelectError('');
    setRedeemError('');
  };

  // Clear all splits
  const handleClearSplits = () => {
    setRedemptionSplits([]);
    setRedeemAmount('');
    setOtpSent(false);
    setOtpVerified(false);
    setWalletSelectError('');
    setRedeemError('');
  };

  // --- Invoice creation moved to handleSubmit ---

  // --- OTP ---
  const handleSendOTP = async () => {
    setRedeemError('');
    setInvoiceError('');
    // If splits are selected, auto-sync redeemAmount from splits
    if (redemptionSplits.length > 0 && totalSplitAmount > 0 && redeemAmt !== totalSplitAmount) {
      setRedeemAmount(String(totalSplitAmount));
    }
    const effectiveRedeem = redemptionSplits.length > 0 ? totalSplitAmount : redeemAmt;
    if (!effectiveRedeem || effectiveRedeem <= 0) { setRedeemError('Please select wallet(s) or enter a valid amount'); return; }
    if (!invoiceAmt || invoiceAmt <= 0) { setRedeemError('Enter invoice amount before redeeming wallet'); return; }
    if (!isValidInvoiceNumber(invoiceForm.number)) {
      setInvoiceError('Invoice number must be in format 1/RS/26001200 or 5/CSI/15001623');
      return;
    }
    if (effectiveRedeem > invoiceAmt) { setRedeemError('Wallet redemption amount cannot exceed invoice amount'); return; }
    if (effectiveRedeem > walletBalance) return;

    setSubmitLoading(true);
    try {
      const res = await fetch(`${API}/api/invoices/redeem/send-otp`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ vendorId: selectedVendor._id, redeemAmount: effectiveRedeem, invoiceAmount: invoiceAmt }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          const unlockAt = Date.now() + (data.retryAfterSeconds || 1800) * 1000;
          startCooldown(unlockAt);
          setOtpCount(3);
          setRedeemError('');
        } else {
          setRedeemError(data.message || 'Failed to send OTP');
        }
        return;
      }
      setOtpCount(data.otpCount ?? (otpCount + 1));
      setOtpSent(true);
      setOtpVerified(false);
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
    } catch { setRedeemError('Server error. Please try again.'); }
    finally { setSubmitLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
    // Auto-mark ready when all 6 digits filled
    const filled = newOtp.join('');
    if (filled.length === 6 && !newOtp.includes('')) {
      setOtpVerified(true);
      setOtpError('');
    } else {
      setOtpVerified(false);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOTP = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) { setOtpError('Please enter all 6 digits'); return; }
    setOtpVerified(true);
    setOtpError('');
  };

  // --- Submit: Create invoice and debit wallet ---
  const handleSubmit = async () => {
    // 1. Validate Invoice Form (required)
    if (!invoiceForm.date || !invoiceForm.number || !invoiceForm.amount) {
      setInvoiceError('Invoice date, number and amount are required to submit.');
      return;
    }
    if (!isValidInvoiceNumber(invoiceForm.number)) {
      setInvoiceError('Invoice number must be in format 1/RS/26001200 or 5/CSI/15001623');
      return;
    }

    // 2. Wallet redemption must be present and verified before invoice creation
    if (redeemAmt <= 0) {
      setRedeemError('Please enter an incentives wallet redemption amount to create the invoice');
      return;
    }

    // Validate splits cover redeemAmt
    if (redemptionSplits.length > 0) {
      const splitsTotal = parseFloat(redemptionSplits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2));
      if (Math.abs(splitsTotal - redeemAmt) > 0.01) {
        setWalletSelectError(`Split total (₹${splitsTotal}) must equal redeem amount (₹${redeemAmt})`);
        return;
      }
      // Check each split doesn't exceed available
      for (const r of redemptionSplits) {
        if (parseFloat(r.amount) > parseFloat(r.available)) {
          setWalletSelectError(`Amount for ${r.label} exceeds available balance ₹${r.available}`);
          return;
        }
      }
    }

    if (exceedsInvoiceAmount) {
      setRedeemError('Wallet redemption amount cannot exceed invoice amount');
      return;
    }

    if (!otpVerified) {
      setOtpError('Please verify OTP before submitting');
      return;
    }

    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) { setOtpError('Please enter all 6 digits'); return; }

    setSubmitLoading(true);
    setInvoiceError('');
    setRedeemError('');

    try {
      const invoicePayload = {
        vendorId: selectedVendor._id,
        invoiceDate: invoiceForm.date,
        invoiceNumber: invoiceForm.number,
        invoiceAmount: invoiceForm.amount,
        location: invoiceForm.location,
        remark: invoiceForm.remark || '',
      };

      if (redeemAmt > 0) {
        invoicePayload.redeemAmount = redeemAmt;
        invoicePayload.otp = otp.join('');
        if (redemptionSplits.length > 0) {
          invoicePayload.redemptions = redemptionSplits.map(r => ({
            monthlyWalletId: r.monthlyWalletId,
            amount: parseFloat(r.amount),
          }));
        }
      }

      const invRes = await fetch(`${API}/api/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify(invoicePayload),
      });
      const invData = await invRes.json();
      if (!invRes.ok) {
        // 429 = rate limit (invoice or OTP limit)
        if (invRes.status === 429) {
          setInvoiceError(invData.message || 'Limit reached. Please try again later.');
          setOtpVerified(false);
          setOtp(['', '', '', '', '', '']);
        } else if (redeemAmt > 0) {
          setRedeemError(invData.message || 'Failed to redeem wallet');
          setOtpVerified(false);
          setOtp(['', '', '', '', '', '']);
        } else {
          setInvoiceError(invData.message || 'Failed to create invoice');
        }
        setSubmitLoading(false);
        return;
      }

      setCreatedInvoice(invData.data.invoice || invData.data);
      if (invData.data.newWalletBalance !== undefined) {
        setSelectedVendor(prev => ({ ...prev, walletBalance: invData.data.newWalletBalance }));
      }

      fetchWalletHistory(selectedVendor._id);
      setShowSuccessModal(true);
    } catch {
      setInvoiceError('Server error during submission');
    } finally {
      setSubmitLoading(false);
    }
  };

  useEffect(() => {
    const loadBranchAndDivisions = async () => {
      try {
        // Load user's branch info
        const userRes = await fetch(`${API}/api/auth/me`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const userData = await userRes.json();
        if (userRes.ok && userData.data?.division) {
          setUserBranch(userData.data.division);
        }

        // Load divisions
        const divRes = await fetch(`${API}/api/divisions`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const divData = await divRes.json();
        if (divRes.ok) {
          const divList = divData.data || [];
          setDivisions(divList);

          // Re-compute location if invoice number already entered but divisions weren't loaded yet
          setInvoiceForm(prev => {
            if (!prev.number) return prev;
            const prefixMatch = String(prev.number).trim().match(/^([^/]+)\//);
            if (!prefixMatch) return prev;
            const prefix = prefixMatch[1].trim();
            const matched = divList.find(d => d.locationCode === prefix);
            return { ...prev, location: matched?.location || prev.location };
          });
        }
      } catch {
        setDivisions([]);
      }
    };
    loadBranchAndDivisions();
  }, []);

  const getLocationFromInvoicePrefix = (invoiceNumber) => {
    const prefixMatch = String(invoiceNumber || '').trim().match(/^([^/]+)\//);
    if (!prefixMatch) return null;
    const prefix = prefixMatch[1].trim();
    const division = divisions.find((div) => div.locationCode === prefix);
    return division?.location || null;
  };

  const isValidInvoiceNumber = (invoiceNumber) => {
    const invoiceRegex = /^\d+\/(?:RS|CSI)\/(?:\d{8})$/i;
    return invoiceRegex.test(String(invoiceNumber || '').trim());
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    setOtpSent(false);
    setOtpVerified(false);
    setRedeemAmount('');
    setOtp(['', '', '', '', '', '']);
    setRedeemError('');
    setCreatedInvoice(null);
    setOtpCount(0);
    setOtpUnlockAt(null);
    setCooldownSecs(0);
    setRedemptionSplits([]);
    setWalletSelectError('');
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setInvoiceForm({ date: '', number: '', amount: '', location: '', remark: '' });
    // Refresh monthly wallets to show updated balances
    if (selectedVendor) {
      setMonthlyWalletsLoaded(false);
      fetchMonthlyWallets(selectedVendor._id);
    }
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Success!</h2>
            <p className="text-[15px] text-gray-600 mb-2">
              Invoice has been created successfully.
            </p>
            {createdInvoice?.referenceNo && (
              <p className="text-[15px] text-gray-800 font-semibold mb-2">
                Reference No: <span className="text-[#2B3B8A] select-all font-mono font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{createdInvoice.referenceNo}</span>
              </p>
            )}
            {redeemAmt > 0 && (
              <p className="text-[15px] text-gray-600 mb-2">
                ₹{redeemAmt.toFixed(2)} redeemed from wallet.
              </p>
            )}
            {redeemAmt > 0 && (
              <p className="text-[15px] font-bold text-[#E74C3C] mb-3">
                Due Amount: ₹{(invoiceAmt - redeemAmt).toFixed(2)}
              </p>
            )}
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
        <h2 className="text-[15px] text-gray-700 mb-8">Welcome to Friends Trading Corporation - Incentive Management</h2>
       

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col">

          {/* ROW 1: Search + Vendor Info */}
          <div className="flex flex-col md:flex-row border-b border-gray-100 min-h-[220px]">
            <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col justify-center">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Create an Invoice</h3>
              <form onSubmit={handleSearch} className="space-y-2">
                <label className="block text-sm font-medium text-gray-800">Party Code / Mobile Number</label>
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
                    <p>{selectedVendor.partyType || '—'}</p>
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
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    The Party Code or Mobile Number could not be found. Please contact your administrator to register a new vendor.
                  </p>
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
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-2.5 bg-gray-100 rounded-xl border border-gray-200 text-sm font-mono font-bold text-gray-700">
                          {userBranch?.locationCode || '—'}/
                        </span>
                        <input
                          type="text"
                          value={invoiceForm.number.startsWith(userBranch?.locationCode ? `${userBranch.locationCode}/` : '') ? invoiceForm.number.substring((userBranch?.locationCode?.length || 0) + 1) : invoiceForm.number}
                          onChange={(e) => {
                            const input = e.target.value.toUpperCase();
                            const prefixedNo = userBranch?.locationCode ? `${userBranch.locationCode}/${input}` : input;
                            const invoiceLocation = getLocationFromInvoicePrefix(prefixedNo);
                            setInvoiceForm({
                              ...invoiceForm,
                              number: prefixedNo,
                              location: invoiceLocation || '',
                            });
                          }}
                          placeholder="RS/26001200"
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                        />
                      </div>
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
                      <label className="text-[13px] font-medium text-gray-800">
                        Location/City
                        <span className="ml-1 text-[11px] text-gray-400 font-normal">(auto)</span>
                      </label>
                      <input
                        type="text"
                        value={invoiceForm.location}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, location: e.target.value })}
                        placeholder="Auto-filled from invoice prefix"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A] bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Remark field — full width below grid */}
                  <div className="space-y-1.5 mt-4">
                    <label className="text-[13px] font-medium text-gray-800">Remark</label>
                    <input
                      type="text"
                      value={invoiceForm.remark}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, remark: e.target.value })}
                      placeholder="Optional remark for this invoice"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B3B8A]"
                    />
                  </div>

                  {/* Invoice Summary */}
                  <div className="border-t border-dashed border-gray-300 pt-6 mt-6 space-y-3 text-[13px]">
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Date</span>
                      <span className="text-gray-800">{invoiceForm.date || 'DD/MM/YYYY'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Number</span>
                      <span className="text-gray-800 font-mono">{invoiceForm.number || `${userBranch?.locationCode || '—'}/####`}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Invoice Amount (₹)</span>
                      <span className="text-gray-800">{invoiceAmt > 0 ? `₹${invoiceAmt.toFixed(2)}` : '₹0.00'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Location/City</span>
                      <span className="text-gray-800">{invoiceForm.location || 'City Name'}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>Remark</span>
                      <span className="text-gray-800 text-right max-w-[180px] truncate">{invoiceForm.remark || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Redemption */}
                <div className="w-full md:w-1/2 p-8 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Incentives Wallet Redemption</h3>

                  {/* ── Monthly Sub-Wallet Selector ───────────────────────── */}
                  {monthlyWallets.filter(mw => mw.balance > 0).length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[13px] font-semibold text-gray-700">
                          Incentive Wallets
                          <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                            ({monthlyWallets.filter(w => w.balance > 0).length} with balance)
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleUseAllWallets}
                            disabled={!monthlyWallets.some(w => w.balance > 0)}
                            className="text-[11px] font-semibold text-[#2B3B8A] bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#2B3B8A]/20 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Use All →
                          </button>
                          {redemptionSplits.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearSplits}
                              className="text-[11px] font-semibold text-gray-500 hover:text-red-500 bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {monthlyWallets.filter(mw => mw.balance > 0).map((mw) => {
                          const split = redemptionSplits.find(r => r.monthlyWalletId === mw._id);
                          const splitAmt = split?.amount ?? '';
                          const isSelected = !!split && parseFloat(split.amount) > 0;
                          return (
                            <div key={mw._id}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                isSelected
                                    ? 'bg-[#EEF2FF] border-[#2B3B8A]/30 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}>
                              {/* Checkbox indicator */}
                              <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                                isSelected ? 'bg-[#2B3B8A] border-[#2B3B8A]' : 'border-gray-300'
                              }`}>
                                {isSelected && (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              {/* Month label + available */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] font-semibold leading-tight ${isSelected ? 'text-[#2B3B8A]' : 'text-gray-800'}`}>
                                  {mw.label}
                                </p>
                                <p className="text-[11px] font-medium text-[#16a34a]">
                                  Available: ₹{Number(mw.balance).toFixed(2)}
                                </p>
                              </div>
                              {/* "Use Full" quick-fill button */}
                              {!isSelected && (
                                <button
                                  type="button"
                                  onClick={() => handleUseFullWallet(mw)}
                                  className="text-[10px] font-semibold text-gray-500 hover:text-[#2B3B8A] bg-gray-100 hover:bg-[#EEF2FF] px-2 py-1 rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  Use Full
                                </button>
                              )}
                              {/* Amount input */}
                              <div className="w-[100px] shrink-0">
                                <input
                                  type="number"
                                  value={splitAmt}
                                  onChange={(e) => handleSplitChange(mw._id, mw.label, mw.balance, e.target.value)}
                                  placeholder="0.00"
                                  min="0"
                                  max={mw.balance}
                                  step="0.01"
                                  className={`w-full px-3 py-1.5 rounded-lg border text-sm text-right focus:outline-none focus:ring-1 transition-colors ${
                                    parseFloat(splitAmt) > mw.balance
                                      ? 'border-red-400 bg-red-50 focus:ring-red-400'
                                      : isSelected
                                        ? 'border-[#2B3B8A]/40 bg-white focus:ring-[#2B3B8A]'
                                        : 'border-gray-200 focus:ring-[#2B3B8A]'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Split summary bar */}
                      {redemptionSplits.length > 0 && (
                        <div className={`mt-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold flex items-center justify-between ${
                          invoiceAmt > 0 && totalSplitAmount > invoiceAmt
                            ? 'bg-[#FDEDEC] text-[#E74C3C]'
                            : 'bg-[#EEF2FF] text-[#2B3B8A]'
                        }`}>
                          <span>{redemptionSplits.length} wallet{redemptionSplits.length > 1 ? 's' : ''} selected</span>
                          <span className="font-mono">Total: ₹{totalSplitAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {walletSelectError && (
                        <p className="text-[12px] text-red-500 mt-1">{walletSelectError}</p>
                      )}
                    </div>
                  )}

                  {monthlyWallets.filter(mw => mw.balance > 0).length === 0 && (
                    <div className="mb-5 p-3 bg-[#FEF9C3] border border-yellow-200 rounded-xl">
                      <p className="text-[12px] text-yellow-700 font-medium">No incentive months found. Upload incentives first.</p>
                    </div>
                  )}

                  <div className="space-y-1.5 mb-6">
                    <div className="flex items-center justify-between">
                      <label className="text-[13px] font-medium text-gray-800">
                        Total Redeem Amount (₹)
                        {redemptionSplits.length > 0 && (
                          <span className="ml-1.5 text-[11px] font-normal text-[#2B3B8A]">(auto from wallets)</span>
                        )}
                      </label>
                      {/* OTP attempt counter — dots */}
                      {otpCount > 0 && !isOtpBlocked && (
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                i <= otpCount ? 'bg-orange-400' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                          <span className="text-[11px] text-orange-500 font-semibold ml-1">
                            {otpCount}/3 used
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        value={redeemAmount}
                        onChange={(e) => {
                          if (redemptionSplits.length > 0) return; // auto-mode: ignore manual changes
                          setRedeemAmount(e.target.value);
                          setRedeemError('');
                          setOtpSent(false);
                          setOtpVerified(false);
                        }}
                        readOnly={redemptionSplits.length > 0}
                        placeholder={redemptionSplits.length > 0 ? 'Auto from wallets above' : '5680.00'}
                        disabled={isOtpBlocked}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 transition-colors ${
                          isInsufficientBalance
                            ? 'border-red-400 focus:ring-red-400'
                            : redemptionSplits.length > 0
                              ? 'border-[#2B3B8A]/30 bg-[#EEF2FF] text-[#2B3B8A] font-semibold focus:ring-[#2B3B8A]'
                              : 'border-gray-200 focus:ring-[#2B3B8A]'
                        } ${isOtpBlocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                      />
                      <button
                        onClick={handleSendOTP}
                        disabled={isOtpBlocked || isInsufficientBalance || !redeemAmount || !invoiceAmt || exceedsInvoiceAmount || submitLoading}
                        className={`font-semibold px-6 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2 transition-colors ${
                          isOtpBlocked || isInsufficientBalance || !redeemAmount || !invoiceAmt || exceedsInvoiceAmount || submitLoading
                            ? 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                            : 'bg-[#2B3B8A] hover:bg-[#1a2d6b] text-white'
                        }`}
                      >
                        {submitLoading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Sending...
                          </span>
                        ) : isOtpBlocked ? (
                          'Blocked'
                        ) : otpSent ? (
                          'Resend OTP'
                        ) : (
                          'Send OTP →'
                        )}
                      </button>
                    </div>

                    {/* ── Cooldown banner ────────────────────────────────────── */}
                    {isOtpBlocked && (
                      <div className="flex items-start gap-3 mt-3 p-4 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in duration-300">
                        {/* Clock icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-9 h-9 text-orange-400 shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-[13px] font-bold text-orange-700">OTP Limit Reached</p>
                          <p className="text-[12px] text-orange-600 mt-0.5 leading-relaxed">
                            3 OTPs sent for this party. Please wait for the cooldown to complete before sending more.
                          </p>
                          {/* Live countdown */}
                          <div className="mt-3 inline-flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-3 py-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-orange-500">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[13px] font-mono font-bold text-orange-600 tabular-nums">
                              {formatCooldown(cooldownSecs)}
                            </span>
                            <span className="text-[11px] text-orange-400">remaining</span>
                          </div>
                        </div>
                      </div>
                    )}

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
                        Enter OTP sent to <span className="font-bold text-[#2B3B8A]">{selectedVendor.mobileNumber}</span>
                        {exceedsInvoiceAmount && (
                          <span className="block text-red-500 text-xs mt-2">Wallet redemption amount cannot exceed invoice amount.</span>
                        )}
                      </p>
                      <div className="flex gap-3 mb-3">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => (otpInputRefs.current[index] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            className={`w-[50px] h-[52px] text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white transition-colors ${
                              otpVerified ? 'border-[#00B65E] text-[#00B65E]' : digit ? 'border-[#2B3B8A]' : 'border-gray-200'
                            }`}
                          />
                        ))}
                        {otpVerified && (
                          <div className="flex items-center gap-1 text-[#00B65E] font-semibold text-[13px] ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Ready
                          </div>
                        )}
                      </div>
                      {otpError && (
                        <div className={`text-xs mt-2 p-3 rounded-xl font-bold flex items-center gap-2 ${
                          otpError.startsWith('🔧') 
                            ? 'bg-yellow-50 border-2 border-yellow-400 text-yellow-900' 
                            : 'bg-red-50 border border-red-200 text-red-600'
                        }`}>
                          {otpError.startsWith('🔧') && (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                          )}
                          {otpError}
                        </div>
                      )}
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
                {isOtpBlocked ? (
                  <div className="flex flex-col items-center gap-2">
                    <button disabled className="font-semibold px-10 py-3 rounded-xl bg-[#CBD5E1] text-[#64748B] cursor-not-allowed">
                      Submit →
                    </button>
                    <p className="text-[12px] text-orange-500 font-semibold tabular-nums">
                      Available in {formatCooldown(cooldownSecs)}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitLoading || redeemAmt <= 0 || !otpVerified}
                    className={`font-semibold px-10 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 ${
                      redeemAmt > 0 && otpVerified && !submitLoading
                        ? 'bg-[#2B3B8A] text-white hover:bg-[#1a2d6b] shadow-md'
                        : 'bg-[#8492A6] text-white opacity-80 cursor-not-allowed'
                    }`}
                  >
                    {submitLoading ? 'Processing...' : 'Submit →'}
                  </button>
                )}
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
                        <th className="pb-4 font-bold text-black">Invoice No</th>
                        <th className="pb-4 font-bold text-black">Reference No</th>
                        <th className="pb-4 font-bold text-black">Invoice Amount</th>
                        <th className="pb-4 font-bold text-black">Amount Redeemed</th>
                        <th className="pb-4 font-bold text-black">Credited</th>
                        <th className="pb-4 font-bold text-black">Wallet Month</th>
                        <th className="pb-4 font-bold text-black">Balance After</th>
                        <th className="pb-4 font-bold text-black">Location</th>
                        <th className="pb-4 font-bold text-black">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 font-medium">
                      {walletHistory.length > 0 ? walletHistory.map((row, i) => (
                        <tr key={row._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-4">{i + 1}</td>
                          <td className="py-4">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="py-4 font-semibold text-[#2B3B8A]">{row.invoice?.invoiceNumber || '—'}</td>
                          <td className="py-4 font-mono font-medium text-gray-800">{row.invoice?.referenceNo || '—'}</td>
                          <td className="py-4">
                            {row.invoice?.invoiceAmount != null
                              ? `₹${Number(row.invoice.invoiceAmount).toFixed(2)}`
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-4 font-semibold text-[#E74C3C]">
                            {row.type === 'debit' ? `-₹${Number(row.amount).toFixed(2)}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-4 font-semibold text-[#2ECC71]">
                            {row.type === 'credit' ? `+₹${Number(row.amount).toFixed(2)}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-4">
                            {row.walletLabel ? (
                              <span className="inline-flex items-center bg-[#EEF2FF] text-[#2B3B8A] text-[11px] font-semibold px-2 py-0.5 rounded-md border border-[#2B3B8A]/10 whitespace-nowrap">
                                {row.walletLabel}
                              </span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-4 font-semibold">₹{Number(row.balanceAfter).toFixed(2)}</td>
                          <td className="py-4">{row.invoice?.location || '—'}</td>
                          <td className="py-4 max-w-[160px] truncate text-gray-500">{row.invoice?.remark || <span className="text-gray-300">—</span>}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="11" className="py-8 text-center text-gray-400">No transactions yet</td>
                        </tr>
                      )}
                    </tbody>
                    {/* Totals footer */}
                    {walletHistory.length > 0 && (() => {
                      const totalInvoice = walletHistory.reduce((s, r) => s + (r.invoice?.invoiceAmount || 0), 0);
                      const totalRedeemed = walletHistory.filter(r => r.type === 'debit').reduce((s, r) => s + (r.amount || 0), 0);
                      const totalCredited = walletHistory.filter(r => r.type === 'credit').reduce((s, r) => s + (r.amount || 0), 0);
                      return (
                        <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-bold text-[13px]">
                          <tr>
                            <td colSpan="4" className="py-3 text-gray-600">Total ({walletHistory.length} entries)</td>
                            <td className="py-3">₹{totalInvoice.toFixed(2)}</td>
                            <td className="py-3 text-[#E74C3C]">-₹{totalRedeemed.toFixed(2)}</td>
                            <td className="py-3 text-[#2ECC71]">+₹{totalCredited.toFixed(2)}</td>
                            <td className="py-3" />
                            <td className="py-3" />
                            <td className="py-3" />
                            <td className="py-3" />
                          </tr>
                        </tfoot>
                      );
                    })()}
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