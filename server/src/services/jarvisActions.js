
import {
  Event,
  Feedback,
  Certificate,
  nameKeyOf,
} from '../models/index.js';

import { JarvisAction } from '../models/JarvisAction.js';

function parseIndiaDate(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute] =
    match.map(Number);

  const calendarDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      330 * 60 * 1000
  );
}

function tidy(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
}

function result(message, extra = {}) {
  return { success: false, message, ...extra };
}

// Only recognize explicit, narrowly defined edit commands.
// General questions never modify the database.
export function parseEventEditCommand(message) {
  const text = String(message || '').trim();

  if (
    /^(?:confirm rename|confirm event rename)$/i.test(text)
  ) {
    return { type: 'confirm-rename' };
  }

  if (
    /^(?:cancel rename|cancel event rename)$/i.test(text)
  ) {
    return { type: 'cancel-rename' };
  }

  let match = text.match(
    /^(?:jarvis[,:\s]*)?(?:please\s+)?rename\s+(?:the\s+)?(?:event\s+)?(.+?)\s+to\s+(.+?)\s*[.!]?$/i
  );

  if (!match) {
    match = text.match(
      /^(?:jarvis[,:\s]*)?(?:please\s+)?(?:change|update|set)\s+the\s+(?:event\s+)?name\s+(?:of|for|from)\s+(.+?)\s+to\s+(.+?)\s*[.!]?$/i
    );
  }

  if (match) {
    return {
      type: 'rename',
      eventName: tidy(match[1]),
      value: tidy(match[2]),
    };
  }

  match = text.match(
    /^(?:jarvis[,:\s]*)?(?:please\s+)?(?:change|update|set)\s+the\s+(venue|description)\s+(?:of|for)\s+(?:the\s+event\s+)?(.+?)\s+to\s+(.+?)\s*[.!]?$/i
  );

  if (match) {
    return {
      type: match[1].toLowerCase(),
      eventName: tidy(match[2]),
      value: tidy(match[3]),
    };
  }

  return null;
}

async function findExactEvent(name) {
  return Event.findOne({
    nameKey: nameKeyOf(name),
  });
}

// Preserve existing autonomous event creation.
export async function createJarvisEvent({
  draft,
  admin,
  instruction,
}) {
  if (!admin?._id) {
    return result('An authenticated coordinator is required.');
  }

  const name = tidy(draft?.name).replace(/\s+/g, ' ');
  const organizer = tidy(draft?.organizer);
  const venue = tidy(draft?.venue);
  const description = String(
    draft?.description || ''
  ).trim();
  const date = parseIndiaDate(draft?.date);

  if (!name || name.length > 150 || !organizer || !date) {
    return result(
      'Event name, organizer, and valid date/time are required.'
    );
  }

  if (
    organizer.length > 200 ||
    venue.length > 200 ||
    description.length > 2000
  ) {
    return result('One or more event fields are too long.');
  }

  if (
    await Event.exists({
      nameKey: nameKeyOf(name),
    })
  ) {
    return result(
      `An event named "${name}" already exists.`,
      { duplicate: true }
    );
  }

  const action = await JarvisAction.create({
    admin: admin._id,
    action: 'event.create',
    status: 'started',
    instruction: String(instruction || '').slice(0, 2000),
    details: {
      name,
      organizer,
      venue,
      date: draft.date,
    },
  });

  try {
    const event = await Event.create({
      name,
      organizer,
      venue,
      description,
      date,
      createdBy: admin._id,
      feedbackOpen: false,
      certificate: {
        title: 'Certificate of Participation',
        signatories: [],
      },
    });

    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'completed',
      event: event._id,
    }).catch(error => {
      console.error('J.A.R.V.I.S. audit error:', error.message);
    });

    return {
      success: true,
      event: {
        id: String(event._id),
        name: event.name,
        organizer: event.organizer,
        venue: event.venue,
        date: draft.date,
        feedbackOpen: event.feedbackOpen,
      },
      message: `Event "${event.name}" created successfully.`,
    };
  } catch (error) {
    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'failed',
      error: String(error.message).slice(0, 500),
    }).catch(() => {});

    if (error.code === 11000) {
      return result(
        'An event with that name or slug already exists.',
        { duplicate: true }
      );
    }

    console.error('J.A.R.V.I.S. create error:', error.message);

    return result(
      'Could not confirm event creation. Check Events before retrying.'
    );
  }
}

// Low-risk, explicitly requested field updates.
export async function updateJarvisEvent({
  command,
  admin,
  instruction,
}) {
  if (!admin?._id) {
    return result('Please log in before editing events.');
  }

  if (!['venue', 'description'].includes(command?.type)) {
    return result('This automatic update is not permitted.');
  }

  const event = await findExactEvent(command.eventName);

  if (!event) {
    return result(
      `I could not find an event named "${command.eventName}". ` +
      'Use the exact event name from List my events.'
    );
  }

  const field = command.type;
  const value = tidy(command.value);
  const limit = field === 'venue' ? 200 : 2000;

  if (!value || value.length > limit) {
    return result(`Enter a valid ${field} (maximum ${limit} characters).`);
  }

  const oldValue = String(event[field] || '');

  if (oldValue === value) {
    return {
      success: true,
      message: `${event.name} already has that ${field}.`,
    };
  }

  const action = await JarvisAction.create({
    admin: admin._id,
    action: `event.update.${field}`,
    status: 'started',
    event: event._id,
    instruction: String(instruction || '').slice(0, 2000),
    details: { field, oldValue, newValue: value },
  });

  try {
    // Conditional update avoids silently overwriting
    // a concurrent change from another coordinator.
    const updated = await Event.findOneAndUpdate(
      { _id: event._id, [field]: event[field] },
      { $set: { [field]: value } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      await JarvisAction.findByIdAndUpdate(action._id, {
        status: 'failed',
        error: 'Event was changed concurrently.',
      });

      return result(
        'The event changed while I was editing it. Please retry.'
      );
    }

    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'completed',
    }).catch(error => {
      console.error('J.A.R.V.I.S. audit error:', error.message);
    });

    return {
      success: true,
      event: {
        id: String(updated._id),
        name: updated.name,
      },
      message:
        `Updated ${field} for "${updated.name}".\n\n` +
        `Previous: ${oldValue || 'Not specified'}\n` +
        `New: ${value}`,
    };
  } catch (error) {
    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'failed',
      error: String(error.message).slice(0, 500),
    }).catch(() => {});

    console.error('J.A.R.V.I.S. update error:', error.message);

    return result('The event update could not be confirmed.');
  }
}

// Request confirmation for renaming.
// No changes happen here.
export async function prepareJarvisRename({
  command,
  admin,
  instruction,
}) {
  const event = await findExactEvent(command.eventName);

  if (!event) {
    return result(
      `Event "${command.eventName}" was not found.`
    );
  }

  const newName = tidy(command.value)
    .replace(/\s+/g, ' ');

  if (!newName || newName.length > 150) {
    return result('The new event name must be 1–150 characters.');
  }

  if (nameKeyOf(event.name) === nameKeyOf(newName)) {
    return result('The event already has that name.');
  }

  if (
    await Event.exists({
      nameKey: nameKeyOf(newName),
      _id: { $ne: event._id },
    })
  ) {
    return result(
      `Another event already uses the name "${newName}".`
    );
  }

  // Avoid automatic rename when existing response
  // or certificate records could be affected.
  const [responses, certificates] = await Promise.all([
    Feedback.exists({ event: event._id }),
    Certificate.exists({ event: event._id }),
  ]);

  if (responses || certificates || event.feedbackOpen) {
    return result(
      'This event is live or already has responses/certificates. ' +
      'Renaming may break Google Form matching. ' +
      'Please review the rename manually in Events.'
    );
  }

  // Cancel older unconfirmed rename requests for this admin.
  await JarvisAction.updateMany(
    {
      admin: admin._id,
      action: 'event.rename',
      status: 'started',
    },
    {
      $set: {
        status: 'failed',
        error: 'Superseded by another rename request.',
      },
    }
  );

  await JarvisAction.create({
    admin: admin._id,
    action: 'event.rename',
    status: 'started',
    event: event._id,
    instruction: String(instruction || '').slice(0, 2000),
    details: {
      oldName: event.name,
      newName,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      confirmationUsed: false,
    },
  });

  return {
    success: true,
    pending: true,
    message:
      'Rename confirmation required.\n\n' +
      `Event: ${event.name}\n` +
      `New name: ${newName}\n\n` +
      'Warning: Event names affect Google Form matching.\n\n' +
      'Reply "Confirm rename" within 10 minutes to proceed, ' +
      'or "Cancel rename" to discard this change.',
  };
}

export async function confirmJarvisRename({ admin }) {
  // Claim the pending request atomically so duplicate
  // confirm messages cannot execute the same rename twice.
  const action = await JarvisAction.findOneAndUpdate(
    {
      admin: admin._id,
      action: 'event.rename',
      status: 'started',
      'details.expiresAt': { $gt: new Date() },
      'details.confirmationUsed': false,
    },
    {
      $set: { 'details.confirmationUsed': true },
    },
    { sort: { createdAt: -1 }, new: true }
  );

  if (!action) {
    return result(
      'No pending rename was found. Request the rename again.'
    );
  }

  try {
    const event = await Event.findById(action.event);

    if (
      !event ||
      event.name !== action.details.oldName ||
      event.feedbackOpen
    ) {
      throw new Error(
        'Event is missing, changed, or collecting feedback.'
      );
    }

    const [responses, certificates] = await Promise.all([
      Feedback.exists({ event: event._id }),
      Certificate.exists({ event: event._id }),
    ]);

    if (responses || certificates) {
      throw new Error(
        'Event now has responses or certificates.'
      );
    }

    const newName = action.details.newName;

    if (
      await Event.exists({
        nameKey: nameKeyOf(newName),
        _id: { $ne: event._id },
      })
    ) {
      throw new Error('The requested name is already in use.');
    }

    // Keep the existing slug stable; only name/nameKey change.
    const updated = await Event.findOneAndUpdate(
      {
        _id: event._id,
        nameKey: nameKeyOf(action.details.oldName),
        feedbackOpen: false,
      },
      {
        $set: {
          name: newName,
          nameKey: nameKeyOf(newName),
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      throw new Error('Event changed before confirmation.');
    }

    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'completed',
    }).catch(error => {
      console.error('J.A.R.V.I.S. audit error:', error.message);
    });

    return {
      success: true,
      event: {
        id: String(updated._id),
        name: updated.name,
      },
      message:
        'Event renamed successfully.\n\n' +
        `Previous: ${action.details.oldName}\n` +
        `New: ${updated.name}\n\n` +
        'The event slug remains unchanged.',
    };
  } catch (error) {
    await JarvisAction.findByIdAndUpdate(action._id, {
      status: 'failed',
      error: String(error.message).slice(0, 500),
    }).catch(() => {});

    return result(
      'Rename was not completed: ' + error.message
    );
  }
}

export async function cancelJarvisRename({ admin }) {
  const cancelled = await JarvisAction.findOneAndUpdate(
    {
      admin: admin._id,
      action: 'event.rename',
      status: 'started',
      'details.confirmationUsed': false,
    },
    {
      $set: {
        status: 'failed',
        error: 'Cancelled by coordinator.',
      },
    },
    { sort: { createdAt: -1 } }
  );

  return {
    success: true,
    message: cancelled
      ? 'Pending rename cancelled. No event was changed.'
      : 'There is no pending rename to cancel.',
  };
}
