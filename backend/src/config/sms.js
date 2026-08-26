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
const _sendWhatsAppConfirmation = async (mobileNumber, vendorName, amount, invoiceNo, balance) => {
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
                { type: 'text', text: invoiceNo || 'N/A' },
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
// OTP flow  : stype=auth, text=<template_name>, Params=<otp>
// Confirm   : stype=normal, text=<template_name>, Params=<p1,p2,...>
const _sendBhashWhatsapp = async (mobileNumber, otp, vendorName = '', rawMessage = null) => {
  const user = process.env.BHASH_USER;
  const pass = process.env.BHASH_PASS;
  const sender = process.env.BHASH_SENDER || 'BUZWAP';
  const otpTemplate = process.env.BHASH_TEXT_KEY || 'otp_ftc';
  const confirmTemplate = process.env.BHASH_CONFIRM_TEMPLATE || 'ftc_redemption';

  if (!user || !pass) {
    throw new Error('BHASH credentials not set (BHASH_USER / BHASH_PASS missing in .env)');
  }

  // Build base params — phone WITHOUT country code per BhashSMS docs
  const params = new URLSearchParams({
    user,
    pass,
    sender,
    phone: mobileNumber,   // 10-digit, no 91 prefix
    priority: 'wa',
  });

  if (rawMessage) {
    // Confirmation message: use normal stype with template + Params
    params.set('stype', 'normal');
    params.set('text', confirmTemplate);
    // rawMessage here is the full text; pass vendorName, amount, balance as Params
    // Caller passes rawMessage as the full sentence — we extract values from vendorName arg
    // For simplicity, pass the raw message as a single Param (template must match)
    params.set('Params', rawMessage);
  } else {
    // OTP: stype=auth, text=template_name, Params=OTP_value
    params.set('stype', 'auth');
    params.set('text', otpTemplate);
    params.set('Params', otp);
  }

  // BhashSMS API endpoint
  const url = `http://bhashsms.com/api/sendmsgutil.php?${params.toString()}`;
  console.log('[BHASH REQUEST]', url.replace(pass, '***'));

  const resp = await fetch(url, { method: 'GET' });
  const text = await resp.text();
  console.log('[BHASH RESPONSE]', text);

  // BhashSMS returns a numeric message ID on success, or error text on failure
  if (!text || /error|invalid|fail/i.test(text)) {
    throw new Error(`BHASH error: ${text}`);
  }

  return { success: true, messageId: text.trim() };
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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send Incentive Credit Notification (friends_incentive template)
// Template: Dear {{1}}, your incentive amount of Rs. {{2}} for {{3}} has been
//           processed successfully. Regards, Friends Trading Corporation
// Params: {{1}} = vendorName, {{2}} = amount, {{3}} = description/remark
// ─────────────────────────────────────────────────────────────────────────────
const sendIncentiveCreditNotification = async (mobileNumber, vendorName, creditedAmount, description = 'Incentive') => {
  const provider = process.env.SMS_PROVIDER;
  const name = vendorName || 'Vendor';

  if (!provider) {
    _logDev(mobileNumber, 'INCENTIVE_CREDIT', `+Rs.${creditedAmount}, against: ${description}`);
    return { success: true, dev: true };
  }

  if (provider === 'bhash') {
    try {
      const creditTemplate = process.env.BHASH_CREDIT_TEMPLATE || 'friends_incentive';
      const user = process.env.BHASH_USER;
      const pass = process.env.BHASH_PASS;
      const sender = process.env.BHASH_SENDER || 'BUZWAP';

      if (!user || !pass) throw new Error('BHASH credentials not set');

      // Params: name, amount, description  →  {{1}}, {{2}}, {{3}}
      // NOTE: Params must NOT be URL-encoded — append raw to avoid %2C issue
      const baseParams = new URLSearchParams({
        user, pass, sender,
        phone: mobileNumber,
        priority: 'wa',
        stype: 'normal',
        text: creditTemplate,
      });

      const url = `http://bhashsms.com/api/sendmsgutil.php?${baseParams.toString()}&Params=${name},${creditedAmount},${description}`;
      console.log('[BHASH CREDIT REQUEST]', url.replace(pass, '***'));

      const resp = await fetch(url, { method: 'GET' });
      const text = await resp.text();
      console.log('[BHASH CREDIT RESPONSE]', text);

      if (!text || /error|invalid|fail/i.test(text)) throw new Error(`BHASH error: ${text}`);
      return { success: true, messageId: text.trim() };
    } catch (error) {
      console.error('[BHASH CREDIT ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  _logDev(mobileNumber, 'INCENTIVE_CREDIT', `+Rs.${creditedAmount}, against: ${description}`);
  return { success: true, dev: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send Redemption Confirmation (friends_amount template)
// Template: ...of {{1}} has been deducted against Invoice No. {{2}}.
//           Your updated wallet balance is {{3}}.
//           Regards, Friends Trading Corporation
// Params: {{1}} = amount, {{2}} = invoiceNo, {{3}} = balance
// ─────────────────────────────────────────────────────────────────────────────
const sendRedemptionConfirmation = async (mobileNumber, vendorName, redeemedAmount, invoiceNo, remainingBalance, referenceNo) => {
  const provider = process.env.SMS_PROVIDER;
  const name = vendorName || 'Vendor';
  const displayInvoiceNo = referenceNo ? `${invoiceNo} (Ref:${referenceNo})` : invoiceNo;

  if (!provider) {
    _logDev(mobileNumber, 'REDEMPTION', `Amount: Rs.${redeemedAmount}, Invoice: ${displayInvoiceNo}, Balance: Rs.${remainingBalance}`);
    return { success: true, dev: true };
  }

  if (provider === 'bhash') {
    try {
      const confirmTemplate = process.env.BHASH_CONFIRM_TEMPLATE || 'friends_amount';
      const user = process.env.BHASH_USER;
      const pass = process.env.BHASH_PASS;
      const sender = process.env.BHASH_SENDER || 'BUZWAP';

      if (!user || !pass) throw new Error('BHASH credentials not set');

      // Params: vendorName, amount, invoiceNo, balance  →  {{1}}, {{2}}, {{3}}, {{4}}
      // NOTE: Params must NOT be URL-encoded — append raw to avoid %2C issue
      const baseParams = new URLSearchParams({
        user, pass, sender,
        phone: mobileNumber,
        priority: 'wa',
        stype: 'normal',
        text: confirmTemplate,
      });

      const url = `http://bhashsms.com/api/sendmsgutil.php?${baseParams.toString()}&Params=${name},${redeemedAmount},${displayInvoiceNo},${remainingBalance}`;
      console.log('[BHASH REDEMPTION REQUEST]', url.replace(pass, '***'));

      const resp = await fetch(url, { method: 'GET' });
      const text = await resp.text();
      console.log('[BHASH REDEMPTION RESPONSE]', text);

      if (!text || /error|invalid|fail/i.test(text)) throw new Error(`BHASH error: ${text}`);
      return { success: true, messageId: text.trim() };
    } catch (error) {
      console.error('[BHASH REDEMPTION ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  if (provider === 'msg91') {
    try {
      const message = `Rs.${redeemedAmount} has been deducted against Invoice No. ${displayInvoiceNo}. Your updated wallet balance is Rs.${remainingBalance}. -FTCIND`;
      return await _sendMsg91Sms(mobileNumber, message);
    } catch (error) {
      console.error('[MSG91 REDEMPTION ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  if (provider === 'whatsapp') {
    try {
      return await _sendWhatsAppConfirmation(mobileNumber, name, redeemedAmount, displayInvoiceNo, remainingBalance);
    } catch (error) {
      console.error('[WhatsApp REDEMPTION ERROR]', error.message);
      return { success: false, error: error.message };
    }
  }

  _logDev(mobileNumber, 'REDEMPTION', `Amount: Rs.${redeemedAmount}, Invoice: ${displayInvoiceNo}, Balance: Rs.${remainingBalance}`);
  return { success: true, dev: true };
};

module.exports = { sendSmsOtp, sendRedemptionConfirmation, sendIncentiveCreditNotification };
