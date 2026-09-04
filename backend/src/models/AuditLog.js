const mongoose = require('mongoose');

/**
 * POINT 21b — AUDIT TRAIL
 *
 * An append-only record of everything that happens to a party.
 *
 * Nothing in the application updates or deletes these. If a party disputes
 * their balance, this is the answer — and an audit trail that can be altered
 * is not an audit trail.
 *
 * ⚠️ This captures from the day it is installed. Events before that were never
 * recorded and cannot be recovered. That is the argument for installing it
 * sooner rather than later — every week of delay is history permanently lost.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who it happened to. Kept as a raw id, not a ref, so the record survives
    // the party being deleted.
    // Null for system-wide events such as a wallet rename, which affect many
    // parties rather than one.
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    // Denormalised on purpose — if the party is later deleted, the trail must
    // still say who it was about.
    partyCode: { type: String, trim: true },
    partyName: { type: String, trim: true },

    eventType: {
      type: String,
      required: true,
      index: true,
      enum: [
        // Party record
        'party.created', 'party.updated', 'party.blocked', 'party.unblocked', 'party.deleted',
        // Money in
        'incentive.credited', 'incentive.topup', 'incentive.replaced', 'reconciliation.adjusted',
        // Money out
        'redemption', 'redemption.adminOverride', 'redemption.reassigned', 'invoice.deleted',
        // Wallet state
        'wallet.held', 'wallet.released', 'wallet.renamed', 'scheme.held', 'scheme.released',
        // Approval
        'otp.sent', 'otp.failed', 'otp.verified', 'otp.rejected',
      ],
    },

    // Who did it
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, default: null },
    actorRole: { type: String, trim: true, default: null },

    // Where it came from — counter, admin portal, bulk upload, or a system job
    source: {
      type: String,
      enum: ['branch', 'admin', 'upload', 'system'],
      default: 'system',
    },

    // What changed. One entry per field, so "phone number was X, now Y" is
    // answerable years later.
    changes: [
      {
        field: String,
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
        _id: false,
      },
    ],

    // Money, where money moved
    amount:        { type: Number, default: null },
    balanceAfter:  { type: Number, default: null },
    walletLabel:   { type: String, trim: true, default: null },
    invoiceNumber: { type: String, trim: true, default: null },
    referenceNo:   { type: String, trim: true, default: null },

    reason: { type: String, trim: true, default: null },

    // Free-form summary, so a reader does not have to interpret the fields
    summary: { type: String, trim: true, default: null },

    // Set on entries rebuilt from WalletTransaction rather than captured live,
    // so they are never mistaken for a real audit record.
    reconstructed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    // Guards against a stray update slipping through in future code
    strict: 'throw',
  }
);

auditLogSchema.index({ vendorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
