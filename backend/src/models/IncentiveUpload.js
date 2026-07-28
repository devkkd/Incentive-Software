const mongoose = require('mongoose');

const incentiveUploadItemSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const incentiveUploadSchema = new mongoose.Schema(
  {
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      default: null, // null for admin uploads
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    year: {
      type: Number,
      default: null,
    },
    walletLabel: {
      type: String,
      trim: true,
      default: null, // e.g. "May 2025"
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
    },
    items: [incentiveUploadItemSchema],
  },
  { timestamps: true }
);

incentiveUploadSchema.index({ division: 1, createdAt: -1 });

module.exports = mongoose.model('IncentiveUpload', incentiveUploadSchema);
