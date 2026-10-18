
import mongoose from 'mongoose';

const actionSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['started', 'completed', 'failed'],
      default: 'started',
    },
    instruction: {
      type: String,
      maxlength: 2000,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  { timestamps: true }
);

export const JarvisAction =
  mongoose.models.JarvisAction ||
  mongoose.model('JarvisAction', actionSchema);
