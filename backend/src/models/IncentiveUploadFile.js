const mongoose = require('mongoose');

/**
 * The original file behind an incentive upload (or the sheet generated from
 * manual entry), kept so it can be viewed and downloaded later.
 * Stored separately from IncentiveUpload so the history list stays light.
 */
const incentiveUploadFileSchema = new mongoose.Schema(
  {
    upload: { type: mongoose.Schema.Types.ObjectId, ref: 'IncentiveUpload', required: true, unique: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IncentiveUploadFile', incentiveUploadFileSchema);
