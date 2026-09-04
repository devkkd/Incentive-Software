const AuditLog = require('../models/AuditLog');

/**
 * POINT 21b — shared audit helper.
 *
 * One function, called from every route that changes party state. Deliberately
 * a shared helper rather than re-implemented per screen: coverage would
 * otherwise be patchy, and the gaps would be invisible.
 *
 * ⚠️ NEVER let an audit failure break the operation it is recording. If the
 * log write fails, the redemption or credit must still succeed — losing an
 * audit line is bad, refusing a party's redemption because of it is worse.
 * Every call is fire-and-forget and errors only to the console.
 */

/**
 * @param {Object}  e
 * @param {Object}  e.vendor      the party (needs _id, accountNumber, companyName)
 * @param {String}  e.eventType   one of the enum values on AuditLog
 * @param {Object}  e.actor       req.user
 * @param {String}  e.source      'branch' | 'admin' | 'upload' | 'system'
 * @param {Array}   e.changes     [{ field, from, to }]
 * @param {Number}  e.amount
 * @param {String}  e.summary     plain-language description
 */
async function audit(e = {}) {
  try {
    const v = e.vendor || {};

    await AuditLog.create({
      vendorId: v._id || e.vendorId,
      partyCode: v.accountNumber || e.partyCode || null,
      partyName: v.companyName || e.partyName || null,

      eventType: e.eventType,

      actorId: e.actor?._id || null,
      actorName: e.actor?.name || null,
      actorRole: e.actor?.role || null,
      source: e.source || 'system',

      changes: e.changes || [],
      amount: e.amount ?? null,
      balanceAfter: e.balanceAfter ?? null,
      walletLabel: e.walletLabel || null,
      invoiceNumber: e.invoiceNumber || null,
      referenceNo: e.referenceNo || null,
      reason: e.reason || null,
      summary: e.summary || null,
      reconstructed: !!e.reconstructed,
    });
  } catch (err) {
    // Log and move on. The operation being audited must not fail because of this.
    console.error('[audit] could not record event:', e.eventType, '—', err.message);
  }
}

/**
 * Compare two versions of a record and return only what actually changed.
 * Used for party edits, so the trail says "mobile was X, now Y" rather than
 * dumping the whole document.
 */
function diff(before, after, fields) {
  const changes = [];
  for (const f of fields) {
    const from = before?.[f];
    const to = after?.[f];
    const same =
      String(from ?? '') === String(to ?? '') ||
      (from == null && to == null);
    if (!same) changes.push({ field: f, from: from ?? null, to: to ?? null });
  }
  return changes;
}

module.exports = { audit, diff };
