const mongoose = require('mongoose');

const divisionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      // Location code e.g. AJM, JOH, BEW
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    // Serial number used as invoice prefix: 1/, 2/, 3/
    locationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 5,
    },
    invoiceCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Division', divisionSchema);
