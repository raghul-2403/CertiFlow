
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 8000,
    },
    provider: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

const conversationSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      unique: true,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const JarvisConversation =
  mongoose.models.JarvisConversation ||
  mongoose.model(
    'JarvisConversation',
    conversationSchema
  );
