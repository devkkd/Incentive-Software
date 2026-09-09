const mongoose = require('mongoose');

/**
 * Master Wallet model representing individual named wallets
 * (e.g., "May 2025", "Diwali Scheme", "Special Bonus")
 */
const walletSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    month: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    isHold: {
      type: Boolean,
      default: false,
    },
    holdReason: {
      type: String,
      trim: true,
      default: null,
    },

    // ── POINT 22 — notice shown to branch staff at the counter ──────────────
    // Informational only. Unlike isHold this does NOT block redemption.
    noticeEnabled: {
      type: Boolean,
      default: false,
    },
    noticeMessage: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    // Optional. Once past, the notice stops showing by itself — otherwise a
    // "lapses 31 Aug" message is still on screen in November and staff learn
    // to ignore every notice.
    noticeExpiresOn: {
      type: Date,
      default: null,
    },
    // A real date, kept separate from the message text. A date typed inside a
    // sentence cannot drive reports, sorting or advance warnings.
    lapseDate: {
      type: Date,
      default: null,
    },
    noticeUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    noticeUpdatedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

walletSchema.index({ name: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
