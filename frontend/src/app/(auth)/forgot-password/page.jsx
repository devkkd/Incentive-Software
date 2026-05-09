'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const StepIndicator = ({ currentStep }) => {
  const steps = [1, 2, 3];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] transition-all shrink-0 ${
            currentStep > step
              ? 'bg-[#E4F8ED] border-2 border-[#2ECC71]'
              : currentStep === step
              ? 'bg-[#2B3B8A] text-white'
              : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
          }`}>
            {currentStep > step ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#2ECC71]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : step}
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-[2px] mx-1 transition-all ${currentStep > step ? 'bg-[#2ECC71]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLang();
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    const score = [/[A-Z]/.test(pwd), /\d/.test(pwd), /[@#!$%^&*]/.test(pwd), pwd.length >= 8].filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: 'text-[#E74C3C]' };
    if (score === 3) return { label: 'Medium', color: 'text-[#F39C12]' };
    return { label: 'Strong - good to go.', color: 'text-[#2ECC71]' };
  };

  const startCountdown = () => {
    setCountdown(45);
    const interval = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email.trim()) { setError('Email address is required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/settings/forgot-password/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setSentEmail(data.email); setStep(2); setAttemptsLeft(3);
      setOtp(['', '', '', '', '', '']); setOtpError(''); setOtpInvalid(false); startCountdown();
    } catch { setError('Server error. Is the backend running?'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    setLoading(true); setOtpError(''); setOtpInvalid(false);
    setOtp(['', '', '', '', '', '']); setAttemptsLeft(3);
    try {
      const res = await fetch(`${API}/api/settings/forgot-password/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentEmail }),
      });
      const data = await res.json();
      if (res.ok) startCountdown(); else setOtpError(data.message);
    } catch { setOtpError('Server error'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp]; newOtp[index] = value.substring(value.length - 1); setOtp(newOtp);
    setOtpInvalid(false);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) { setOtpError('Enter all 6 digits'); return; }
    setLoading(true); setOtpError(''); setOtpInvalid(false);
    try {
      const res = await fetch(`${API}/api/settings/forgot-password/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentEmail, otp: enteredOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        const remaining = attemptsLeft - 1; setAttemptsLeft(remaining); setOtpInvalid(true);
        setOtpError(remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before this code is cancelled.` : 'Too many attempts. Please request a new code.');
        if (remaining === 0) setOtp(['', '', '', '', '', '']);
        return;
      }
      setVerifiedOtp(enteredOtp); setStep(3);
    } catch { setOtpError('Server error'); }
    finally { setLoading(false); }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters long'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/settings/forgot-password/reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentEmail, otp: verifiedOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setStep(4);
    } catch { setError('Server error'); }
    finally { setLoading(false); }
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword && newPassword === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D6E8FB] p-4 font-sans">
      <div className="bg-white rounded-4xl p-8 sm:p-10 w-full text-gray-900 max-w-[480px] shadow-lg">

        <div className="flex items-center gap-1 mb-6">
          <Image src="/images/logo/logo.svg" alt="FTC Logo" width={80} height={40} className="object-contain" />
          <Image src="/images/logo/logoname.png" alt="Friends Trading Corporation" width={160} height={36} className="object-contain" />
        </div>

        {step < 4 && <StepIndicator currentStep={step} />}

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h1 className="text-[22px] font-bold text-gray-900 mb-2 tracking-tight">{t('resetPassword')}</h1>
            <p className="text-[13px] text-gray-600 mb-6 leading-relaxed">{t('resetPasswordHint')}</p>
            {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">{t('email')}</label>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="your@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] focus:border-transparent transition-colors placeholder:text-gray-400 text-sm" />
                <p className="text-xs text-gray-400">{t('enterEmailLinked')}</p>
              </div>
              <button type="submit" disabled={loading || !email}
                className={`w-[80%] mx-auto block font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  email && !loading ? 'bg-[#2B3B8A] hover:bg-[#1f2b66] text-white' : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                }`}>
                {loading ? t('sending') : t('sendVerificationCode')}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link href="/" className="text-[13px] font-bold text-[#2B3B8A] hover:underline">{t('backToSignIn')}</Link>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <h1 className="text-[22px] font-bold text-gray-900 mb-2 tracking-tight">{t('enterSixDigitCodeTitle')}</h1>
            <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
              {t('sentVerificationTo')} <span className="font-semibold text-black">{sentEmail}</span>.<br />
              {t('enterBelowContinue')}
            </p>
            {otpInvalid && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-[12px] text-red-700">{t('incorrectExpired')}</p>
              </div>
            )}
            <div className="flex gap-2 mb-2">
              {otp.map((digit, index) => (
                <input key={index} ref={(el) => (otpInputRefs.current[index] = el)}
                  type="text" maxLength={1} value={digit} placeholder="-"
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`w-full aspect-square max-w-[52px] text-center text-lg font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] bg-white placeholder:text-gray-300 border transition-colors ${otpInvalid ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
              ))}
            </div>
            {otpError && <p className="text-[12px] text-red-500 mb-3">{otpError}</p>}
            <p className="text-[12px] text-gray-400 mb-5">{t('enterAllSixDigits')}</p>
            <button onClick={handleVerifyOtp} disabled={loading || otp.join('').length < 6 || attemptsLeft === 0}
              className={`w-[80%] mx-auto block font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                otp.join('').length === 6 && !loading && attemptsLeft > 0 ? 'bg-[#2B3B8A] hover:bg-[#1f2b66] text-white' : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
              }`}>
              {loading ? t('verifying2') : otpInvalid ? t('tryAgainBtn') : t('verifyCode')}
            </button>
            <div className="mt-5 text-center text-[13px] text-gray-600">
              {t('didntReceiveCode2')}{' '}
              {countdown > 0
                ? <span className="text-[#2B3B8A] font-semibold">{t('resendCode')} <span className="text-gray-500 font-normal">(available in {countdown} sec)</span></span>
                : <button onClick={handleResendOtp} className="text-[#2B3B8A] font-bold hover:underline">{t('resendCodeNow2')}</button>}
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h1 className="text-[22px] font-bold text-gray-900 mb-2 tracking-tight">{t('createNewPassword')}</h1>
            <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
              Choose a strong password you haven&apos;t used before.<br />You&apos;ll use this to sign in from now on.
            </p>
            {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">{t('newPasswordField')}</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    placeholder={t('enterYourPassword')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] text-sm" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      {showNew ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                    </svg>
                  </button>
                </div>
                {strength && <p className={`text-[12px] font-medium ${strength.color}`}>{strength.label}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-800">{t('confirmNewPasswordField')}</label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder={t('enterYourPassword')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2B3B8A] text-sm" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      {showConfirm ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                    </svg>
                  </button>
                </div>
                {passwordsMatch && <p className="text-[12px] font-medium text-[#2ECC71]">{t('passwordsMatch')}</p>}
              </div>
              <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-3 flex gap-2 items-start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[#2B3B8A] shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-[12px] text-gray-700 leading-relaxed"><span className="font-bold text-gray-900">{t('passwordMust')}</span><br />{t('passwordRules')}</p>
              </div>
              <button type="submit" disabled={loading || !newPassword || newPassword !== confirmPassword}
                className={`w-[80%] mx-auto block font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  !loading && newPassword && newPassword === confirmPassword ? 'bg-[#2B3B8A] hover:bg-[#1f2b66] text-white' : 'bg-[#CBD5E1] text-[#64748B] cursor-not-allowed'
                }`}>
                {loading ? t('setting') : t('setNewPassword')}
              </button>
            </form>
          </>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 bg-[#E4F8ED] rounded-full flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10 text-[#2ECC71]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-gray-900 mb-2">{t('passwordReset')}</h1>
            <p className="text-[13px] text-gray-600 mb-6 leading-relaxed">
              Your password has been successfully reset.<br />You can now sign in with your new password.
            </p>
            <button onClick={() => router.push('/')}
              className="w-[80%] bg-[#2B3B8A] hover:bg-[#1f2b66] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              {t('signInBtn')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
