import crypto from 'node:crypto';
import mongoose from 'mongoose';

const { Schema } = mongoose;

// No 0/O/1/I so IDs are easy to read off a printed certificate
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const certificateSchema = new Schema(
  {
    // Public id printed on the certificate and used for verification, e.g. CF-2026-7K3QXM
    certificateId: { type: String, required: true, unique: true, uppercase: true, trim: true },

    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    // participation = one per feedback; award = winner / runner-up / appreciation, given by a coordinator
    kind: { type: String, enum: ['participation', 'award'], default: 'participation' },
    // set for participation certificates only (one certificate per feedback)
    feedback: { type: Schema.Types.ObjectId, ref: 'Feedback' },
    award: {
      type: { type: String }, // key from AWARD_TYPES
      title: { type: String }, // e.g. "First Place"
      line: { type: String }, // e.g. "for securing First Place in"
    },

    // Snapshots: the certificate stays accurate even if the event is later edited
    participant: {
      name: { type: String, required: true },
      regNo: { type: String, required: true },
      college: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    eventSnapshot: {
      name: { type: String, required: true },
      date: { type: Date, required: true },
      organizer: { type: String, required: true },
    },

    // The PDF itself is stored inside MongoDB using GridFS (Module 3)
    file: {
      gridFsId: { type: Schema.Types.ObjectId },
      filename: { type: String },
      contentType: { type: String, default: 'application/pdf' },
      size: { type: Number },
      sha256: { type: String }, // tamper check during verification
    },

    // Email delivery tracking (Module 4)
    delivery: {
      status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      attempts: { type: Number, default: 0 },
      lastError: { type: String },
      sentAt: { type: Date },
      // When the automatic retry may try again (waits longer after each failure)
      nextAttemptAt: { type: Date },
    },
    // false = not yet copied to the public verification register in Google Sheets
    published: { type: Boolean, default: false },

    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

certificateSchema.index({ event: 1, issuedAt: -1 });
// One participation certificate per feedback (awards have no feedback, so they are left out)
certificateSchema.index({ feedback: 1 }, { unique: true, partialFilterExpression: { feedback: { $type: 'objectId' } } });
certificateSchema.index({ 'participant.email': 1 });
certificateSchema.index({ 'participant.regNo': 1 });
certificateSchema.index({ 'delivery.status': 1 });

certificateSchema.statics.generateId = function generateId(date = new Date()) {
  const bytes = crypto.randomBytes(6);
  const code = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
  return `CF-${date.getFullYear()}-${code}`;
};

export default mongoose.model('Certificate', certificateSchema);
