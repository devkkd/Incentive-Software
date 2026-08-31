const mongoose = require('mongoose');

/**
 * DeletedParty — a record of who a party was, kept after they are removed.
 *
 * Deletion currently destroys the party record entirely, which leaves their
 * wallets, transactions and invoices pointing at nothing. The Exception Report
 * can find those orphans but cannot say who they belonged to.
 *
 * This is the minimum needed to answer "who was this?". It is not the full
 * archive described in Point 21c — that snapshots wallets, transactions and
 * invoices too, and supports rebuilding the party. This stores identity only.
 *
 * Append-only by intent: nothing in the application updates or removes these.
 */
const deletedPartySchema = new mongoose.Schema(
  {
    // The original party _id, so orphaned records can be matched back
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Identity at the moment of deletion
    accountNumber: { type: String, trim: true },   // Party Code
    companyName:   { type: String, trim: true },   // Party Name
    personName:    { type: String, trim: true },
    mobileNumber:  { type: String, trim: true },
    partyCity:     { type: String, trim: true },
    partyType:     { type: String, trim: true },
    salesPerson:   { type: String, trim: true },
    divisionName:  { type: String, trim: true },
    status:        { type: String, trim: true },

    // What they were holding when removed — so a later discrepancy can be
    // explained rather than merely observed
    walletBalanceAtDeletion: { type: Number, default: 0 },

    deletedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedByName: { type: String, trim: true, default: null },
    deletionReason:{ type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeletedParty', deletedPartySchema);
