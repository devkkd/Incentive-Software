/**
 * SMS Service — FTC Incentive Management
 *
 * Supports two providers based on ENV:
 *   SMS_PROVIDER=msg91   → MSG91 (recommended for production)
 *   SMS_PROVIDER=fast2sms → Fast2SMS (dev/testing only)
 *
 * DEV MODE: If SMS_PROVIDER is not set, all SMS are logged to console only.
 *
 * ── MSG91 Setup ──────────────────────────────────────────────────────────────
 * 1. Sign up at https://msg91.com
 * 2. Get Auth Key from Dashboard → API
 * 3. Register on DLT (Airtel/Jio portal) — MSG91 helps with this
 * 4. Get Sender ID approved (e.g. FTCIND) — 3-5 days
 * 5. Create & approve two SMS templates:
 *    - OTP template:          "Dear ##NAME##, your FTC OTP is ##OTP##. Valid 5 mins. -FTCIND"
 *    - Confirmation template: "Dear ##NAME##, Rs.##AMOUNT## redeemed. Balance: Rs.##BALANCE##. -FTCIND"
 * 6. Add to .env:
 *    SMS_PROVIDER=msg91
 *    MSG91_AUTH_KEY=your_auth_key
 *    MSG91_SENDER_ID=FTCIND
 *    MSG91_OTP_TEMPLATE_ID=your_otp_template_id
 *    MSG91_CONFIRM_TEMPLATE_ID=your_confirm_template_id
 *
 * ── Fast2SMS Setup (dev/testing) ─────────────────────────────────────────────
 * 1. Sign up at https://www.fast2sms.com
 * 2. Get API key from Dashboard → Dev API
 * 3. Add to .env:
 *    SMS_PROVIDER=fast2sms
 *    SMS_API_KEY=your_api_key
 */

// ─── Internal: send via MSG91 ─────────────────────────────────────────────────
const _sendMsg91 = async (mobileNumber, message, templateId) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'FTCIND';

  const payload = {
    sender: senderId,
    route: '4',          // Transactional route
    country: '91',
    sms: [
      {
        message,
        to: [mobileNumber],
      },
    ],
  };

  const response = await fetch('https://api.msg91.com/api/sendhttp.php', {
    method: 'POST',
    headers: {
      authkey: authKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!text.includes('success') && !text.startsWith('2')) {
    throw new Error(`MSG91 error: ${text}`);
  }

  return { success: true };
};

// ─── Internal: send via Fast2SMS ─────────────────────────────────────────────
const _sendFast2Sms = async (mobileNumber, message) => {
  const apiKey = process.env.SMS_API_KEY;

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message,
      language: 'english',
      flash: 0,
      numbers: mobileNumber,
    }),
  });

  const data = await response.json();
  if (!data.return) throw new Error(data.message?.[0] || 'Fast2SMS send failed');

  return { success: true };
};

// ─── Internal: dev mode logger ────────────────────────────────────────────────
const _logDev = (mobileNumber, type, message) => {
  console.log('\n' + '━'.repeat(50));
  console.log(`[SMS DEV] Type    : ${type}`);
  console.log(`[SMS DEV] To      : ${mobileNumber}`);
  console.log(`[SMS DEV] Message : ${message}`);
  console.log('━'.repeat(50) + '\n');
};

// ─── Internal: route to correct provider ─────────────────────────────────────
const _send = async (mobileNumber, message, templateId = null) => {
  const provider = process.env.SMS_PROVIDER;

  if (!provider || process.env.NODE_ENV === 'development') {
    _logDev(mobileNumber, templateId ? 'TRANSACTIONAL' : 'OTP', message);
    return { success: true, dev: true };
  }

  if (provider === 'msg91') {
    return await _sendMsg91(mobileNumber, message, templateId);
  }

  if (provider === 'fast2sms') {
    return await _sendFast2Sms(mobileNumber, message);
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send OTP SMS
// Called before redemption — vendor gets OTP on their mobile
// ─────────────────────────────────────────────────────────────────────────────
const sendSmsOtp = async (mobileNumber, otp, vendorName = '') => {
  const name = vendorName || 'Vendor';
  const message = `Dear ${name}, your FTC Incentive wallet redemption OTP is: ${otp}. Valid for 5 minutes. Do not share with anyone. - Faith Trust Commitment`;

  try {
    return await _send(mobileNumber, message, process.env.MSG91_OTP_TEMPLATE_ID);
  } catch (error) {
    console.error('[SMS OTP ERROR]', error.message);
    // Always log OTP as fallback so operation doesn't break
    console.log(`[SMS FALLBACK] OTP for ${mobileNumber}: ${otp}`);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send Redemption Confirmation SMS
// Called after successful redemption — vendor gets balance update
// Message: "Rs.500 redeemed. Remaining balance: Rs.1200"
// ─────────────────────────────────────────────────────────────────────────────
const sendRedemptionConfirmation = async (mobileNumber, vendorName, redeemedAmount, remainingBalance) => {
  const name = vendorName || 'Vendor';
  const message = `Dear ${name}, Rs.${redeemedAmount} has been redeemed from your FTC Incentive wallet. Remaining balance: Rs.${remainingBalance}. For queries contact your FTC representative. - Faith Trust Commitment`;

  try {
    const result = await _send(mobileNumber, message, process.env.MSG91_CONFIRM_TEMPLATE_ID);
    return result;
  } catch (error) {
    // Non-blocking — redemption already done, just log the error
    console.error('[SMS CONFIRM ERROR]', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendSmsOtp, sendRedemptionConfirmation };
