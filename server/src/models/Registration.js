import mongoose from 'mongoose';

// A student on an event's registered list (uploaded from Excel/CSV).
// When the event is set to "registered students only", a form response is matched
// to this list by register number before a certificate is issued.
const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    regNo: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    college: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

registrationSchema.index({ event: 1, regNo: 1 }, { unique: true });

export default mongoose.model('Registration', registrationSchema);
