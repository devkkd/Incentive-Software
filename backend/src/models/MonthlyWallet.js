const mongoose = require('mongoose');

/**
 * MonthlyWallet — per-vendor, per-month incentive sub-wallet
 *
 * Each document represents one month's incentive balance for a vendor.
 * month: 1-12, year: e.g. 2025
 * label: "May 2025" — for display
 */
const monthlyWalletSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    label: {
      type: String, // e.g. "May 2025"
      trim: true,
    },
    creditedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
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
  },
  { timestamps: true }
);

// Unique wallet per vendor per month/year
monthlyWalletSchema.index({ vendor: 1, year: 1, month: 1 }, { unique: true });
monthlyWalletSchema.index({ vendor: 1, balance: 1 });

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

monthlyWalletSchema.statics.getOrCreate = async function(vendorId, month, year) {
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  let wallet = await this.findOne({ vendor: vendorId, month, year });
  if (!wallet) {
    wallet = await this.create({ vendor: vendorId, month, year, label, creditedAmount: 0, balance: 0 });
  }
  return wallet;
};

module.exports = mongoose.model('MonthlyWallet', monthlyWalletSchema);
