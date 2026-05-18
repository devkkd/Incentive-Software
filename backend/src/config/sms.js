/**
 * SMS/WhatsApp Service — FTC Incentive Management
 *
 * SMS_PROVIDER=msg91      → MSG91 OTP API (production SMS)
 * SMS_PROVIDER=whatsapp   → Meta WhatsApp Cloud API
 * SMS_PROVIDER=           → Dev mode, OTP shown on screen
 */

// ─── WhatsApp Cloud API ───────────────────────────────────────────────────────
const _sendWhatsApp = async (mobileNumber, otp, vendorName = '') => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'ftc_otp';

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `91${mobileNumber}`,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: vendorName || 'Vendor' },
                { type: 'text', text: otp },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Response]', JSON.stringify(data));

  if (data.error) {
    throw new Error(`WhatsApp error: ${data.error.message}`);
  }

  return { success: true };
};

// ─── WhatsApp Confirmation Message ───────────────────────────────────────────
const _sendWhatsAppConfirmation = async (mobileNumber, vendorName, amount, balance) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const templateName = process.env.WHATSAPP_CONFIRM_TEMPLATE || 'ftc_redemption';

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `91${mobileNumber}`,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: vendorName || 'Vendor' },
                { type: 'text', text: `Rs.${amount}` },
                { type: 'text', text: `Rs.${balance}` },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Confirm Response]', JSON.stringify(data));
  return { success: !data.error };
};

// ─── Bhash SMS/WhatsApp API (simple HTTP GET) ───────────────────────────────
const _sendBhashWhatsapp = async (mobileNumber, otp, vendorName = '', rawMessage = null) => {
  const user = process.env.BHASH_USER;
  const pass = process.env.BHASH_PASS;
  const sender = process.env.BHASH_SENDER || 'BUZWAP';
  const textKey = process.env.BHASH_TEXT_KEY || 'otp_friends';

  if (!user || !pass) {
    throw new Error('BHASH credentials not set');
  }

  // If rawMessage provided, use it for text param; otherwise use template key and Params for OTP
  const params = new URLSearchParams({
    user,
    pass,
    sender,
    phone: mobileNumber,
    priority: 'wa',
    stype: 'auth',
  });

  if (rawMessage) {
    params.set('text', rawMessage);
  } else {
    params.set('text', textKey);
    params.set('Params', otp);
  }

  const url = `http://bhashsms.com/api/sendmsgutil.php?${params.toString()}`;
  const resp = await fetch(url, { method: 'GET' });
  const text = await resp.text();
  console.log('[BHASH RESPONSE]', text);

  // Basic success check — BHASH usually returns a numeric status or OK text
  if (!text || /error|invalid/i.test(text)) {
    throw new Error(`BHASH error: ${text}`);
  }

  return { success: true };
};

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

  if (provider === 'whatsapp') {
    try {
      return await _sendWhatsApp(mobileNumber, otp, vendorName);
    } catch (error) {
      console.error('[WhatsApp OTP ERROR]', error.message);
      console.log(`[FALLBACK] OTP for ${mobileNumber}: ${otp}`);
      throw error;
    }
  }

  if (provider === 'bhash') {
    try {
      return await _sendBhashWhatsapp(mobileNumber, otp, vendorName);
    } catch (error) {
      console.error('[BHASH OTP ERROR]', error.message);
      console.log(`[FALLBACK] OTP for ${mobileNumber}: ${otp}`);
      throw error;
    }
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

  _logDev(mobileNumber, 'OTP', otp);
  return { success: true, dev: true };
};

const sendRedemptionConfirmation = async (mobileNumber, vendorName, redeemedAmount, remainingBalance) => {
  const provider = process.env.SMS_PROVIDER;
  const name = vendorName || 'Vendor';
  const message = `Dear ${name}, Rs.${redeemedAmount} redeemed from FTC Incentive wallet. Remaining balance: Rs.${remainingBalance}. -FTCIND`;

  if (!provider) {
    _logDev(mobileNumber, 'CONFIRMATION', message);
    return { success: true, dev: true };
  }

  if (provider === 'whatsapp') {
    try {
      return await _sendWhatsAppConfirmation(mobileNumber, name, redeemedAmount, remainingBalance);
    } catch (error) {
      console.error('[WhatsApp CONFIRM ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  if (provider === 'bhash') {
    try {
      // Bhash expects a raw text message for confirmations
      return await _sendBhashWhatsapp(mobileNumber, null, name, message);
    } catch (error) {
      console.error('[BHASH CONFIRM ERROR]', error.message);
      return { success: false, error: error.message };
    }
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
