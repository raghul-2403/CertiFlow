
import {
  Event,
  Feedback,
  Certificate,
  SyncIssue,
} from '../models/index.js';

const EVENT_WORDS =
  /\b(summarize|summary|results?|statistics|stats|feedback|certificates?|emailed|pending|failed|ratings?)\b/i;

const LIST_EVENTS =
  /\b(list|show|display|what are)\b.*\bevents\b|\bmy events\b/i;

const clean = value =>
  String(value || '').trim().toLowerCase();

function formatDate(value) {
  if (!value) return 'Not specified';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not specified';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

async function eventSummary(event) {
  const filter = {
    event: event._id,
    status: 'active',
    kind: { $ne: 'award' },
  };

  const [
    feedbackCount,
    issued,
    emailed,
    pending,
    failed,
    issues,
    ratings,
  ] = await Promise.all([
    Feedback.countDocuments({ event: event._id }),
    Certificate.countDocuments(filter),
    Certificate.countDocuments({
      ...filter,
      'delivery.status': 'sent',
    }),
    Certificate.countDocuments({
      ...filter,
      'delivery.status': 'pending',
    }),
    Certificate.countDocuments({
      ...filter,
      'delivery.status': 'failed',
    }),
    SyncIssue.countDocuments({
      event: event._id,
      status: 'open',
    }),
    Feedback.aggregate([
      {
        $match: {
          event: event._id,
          rating: { $gte: 1, $lte: 5 },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          average: { $avg: '$rating' },
        },
      },
    ]),
  ]);

  const rating = ratings[0];
  const average = rating
    ? rating.average.toFixed(2)
    : 'No ratings yet';

  const deliveryRate = issued > 0
    ? ((emailed / issued) * 100).toFixed(1)
    : 'N/A';

  return [
    `EVENT SUMMARY: ${event.name}`,
    '',
    `Date: ${formatDate(event.date)}`,
    `Organizer: ${event.organizer || 'Not specified'}`,
    '',
    `Feedback received: ${feedbackCount}`,
    `Certificates issued: ${issued}`,
    `Certificates emailed: ${emailed}`,
    `Email pending: ${pending}`,
    `Email failed: ${failed}`,
    `Email delivery rate: ${
      deliveryRate === 'N/A' ? 'N/A' : `${deliveryRate}%`
    }`,
    `Average feedback rating: ${average}`,
    `Open synchronization issues: ${issues}`,
    '',
    issued === 0
      ? 'No active participation certificates have been issued yet.'
      : failed > 0
        ? 'Attention: Some certificate email deliveries failed.'
        : pending > 0
          ? 'Some certificate emails are still pending.'
          : emailed === issued
            ? 'All active participation certificates are marked as emailed.'
            : 'Some issued certificates have another delivery status.',
    '',
    'These results come from CertiFlow records.',
  ].join('\n');
}

export async function answerEventQuestion(message) {
  const question = clean(message);

  if (!question) return null;

  // Read only the event fields needed for this feature.
  const events = await Event.find()
    .select('name date organizer')
    .sort({ date: -1 })
    .lean();

  if (LIST_EVENTS.test(question)) {
    if (!events.length) {
      return 'There are no events in CertiFlow yet.';
    }

    const lines = events.slice(0, 30).map((event, index) =>
      `${index + 1}. ${event.name} — ${formatDate(event.date)}`
    );

    return [
      `CertiFlow has ${events.length} event(s).`,
      '',
      ...lines,
      ...(events.length > 30
        ? ['Only the 30 most recent events are shown.']
        : []),
      '',
      'Ask me to summarize an event by its name.',
    ].join('\n');
  }

  if (!EVENT_WORDS.test(question)) {
    return null;
  }

  // Match actual stored event names, not AI-generated names.
  const matches = events.filter(event =>
    question.includes(clean(event.name))
  );

  if (matches.length === 0) {
    return [
      'Which event would you like me to analyze?',
      '',
      'For example: Summarize DEMO-1',
      'Or type: List my events',
    ].join('\n');
  }

  // Prefer the most specific matching name.
  matches.sort((a, b) => b.name.length - a.name.length);

  const event = matches[0];

  // Avoid confusion if multiple distinct names match.
  const ambiguous = matches.filter(
    candidate =>
      candidate._id.toString() !== event._id.toString() &&
      candidate.name.length === event.name.length
  );

  if (ambiguous.length) {
    return [
      'Multiple events match your question.',
      'Please use the full event name:',
      ...[event, ...ambiguous].map(e => `- ${e.name}`),
    ].join('\n');
  }

  return eventSummary(event);
}
