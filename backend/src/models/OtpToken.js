const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    // For user-based OTPs (email change, password change, upload)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For vendor-based OTPs (wallet redemption)
    mobile: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    otpCode: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['redemption', 'upload', 'email_change', 'password_change'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);
