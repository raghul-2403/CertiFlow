import mongoose from 'mongoose';

// Simple key/value store for app settings (Google connection, secrets, sync state)
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

export async function getSetting(key, fallback = null) {
  const doc = await Setting.findOne({ key }).lean();
  return doc ? doc.value : fallback;
}

export async function setSetting(key, value) {
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  return value;
}

export async function getSettings(keys) {
  const docs = await Setting.find({ key: { $in: keys } }).lean();
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return Object.fromEntries(keys.map((k) => [k, map[k] ?? null]));
}

export default Setting;
