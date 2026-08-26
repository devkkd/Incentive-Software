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

// Unique wallet per vendor per month/year per master wallet
// walletId null means auto/legacy (month-year only uploads)
monthlyWalletSchema.index({ vendor: 1, year: 1, month: 1, wallet: 1 }, { unique: true });
monthlyWalletSchema.index({ vendor: 1, balance: 1 });

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/**
 * getOrCreate — finds or creates a MonthlyWallet for a vendor+month+year.
 * If masterWalletId is provided, it scopes the lookup to that wallet so that
 * two different named wallets uploaded in the same month (e.g. MSGA + MSGP)
 * each get their own MonthlyWallet document instead of sharing one.
 */
monthlyWalletSchema.statics.getOrCreate = async function(vendorId, month, year, masterWalletId = null, label = null) {
  const walletLabel = label || `${MONTH_NAMES[month - 1]} ${year}`;
  const query = { vendor: vendorId, month, year, wallet: masterWalletId || null };
  let wallet = await this.findOne(query);
  if (!wallet) {
    wallet = await this.create({
      vendor: vendorId,
      month,
      year,
      label: walletLabel,
      wallet: masterWalletId || null,
      creditedAmount: 0,
      balance: 0,
    });
  }
  return wallet;
};

module.exports = mongoose.model('MonthlyWallet', monthlyWalletSchema);
