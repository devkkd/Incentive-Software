const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      unique: true,
      trim: true,
      // Auto-generated: locationCode-00001
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },
    blockReason: {
      type: String,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0.0,
      min: 0,
    },
    lastRedemptionAmount: {
      type: Number,
      default: 0.0,
    },
    lastRedemptionDate: {
      type: Date,
      default: null,
    },
    salesPerson: {
      type: String,
      trim: true,
      default: null,
    },
    partyCity: {
      type: String,
      trim: true,
      default: null,
    },
    partyType: {
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

// Compound index for filtering by division + status
vendorSchema.index({ division: 1, status: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
