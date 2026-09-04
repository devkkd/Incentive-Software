const mongoose = require("mongoose");

/**
 * SystemSetting — small key/value store for system-wide switches.
 *
 * Currently holds the redemption freeze (Point 7). Built as a generic
 * key/value store so future switches do not each need their own model.
 *
 * Every change is appended to `history` and never overwritten, so there is
 * always a record of who froze redemption, when, and why.
 */
const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Boolean switches use this. Kept as Mixed so other setting types can
    // reuse the model later without a migration.
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: false,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    history: [
      {
        value: mongoose.Schema.Types.Mixed,
        reason: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedByName: String,
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true },
);

/**
 * Read a setting, creating it with a default if it has never been set.
 */
systemSettingSchema.statics.get = async function (key, defaultValue = false) {
  let doc = await this.findOne({ key });
  if (!doc) {
    doc = await this.create({ key, value: defaultValue });
  }
  return doc;
};

/**
 * Change a setting and record who did it and why.
 */
systemSettingSchema.statics.set = async function (
  key,
  value,
  { reason, user } = {},
) {
  const doc = await this.get(key);

  doc.value = value;
  doc.reason = reason || null;
  doc.updatedBy = user?._id || null;
  doc.history.push({
    value,
    reason: reason || null,
    changedBy: user?._id || null,
    changedByName: user?.name || "Unknown",
    changedAt: new Date(),
  });

  await doc.save();
  return doc;
};

module.exports = mongoose.model("SystemSetting", systemSettingSchema);
