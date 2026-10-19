
import mongoose from 'mongoose';

const { Schema } = mongoose;

const messageSchema = new Schema(
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

// Phase 2A: persistent, structured conversational context.
const contextSchema = new Schema(
  {
    lastEventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },

    lastEventName: {
      type: String,
      default: '',
      maxlength: 150,
    },

    lastTool: {
      type: String,
      default: '',
      maxlength: 80,
    },

    updatedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const conversationSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      unique: true,
      index: true,
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    context: {
      type: contextSchema,
      default: () => ({}),
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
