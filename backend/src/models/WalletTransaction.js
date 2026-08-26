const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null, // null for redemptions and incentive credits
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: String,
      trim: true,
      default: null,
    },
    monthlyWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyWallet',
      default: null, // null for legacy transactions
    },
    walletLabel: {
      type: String,
      trim: true,
      default: null, // e.g. "May 2025" — denormalized for quick display
    },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
