import mongoose from 'mongoose';

// A form response that couldn't be turned into a certificate automatically
// (unknown event name, duplicate submission, feedback closed, invalid data).
// Coordinators see these on the dashboard and can assign them to an event or dismiss them.
const syncIssueSchema = new mongoose.Schema(
  {
    formResponseId: { type: String, required: true, unique: true },
    reason: { type: String, required: true },
    code: {
      type: String,
      enum: ['unknown_event', 'duplicate', 'feedback_closed', 'invalid', 'error', 'not_registered', 'wrong_code'],
      required: true,
    },
    answers: { type: mongoose.Schema.Types.Mixed },
    // the event it matched, for checks that failed after the event was found
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    submittedAt: { type: Date },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  },
  { timestamps: true }
);

syncIssueSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SyncIssue', syncIssueSchema);
