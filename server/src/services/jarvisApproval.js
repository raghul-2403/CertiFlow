
import bcrypt from 'bcryptjs';

import {
  Event,
  Feedback,
  Certificate,
  nameKeyOf,
} from '../models/index.js';

import { JarvisAction } from '../models/JarvisAction.js';

const MAX_ATTEMPTS = 5;

function denied(remaining = null) {
  return {
    approved: false,
    reply: 'Access denied',
    attemptsRemaining: remaining,
  };
}

export async function getPendingRename(adminId) {
  return JarvisAction.findOne({
    admin: adminId,
    action: 'event.rename',
    status: 'started',
    'details.expiresAt': { $gt: new Date() },
    'details.confirmationUsed': false,
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function authorizeRename({
  admin,
  actionId,
  accessKey,
}) {
  // Only authenticated administrators may authorize
  // a sensitive database operation.
  if (admin?.role !== 'admin' || !admin?._id) {
    return denied();
  }

  if (
    typeof actionId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(actionId)
  ) {
    return denied();
  }

  if (
    typeof accessKey !== 'string' ||
    !accessKey ||
    accessKey.length > 256
  ) {
    return denied();
  }

  const hash = process.env.JARVIS_ACCESS_KEY_HASH;

  if (
    !hash ||
    !/^\$2[aby]\$\d\d\$/.test(hash)
  ) {
    return {
      approved: false,
      reply: 'Access-key verification is not configured.',
      configurationError: true,
    };
  }

  // Count attempts atomically in MongoDB.
  const action = await JarvisAction.findOneAndUpdate(
    {
      _id: actionId,
      admin: admin._id,
      action: 'event.rename',
      status: 'started',
      'details.expiresAt': { $gt: new Date() },
      'details.confirmationUsed': false,
      $or: [
        {
          'details.accessAttempts': {
            $exists: false,
          },
        },
        {
          'details.accessAttempts': {
            $lt: MAX_ATTEMPTS,
          },
        },
      ],
    },
    {
      $inc: {
        'details.accessAttempts': 1,
      },
    },
    {
      new: true,
    }
  );

  if (!action) {
    return denied(0);
  }

  // Compare against the stored hash.
  // Never send accessKey to Gemini or Groq.
  const correct = await bcrypt.compare(accessKey, hash);

  if (!correct) {
    const remaining = Math.max(
      0,
      MAX_ATTEMPTS -
        (action.details?.accessAttempts || 0)
    );

    if (remaining === 0) {
      await JarvisAction.updateOne(
        {
          _id: action._id,
          status: 'started',
        },
        {
          $set: {
            status: 'failed',
            error: 'Access-key attempts exceeded.',
          },
        }
      );
    }

    return denied(remaining);
  }

  // Claim the pending rename exactly once.
  const claimed = await JarvisAction.findOneAndUpdate(
    {
      _id: action._id,
      admin: admin._id,
      status: 'started',
      'details.expiresAt': { $gt: new Date() },
      'details.confirmationUsed': false,
    },
    {
      $set: {
        'details.confirmationUsed': true,
      },
    },
    {
      new: true,
    }
  );

  if (!claimed) {
    return denied(0);
  }

  try {
    const event = await Event.findById(claimed.event);

    const oldName = claimed.details?.oldName;
    const newName = claimed.details?.newName;

    if (
      !event ||
      !oldName ||
      !newName ||
      event.name !== oldName ||
      event.feedbackOpen
    ) {
      throw new Error(
        'Event changed or feedback is currently open.'
      );
    }

    // Recheck event safety immediately before updating.
    const [
      hasFeedback,
      hasCertificates,
      duplicate,
    ] = await Promise.all([
      Feedback.exists({
        event: event._id,
      }),
      Certificate.exists({
        event: event._id,
      }),
      Event.exists({
        nameKey: nameKeyOf(newName),
        _id: {
          $ne: event._id,
        },
      }),
    ]);

    if (
      hasFeedback ||
      hasCertificates ||
      duplicate
    ) {
      throw new Error(
        'Rename is unsafe because the event has responses, certificates, or a duplicate name.'
      );
    }

    // Update only the event name and nameKey.
    // Preserve the existing URL slug.
    const updated = await Event.findOneAndUpdate(
      {
        _id: event._id,
        nameKey: nameKeyOf(oldName),
        feedbackOpen: false,
      },
      {
        $set: {
          name: newName,
          nameKey: nameKeyOf(newName),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      throw new Error(
        'Event changed before the operation completed.'
      );
    }

    await JarvisAction.updateOne(
      {
        _id: claimed._id,
      },
      {
        $set: {
          status: 'completed',
        },
      }
    );

    return {
      approved: true,
      reply: 'Access Approved',
      result:
        `Renamed "${oldName}" to "${updated.name}". ` +
        'The event slug was not changed.',
      eventId: String(updated._id),
    };
  } catch (error) {
    await JarvisAction.updateOne(
      {
        _id: claimed._id,
      },
      {
        $set: {
          status: 'failed',
          error: String(error.message).slice(0, 500),
        },
      }
    ).catch(() => {});

    return {
      approved: false,
      reply: 'Access denied',
      result:
        `The operation was not completed: ${error.message}`,
      executionFailed: true,
    };
  }
}
