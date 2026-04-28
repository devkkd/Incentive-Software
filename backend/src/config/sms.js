/**
 * SMS Service — FTC Incentive Management
 *
 * SMS_PROVIDER=msg91   → MSG91 OTP API (production)
 * SMS_PROVIDER=        → Dev mode, OTP shown on screen
 */

// ─── MSG91 OTP API ────────────────────────────────────────────────────────────
const _sendMsg91Otp = async (mobileNumber, otp) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  // MSG91 Send OTP API v5
  const response = await fetch('https://api.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'authkey': authKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: `91${mobileNumber}`,
      otp,
    }),
  });

  const data = await response.json();
  console.log('[MSG91 OTP Response]', JSON.stringify(data));

  if (data.type === 'error') {
    throw new Error(`MSG91 error: ${data.message}`);
  }

  return { success: true };
};

// ─── MSG91 Transactional SMS ──────────────────────────────────────────────────
const _sendMsg91Sms = async (mobileNumber, message) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'FTCIND';
  const templateId = process.env.MSG91_CONFIRM_TEMPLATE_ID;

  const params = new URLSearchParams({
    authkey: authKey,
    mobiles: `91${mobileNumber}`,
    message,
    sender: senderId,
    route: '4',
    country: '91',
    ...(templateId ? { DLT_TE_ID: templateId } : {}),
  });

  const response = await fetch(
    `https://api.msg91.com/api/sendhttp.php?${params.toString()}`,
    { method: 'GET' }
  );

  const text = await response.text();
  console.log('[MSG91 SMS Response]', text);

  if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
    throw new Error(`MSG91 SMS error: ${text}`);
  }

  return { success: true };
};

// ─── Dev logger ───────────────────────────────────────────────────────────────
const _logDev = (mobileNumber, type, extra) => {
  console.log('\n' + '━'.repeat(50));
  console.log(`[SMS DEV] Type : ${type}`);
  console.log(`[SMS DEV] To   : ${mobileNumber}`);
  console.log(`[SMS DEV] Data : ${extra}`);
  console.log('━'.repeat(50) + '\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send OTP SMS
// ─────────────────────────────────────────────────────────────────────────────
const sendSmsOtp = async (mobileNumber, otp, vendorName = '') => {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    _logDev(mobileNumber, 'OTP', otp);
    return { success: true, dev: true };
  }

  if (provider === 'msg91') {
    try {
      return await _sendMsg91Otp(mobileNumber, otp);
    } catch (error) {
      console.error('[SMS OTP ERROR]', error.message);
      console.log(`[SMS FALLBACK] OTP for ${mobileNumber}: ${otp}`);
      throw error;
    }
  }

  // fallback
  _logDev(mobileNumber, 'OTP', otp);
  return { success: true, dev: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send Redemption Confirmation SMS
// ─────────────────────────────────────────────────────────────────────────────
const sendRedemptionConfirmation = async (mobileNumber, vendorName, redeemedAmount, remainingBalance) => {
  const provider = process.env.SMS_PROVIDER;
  const name = vendorName || 'Vendor';
  const message = `Dear ${name}, Rs.${redeemedAmount} redeemed from FTC Incentive wallet. Remaining balance: Rs.${remainingBalance}. -FTCIND`;

  if (!provider) {
    _logDev(mobileNumber, 'CONFIRMATION', message);
    return { success: true, dev: true };
  }

  if (provider === 'msg91') {
    try {
      return await _sendMsg91Sms(mobileNumber, message);
    } catch (error) {
      console.error('[SMS CONFIRM ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  _logDev(mobileNumber, 'CONFIRMATION', message);
  return { success: true, dev: true };
};

module.exports = { sendSmsOtp, sendRedemptionConfirmation };
