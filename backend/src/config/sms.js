/**
 * SMS/WhatsApp Service — FTC Incentive Management
 *
 * SMS_PROVIDER=bhash      → BhashSMS WhatsApp API (live site)
 * SMS_PROVIDER=msg91      → MSG91 OTP API (production SMS)
 * SMS_PROVIDER=whatsapp   → Meta WhatsApp Cloud API
 * SMS_PROVIDER=           → Dev mode, OTP shown on screen
 *
 * Every attempt is recorded in MessageLog (Admin → WhatsApp Logs) with the
 * provider's raw reply and, on failure, the reason in plain language.
 */
const MessageLog = require('../models/MessageLog');
const { normalizeMobile } = require('../services/mobile');

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


// ─── BhashSMS (WhatsApp via simple HTTP GET) ─────────────────────────────────
// OTP     : stype=auth,   text=<template>, Params=<otp>
// Others  : stype=normal, text=<template>, Params=<p1,p2,...>
const BHASH_URL = process.env.BHASH_URL || 'http://bhashsms.com/api/sendmsgutil.php';
const PROVIDER_TIMEOUT_MS = 15000;

// Replies that mean the message was NOT accepted. BhashSMS answers HTTP 200
// even on failure, with the reason as text — so the text has to be read.
const BHASH_FAIL_RE = /error|invalid|fail|insufficient|low balance|no balance|not enough|unauthori|denied|blocked|expired|incorrect|wrong|not allowed|missing|disabled|suspend/i;

class SendError extends Error {
  constructor(message, extra = {}) {
    super(message);
    Object.assign(this, extra);
  }
}

// Params are sent as plain text, the way BhashSMS has always received them
// (it does not accept them URL-encoded, e.g. commas as %2C). Characters that
// would break the URL or the comma-separated list are replaced with a space:
// a party name like "A & B, Motors #1" previously cut the message short.
const _bhashParams = (values) =>
  values.map((v) => String(v ?? '').replace(/[,&#%+?]/g, ' ').replace(/\s+/g, ' ').trim()).join(',');

const _bhashSend = async ({ mobile, stype, template, params }) => {
  const user = process.env.BHASH_USER;
  const pass = process.env.BHASH_PASS;
  const sender = process.env.BHASH_SENDER || 'BUZWAP';
  if (!user || !pass) {
    throw new SendError('BhashSMS login is not configured on the server (BHASH_USER / BHASH_PASS missing)');
  }

  const base = new URLSearchParams({ user, pass, sender, phone: mobile, priority: 'wa', stype, text: template });
  const url = `${BHASH_URL}?${base.toString()}&Params=${_bhashParams(params)}`;
  console.log('[BHASH REQUEST]', url.replace(encodeURIComponent(pass), '***').replace(pass, '***'));

  let resp;
  try {
    resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new SendError(
      timedOut
        ? `BhashSMS did not respond within ${PROVIDER_TIMEOUT_MS / 1000} seconds`
        : `Could not reach BhashSMS: ${err.cause?.code || err.message}`
    );
  }

  const text = (await resp.text()).trim();
  console.log('[BHASH RESPONSE]', resp.status, text.slice(0, 300));
  const raw = text.slice(0, 1000);

  if (!resp.ok) throw new SendError(`BhashSMS returned HTTP ${resp.status}`, { raw, httpStatus: resp.status });
  if (!text) throw new SendError('BhashSMS returned an empty reply', { raw, httpStatus: resp.status });
  if (/<html|<!doctype/i.test(text)) {
    throw new SendError('BhashSMS returned a web page instead of a message ID', { raw, httpStatus: resp.status });
  }
  if (BHASH_FAIL_RE.test(text)) {
    throw new SendError(`BhashSMS rejected the message: ${text.slice(0, 200)}`, { raw, httpStatus: resp.status });
  }

  return { messageId: text.slice(0, 100), raw, httpStatus: resp.status };
};

// ─── Logging ──────────────────────────────────────────────────────────────────
const _log = (entry) => {
  MessageLog.create(entry).catch((err) => console.error('[MessageLog] could not save:', err.message));
};

const _ctx = (context = {}) => ({
  vendorId: context.vendor?._id || context.vendorId || null,
  partyCode: context.vendor?.accountNumber || context.partyCode || null,
  partyName: context.vendor?.companyName || context.partyName || null,
  reference: context.reference || null,
  triggeredById: context.user?._id || null,
  triggeredByName: context.user?.name || null,
});

/**
 * Runs one send and records it. `attempt` receives the cleaned 10-digit
 * number and returns { messageId, raw, httpStatus } or throws.
 * Resolves to { success, dev, messageId, raw, error, mobile, provider, durationMs }.
 */
const _deliver = async ({ purpose, mobileRaw, template, context, devText, attempt }) => {
  const provider = process.env.SMS_PROVIDER || 'dev';
  const started = Date.now();
  const base = { purpose, provider, mobileRaw: mobileRaw ?? null, template, ..._ctx(context) };

  const m = normalizeMobile(mobileRaw);
  if (!m.ok) {
    _log({ ...base, status: 'failed', error: m.reason, durationMs: 0 });
    return { success: false, error: m.reason, provider, mobile: null, durationMs: 0 };
  }

  if (provider === 'dev') {
    _logDev(m.mobile, purpose.toUpperCase(), devText);
    _log({ ...base, mobile: m.mobile, status: 'dev', providerResponse: 'Dev mode — not sent', durationMs: 0 });
    return { success: true, dev: true, provider, mobile: m.mobile, durationMs: 0 };
  }

  try {
    const r = (await attempt(m.mobile)) || {};
    const durationMs = Date.now() - started;
    _log({
      ...base, mobile: m.mobile, status: 'sent', durationMs,
      providerMessageId: r.messageId || null, providerResponse: r.raw || null, httpStatus: r.httpStatus || null,
    });
    return { success: true, provider, mobile: m.mobile, messageId: r.messageId || null, raw: r.raw || null, durationMs };
  } catch (err) {
    const durationMs = Date.now() - started;
    console.error(`[${provider.toUpperCase()} ${purpose.toUpperCase()} FAILED]`, m.mobile, err.message);
    _log({
      ...base, mobile: m.mobile, status: 'failed', durationMs,
      error: err.message, providerResponse: err.raw || null, httpStatus: err.httpStatus || null,
    });
    return { success: false, provider, mobile: m.mobile, error: err.message, raw: err.raw || null, durationMs };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Send OTP — throws on failure (the caller must know)
// ─────────────────────────────────────────────────────────────────────────────
const _otpAttempt = (otp, vendorName) => async (mobile) => {
  const provider = process.env.SMS_PROVIDER;
  if (provider === 'bhash') {
    return _bhashSend({ mobile, stype: 'auth', template: process.env.BHASH_TEXT_KEY || 'otp_ftc', params: [otp] });
  }
  if (provider === 'whatsapp') return _sendWhatsApp(mobile, otp, vendorName);
  if (provider === 'msg91') return _sendMsg91Otp(mobile, otp);
  throw new SendError(`Unknown SMS_PROVIDER "${provider}"`);
};

const sendSmsOtp = async (mobileNumber, otp, vendorName = '', context = {}) => {
  const r = await _deliver({
    purpose: 'otp', mobileRaw: mobileNumber, context,
    template: process.env.SMS_PROVIDER === 'bhash' ? (process.env.BHASH_TEXT_KEY || 'otp_ftc') : null,
    devText: otp,
    attempt: _otpAttempt(otp, vendorName),
  });
  if (!r.success) throw new SendError(r.error, { raw: r.raw });
  return r;
};

// Admin test — same path as a real OTP, returns the full result instead of throwing
const sendTestOtp = async (mobileNumber, context = {}) => {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const r = await _deliver({
    purpose: 'test', mobileRaw: mobileNumber, context: { ...context, reference: 'Test OTP from admin' },
    template: process.env.SMS_PROVIDER === 'bhash' ? (process.env.BHASH_TEXT_KEY || 'otp_ftc') : null,
    devText: otp,
    attempt: _otpAttempt(otp, 'Test'),
  });
  return { ...r, otp };
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Incentive credit notification (friends_incentive template)
// Params: {{1}} vendorName, {{2}} amount, {{3}} description
// Never throws — a failed notice must not undo a credit.
// ─────────────────────────────────────────────────────────────────────────────
const sendIncentiveCreditNotification = async (mobileNumber, vendorName, creditedAmount, description = 'Incentive', context = {}) => {
  const name = vendorName || 'Vendor';
  const provider = process.env.SMS_PROVIDER;
  const template = process.env.BHASH_CREDIT_TEMPLATE || 'friends_incentive';
  return _deliver({
    purpose: 'incentive_credit', mobileRaw: mobileNumber, context: { reference: description, ...context },
    template: provider === 'bhash' ? template : null,
    devText: `+Rs.${creditedAmount}, against: ${description}`,
    attempt: async (mobile) => {
      if (provider === 'bhash') {
        return _bhashSend({ mobile, stype: 'normal', template, params: [name, creditedAmount, description] });
      }
      // Other providers have no credit template — record it as not sent
      throw new SendError(`Credit notices are only set up for BhashSMS (provider is "${provider}")`);
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Redemption confirmation (friends_amount template)
// Params: {{1}} vendorName, {{2}} amount, {{3}} invoiceNo, {{4}} balance
// Never throws — returns { success, error }.
// ─────────────────────────────────────────────────────────────────────────────
const sendRedemptionConfirmation = async (mobileNumber, vendorName, redeemedAmount, invoiceNo, remainingBalance, referenceNo, context = {}) => {
  const name = vendorName || 'Vendor';
  const provider = process.env.SMS_PROVIDER;
  const displayInvoiceNo = referenceNo ? `${invoiceNo} (Ref:${referenceNo})` : invoiceNo;
  const template = process.env.BHASH_CONFIRM_TEMPLATE || 'friends_amount';
  return _deliver({
    purpose: 'redemption_confirm', mobileRaw: mobileNumber, context: { reference: displayInvoiceNo, ...context },
    template: provider === 'bhash' ? template : null,
    devText: `Amount: Rs.${redeemedAmount}, Invoice: ${displayInvoiceNo}, Balance: Rs.${remainingBalance}`,
    attempt: async (mobile) => {
      if (provider === 'bhash') {
        return _bhashSend({
          mobile, stype: 'normal', template,
          params: [name, redeemedAmount, displayInvoiceNo, remainingBalance],
        });
      }
      if (provider === 'msg91') {
        return _sendMsg91Sms(mobile,
          `Rs.${redeemedAmount} has been deducted against Invoice No. ${displayInvoiceNo}. Your updated wallet balance is Rs.${remainingBalance}. -FTCIND`);
      }
      if (provider === 'whatsapp') {
        const r = await _sendWhatsAppConfirmation(mobile, name, redeemedAmount, displayInvoiceNo, remainingBalance);
        if (!r.success) throw new SendError('WhatsApp Cloud API rejected the confirmation');
        return r;
      }
      throw new SendError(`Unknown SMS_PROVIDER "${provider}"`);
    },
  });
};

module.exports = { sendSmsOtp, sendTestOtp, sendRedemptionConfirmation, sendIncentiveCreditNotification, normalizeMobile };
