const mongoose = require('mongoose');

/**
 * Every WhatsApp / SMS message the system tries to send — OTPs, redemption
 * confirmations, incentive credit notices and admin tests.
 *
 * Before this, a failed message was only printed to the server console and
 * lost, so "the party did not get the OTP" could never be explained.
 *
 * Note: status 'sent' means the provider ACCEPTED the message. Whether
 * WhatsApp then delivered it is not known (BhashSMS delivery reports are not
 * connected).
 */
const messageLogSchema = new mongoose.Schema(
  {
    purpose: {
      type: String,
      enum: ['otp', 'redemption_confirm', 'incentive_credit', 'test'],
      required: true,
      index: true,
    },
    provider: { type: String, default: null },   // bhash | whatsapp | msg91 | dev
    status: {
      type: String,
      enum: ['sent', 'failed', 'dev'],
      required: true,
      index: true,
    },

    mobileRaw: { type: String, default: null },   // as stored on the party
    mobile: { type: String, default: null, index: true }, // cleaned 10-digit

    vendorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    partyCode: { type: String, default: null },
    partyName: { type: String, default: null },

    template: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    providerResponse: { type: String, default: null }, // raw reply, trimmed
    httpStatus: { type: Number, default: null },
    error: { type: String, default: null },             // plain-language reason
    durationMs: { type: Number, default: null },

    reference: { type: String, default: null },         // invoice no. / scheme etc.
    triggeredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    triggeredByName: { type: String, default: null },
  },
  { timestamps: true }
);

messageLogSchema.index({ createdAt: -1 });
// Keep 180 days of logs
messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('MessageLog', messageLogSchema);
