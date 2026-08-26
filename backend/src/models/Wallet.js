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
