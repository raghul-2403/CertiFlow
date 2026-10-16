// Issuing certificates from an uploaded attendance list (Excel/CSV), without the Google Form.
// Runs in the background so a long list doesn't time out; the page polls for progress.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Certificate, Event, Feedback, getSetting } from '../models/index.js';
import { issueCertificate, deliverCertificate } from './certificateService.js';
import { mailMode } from './mailer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const jobs = new Map();

/** Marks each row as ready or skipped (with the reason), before anything is issued */
export async function checkPeople(event, people) {
  const existing = new Set(
    (await Feedback.find({ event: event._id }, 'participant.regNo').lean()).map((f) => f.participant.regNo)
  );
  const seen = new Set();
  return people.map((p) => {
    let skip = null;
    if (!p.regNo) skip = 'No register number';
    else if (!p.name) skip = 'No name';
    else if (!EMAIL_RE.test(p.email || '')) skip = p.email ? 'Email looks wrong' : 'No email';
    else if (existing.has(p.regNo)) skip = 'Already has a certificate for this event';
    else if (seen.has(p.regNo)) skip = 'Listed twice in the file';
    seen.add(p.regNo);
    return { ...p, status: skip ? 'skip' : 'ready', reason: skip };
  });
}

export async function emailsLeftToday() {
  if (mailMode() === 'smtp') return null; // SMTP limits are the provider's, not Gmail's
  const [quota, at] = await Promise.all([getSetting('google.emailQuota'), getSetting('google.emailQuotaAt')]);
  if (quota == null) return null;
  // Gmail's count resets daily; an old reading is only a rough guide
  const fresh = at && Date.now() - new Date(at).getTime() < 24 * 3600 * 1000;
  return fresh ? Number(quota) : null;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function startBulkIssue(event, people) {
  const running = [...jobs.values()].find((j) => j.eventId === String(event._id) && j.status === 'running');
  if (running) return running;
  const job = {
    id: crypto.randomBytes(8).toString('hex'),
    eventId: String(event._id),
    status: 'running',
    total: people.length,
    done: 0,
    issued: 0,
    emailed: 0,
    emailWaiting: 0,
    skipped: [],
    startedAt: new Date(),
  };
  jobs.set(job.id, job);
  run(job, people).catch((err) => {
    job.status = 'failed';
    job.error = err.message;
  });
  // forget finished jobs after an hour
  setTimeout(() => jobs.delete(job.id), 60 * 60 * 1000).unref();
  return job;
}

async function run(job, people) {
  let quotaHit = false;
  for (const p of people) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const event = await Event.findById(job.eventId);
      if (!event) throw new Error('Event was deleted');
      // eslint-disable-next-line no-await-in-loop
      const feedback = await Feedback.create({
        event: event._id,
        source: 'excel',
        participant: { name: p.name, regNo: p.regNo, college: p.college || '-', email: p.email },
        submittedAt: new Date(),
      });
      // eslint-disable-next-line no-await-in-loop
      await Event.updateOne({ _id: event._id }, { $inc: { 'stats.feedbackCount': 1 } });
      // eslint-disable-next-line no-await-in-loop
      const cert = await issueCertificate(feedback);
      job.issued += 1;
      if (quotaHit) {
        // Gmail's daily limit was reached: the sync loop sends these automatically later
        cert.delivery.status = 'failed';
        cert.delivery.lastError = "Gmail's daily email limit is reached. CertiFlow will send it automatically later.";
        cert.delivery.nextAttemptAt = new Date(Date.now() + 3 * 3600 * 1000);
        // eslint-disable-next-line no-await-in-loop
        await cert.save();
        job.emailWaiting += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        const sent = await deliverCertificate(cert);
        if (sent.delivery.status === 'sent') job.emailed += 1;
        else job.emailWaiting += 1;
        if (sent.$locals.quotaHit) quotaHit = true;
      }
    } catch (err) {
      const reason = err?.code === 11000 ? 'Already has a certificate for this event'
        : err instanceof mongoose.Error.ValidationError ? Object.values(err.errors).map((e) => e.message).join('; ')
          : err.message;
      job.skipped.push({ row: p.row, name: p.name, regNo: p.regNo, reason });
    }
    job.done += 1;
  }
  job.status = 'done';
  job.finishedAt = new Date();
  return job;
}

export const certificateCount = (eventId) => Certificate.countDocuments({ event: eventId, kind: { $ne: 'award' } });
