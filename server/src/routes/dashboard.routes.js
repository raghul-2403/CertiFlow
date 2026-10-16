import { Router } from 'express';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { Event, Feedback, Certificate, SyncIssue } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assignIssueToEvent } from '../services/syncService.js';
import { ApiError } from '../utils/ApiError.js';
import { googleStatus } from './settings.routes.js';
import { emailsLeftToday } from '../services/bulkIssue.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [events, openEvents, feedback, certificates, delivery, recent, issues, upcoming, google] = await Promise.all([
    Event.countDocuments(),
    Event.countDocuments({ feedbackOpen: true }),
    Feedback.countDocuments(),
    // the pipeline counts participation certificates (awards are shown on each event)
    Certificate.countDocuments({ kind: { $ne: 'award' } }),
    Certificate.aggregate([{ $match: { kind: { $ne: 'award' } } }, { $group: { _id: '$delivery.status', n: { $sum: 1 } } }]),
    Certificate.find().sort({ issuedAt: -1 }).limit(8).lean(),
    SyncIssue.find({ status: 'open' }).sort({ createdAt: -1 }).limit(20).populate('event', 'name').lean(),
    Event.find().sort({ date: -1 }).limit(5).lean(),
    googleStatus(),
  ]);
  const byStatus = Object.fromEntries(delivery.map((d) => [d._id, d.n]));
  res.json({
    success: true,
    counts: {
      events,
      openEvents,
      feedback,
      certificates,
      emailed: byStatus.sent || 0,
      emailPending: byStatus.pending || 0,
      emailFailed: byStatus.failed || 0,
      issues: await SyncIssue.countDocuments({ status: 'open' }),
    },
    recentCertificates: recent,
    issues,
    // Gmail allows about 100 emails a day on a personal account; warn before it runs out
    email: {
      leftToday: await emailsLeftToday(),
      waitingForLimit: await Certificate.countDocuments({ status: 'active', 'delivery.status': 'failed', 'delivery.lastError': /daily email limit/i }),
    },
    events: upcoming,
    google,
    syncIntervalSec: env.syncIntervalSec,
  });
});

// Responses that need a coordinator's decision
router.post('/issues/:id/assign', async (req, res) => {
  const { eventId } = req.body || {};
  if (!mongoose.isValidObjectId(eventId)) throw ApiError.badRequest('Choose an event');
  const result = await assignIssueToEvent(req.params.id, eventId);
  if (result.status === 'not_found') throw ApiError.notFound('Response not found');
  if (result.status === 'issue') throw ApiError.badRequest(result.reason);
  res.json({ success: true, result });
});

router.post('/issues/:id/dismiss', async (req, res) => {
  const issue = await SyncIssue.findByIdAndUpdate(req.params.id, { status: 'dismissed' }, { returnDocument: 'after' });
  if (!issue) throw ApiError.notFound('Response not found');
  res.json({ success: true });
});

export default router;
