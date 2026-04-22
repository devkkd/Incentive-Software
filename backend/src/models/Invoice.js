const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      required: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
      // Auto-generated: locationCode-00001
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    invoiceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processed'],
      default: 'processed',
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ vendor: 1, createdAt: -1 });
invoiceSchema.index({ division: 1, createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
