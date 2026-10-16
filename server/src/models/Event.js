import mongoose from 'mongoose';

const { Schema } = mongoose;

export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const signatorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true }, // e.g. "HOD, CSE"
  },
  { _id: false }
);

const eventSchema = new Schema(
  {
    name: { type: String, required: [true, 'Event name is required'], trim: true, maxlength: 150 },
    // Lower-cased name: used to match the "Event Name" answer in the Google Form.
    // Unique so two events can't share a name (the form couldn't tell them apart).
    nameKey: { type: String, unique: true },
    // URL-safe id used in QR links and to match Google Form answers to this event
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 2000 },
    organizer: { type: String, required: [true, 'Organizer (club/department) is required'], trim: true },
    venue: { type: String, trim: true },
    date: { type: Date, required: [true, 'Event date is required'] },

    // Optional custom form link. When empty, the QR uses the connected Google Form
    // with this event's name already filled in.
    formUrl: { type: String, trim: true },
    // When false, new submissions are rejected and no certificates are issued
    feedbackOpen: { type: Boolean, default: true },

    // Attendance check: who may get a certificate automatically.
    // Responses that fail a check wait in the issues inbox for the coordinator to approve.
    access: {
      // only register numbers on the uploaded list (Registration collection)
      registeredOnly: { type: Boolean, default: false },
      // participants must type the code shown on the projector (changes every few minutes)
      codeRequired: { type: Boolean, default: false },
      codeSecret: { type: String },
      codeMinutes: { type: Number, default: 5, min: 1, max: 60 },
    },

    certificate: {
      title: { type: String, default: 'Certificate of Participation', trim: true },
      signatories: { type: [signatorySchema], default: [] },
      // mode 'builtin' = CertiFlow's own layout; 'image' = the club's own design with text placed on it
      design: {
        mode: { type: String, enum: ['builtin', 'image'], default: 'builtin' },
        preset: { type: String },
        templateFileId: { type: Schema.Types.ObjectId },
        contentType: { type: String },
        imageWidth: { type: Number },
        imageHeight: { type: Number },
        fields: { type: Schema.Types.Mixed },
      },
    },

    // Denormalised counters for the dashboard, updated as feedback/certs arrive
    stats: {
      feedbackCount: { type: Number, default: 0, min: 0 },
      certificatesIssued: { type: Number, default: 0, min: 0 },
      awardsIssued: { type: Number, default: 0, min: 0 },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

// Auto-generate the slug from the name if the admin didn't set one
export const nameKeyOf = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

eventSchema.pre('validate', function setDerivedFields() {
  if (this.name) {
    this.name = this.name.trim().replace(/\s+/g, ' ');
    this.nameKey = nameKeyOf(this.name);
  }
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

eventSchema.index({ date: -1 });

export default mongoose.model('Event', eventSchema);
