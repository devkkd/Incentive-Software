/**
 * Indian mobile numbers are stored in many shapes ("+91 98290 12345",
 * "098290...", "9829012345"). The message provider wants exactly 10 digits.
 *
 * Returns { ok: true, mobile: '9829012345' } or { ok: false, reason }.
 */
function normalizeMobile(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return { ok: false, reason: 'No mobile number on record' };
  let digits = original.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) return { ok: false, reason: `Mobile number "${original}" is not 10 digits` };
  if (!/^[6-9]/.test(digits)) return { ok: false, reason: `Mobile number "${original}" does not start with 6, 7, 8 or 9` };
  return { ok: true, mobile: digits };
}

module.exports = { normalizeMobile };
