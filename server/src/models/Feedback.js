import mongoose from 'mongoose';

const { Schema } = mongoose;

// Must match the choice labels used in the Google Form exactly
export const REVIEW_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fromForm() {
  return this.source === 'google_form';
}

// One document = one Google Form submission from one participant for one event
const feedbackSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },

    participant: {
      name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
      regNo: { type: String, required: [true, 'Register number is required'], trim: true, uppercase: true, maxlength: 40 },
      college: { type: String, required: [true, 'College name is required'], trim: true, maxlength: 200 },
      email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [EMAIL_REGEX, 'Invalid email address'],
      },
    },

    // Review section of the form (not asked when certificates are issued from an Excel list)
    rating: { type: Number, required: [fromForm, 'Rating is required'], min: 1, max: 5 },
    review: { type: String, required: [fromForm, 'Review option is required'], enum: REVIEW_OPTIONS },
    comments: { type: String, trim: true, maxlength: 1000 },

    // google_form = scanned the QR; excel = issued from an uploaded attendance list
    source: { type: String, enum: ['google_form', 'manual', 'excel'], default: 'google_form' },
    // what the participant typed as the event code (when the event asks for one)
    eventCode: { type: String, trim: true, maxlength: 20 },
    // Google's response id — stops the same submission being processed twice
    formResponseId: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },

    // Filled in once the certificate is generated (Module 3)
    certificate: { type: Schema.Types.ObjectId, ref: 'Certificate' },
  },
  { timestamps: true }
);

// One feedback (and so one certificate) per register number per event
feedbackSchema.index({ event: 1, 'participant.regNo': 1 }, { unique: true });
feedbackSchema.index({ formResponseId: 1 }, { unique: true, sparse: true });
feedbackSchema.index({ 'participant.email': 1 });

export default mongoose.model('Feedback', feedbackSchema);
