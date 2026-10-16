// Pulls new Google Form responses, turns each into Feedback → Certificate → Email.
// Runs every SYNC_INTERVAL_SEC seconds and on demand ("Check for responses now").
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Certificate, Event, Feedback, Registration, SyncIssue, getSetting, setSetting, nameKeyOf } from '../models/index.js';
import { fetchFormInfo, fetchResponses, publishRecords, LATEST_SCRIPT_VERSION } from './googleBridge.js';
import { codeMatches } from './eventCode.js';
import { issueCertificate, deliverCertificate, retryPendingDeliveries } from './certificateService.js';

const OVERLAP_MS = 1000;
const MAX_PAGES = 20;

let running = false;
let timer = null;

const clean = (v) => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));

async function recordIssue(formResponseId, code, reason, answers, submittedAt, event = null) {
  await SyncIssue.updateOne(
    { formResponseId },
    { $set: { code, reason, answers, submittedAt, status: 'open', event: event?._id || null } },
    { upsert: true }
  );
  return { status: 'issue', code, reason };
}

// Turns one form response into a feedback + certificate + email.
// `forceEventId` is used when a coordinator assigns an unmatched response to an event.
export async function processResponse({ id, submittedAt, answers = {} }, { forceEventId } = {}) {
  if (await Feedback.exists({ formResponseId: id })) return { status: 'already_processed' };

  const event = forceEventId
    ? await Event.findById(forceEventId)
    : await Event.findOne({ nameKey: nameKeyOf(answers.eventName) });

  if (!event) {
    return recordIssue(id, 'unknown_event', `No event named "${clean(answers.eventName)}"`, answers, submittedAt);
  }
  if (!event.feedbackOpen && !forceEventId) {
    return recordIssue(id, 'feedback_closed', `Feedback is closed for "${event.name}"`, answers, submittedAt, event);
  }

  // Attendance checks. A coordinator approving the response from the inbox (forceEventId) skips them.
  if (!forceEventId && event.access?.codeRequired && !codeMatches(event, answers.code, submittedAt)) {
    const typed = clean(answers.code);
    return recordIssue(id, 'wrong_code',
      typed ? `Event code "${typed}" is not the code shown at "${event.name}"` : `No event code entered for "${event.name}"`,
      answers, submittedAt, event);
  }
  if (!forceEventId && event.access?.registeredOnly) {
    const regNo = clean(answers.regNo).toUpperCase();
    if (!regNo || !(await Registration.exists({ event: event._id, regNo }))) {
      return recordIssue(id, 'not_registered', `Register number ${regNo || '(empty)'} is not on the registered list for "${event.name}"`,
        answers, submittedAt, event);
    }
  }

  let feedback;
  try {
    feedback = await Feedback.create({
      event: event._id,
      participant: {
        name: clean(answers.name),
        regNo: clean(answers.regNo),
        college: clean(answers.college),
        email: clean(answers.email),
      },
      rating: Number(answers.rating),
      review: clean(answers.review),
      comments: clean(answers.comments) || undefined,
      eventCode: clean(answers.code) || undefined,
      formResponseId: id,
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
    });
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.formResponseId) return { status: 'already_processed' };
    if (err?.code === 11000) {
      return recordIssue(id, 'duplicate',
        `Register number ${clean(answers.regNo).toUpperCase()} already submitted feedback for "${event.name}"`,
        answers, submittedAt, event);
    }
    if (err instanceof mongoose.Error.ValidationError) {
      const msg = Object.values(err.errors).map((e) => e.message).join('; ');
      return recordIssue(id, 'invalid', msg, answers, submittedAt, event);
    }
    throw err;
  }

  await Event.updateOne({ _id: event._id }, { $inc: { 'stats.feedbackCount': 1 } });
  await SyncIssue.updateOne({ formResponseId: id }, { $set: { status: 'resolved' } });

  const cert = await issueCertificate(feedback);
  const delivered = await deliverCertificate(cert);
  return { status: 'issued', certificateId: cert.certificateId, delivery: delivered.delivery.status };
}

const maskRegNo = (reg) => (reg.length > 4 ? `${'•'.repeat(reg.length - 4)}${reg.slice(-4)}` : reg);
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Copies new or changed certificates to the Google Sheet register behind the public verify page
async function publishRegister(scriptUrl) {
  if (!(await getSetting('google.verifySupported'))) return 0;
  let published = 0;
  for (let round = 0; round < 10; round += 1) {
    // eslint-disable-next-line no-await-in-loop
    const certs = await Certificate.find({ published: { $ne: true } }).sort({ issuedAt: 1 }).limit(100).lean();
    if (!certs.length) break;
    // eslint-disable-next-line no-await-in-loop
    await publishRecords(scriptUrl, certs.map((c) => ({
      certificateId: c.certificateId,
      name: c.participant.name,
      regNo: maskRegNo(c.participant.regNo),
      college: c.participant.college,
      event: c.kind === 'award' && c.award?.title ? `${c.eventSnapshot.name} (${c.award.title})` : c.eventSnapshot.name,
      eventDate: fmt(c.eventSnapshot.date),
      organizer: c.eventSnapshot.organizer,
      issuedAt: fmt(c.issuedAt),
      status: c.status,
    })));
    // eslint-disable-next-line no-await-in-loop
    await Certificate.updateMany({ _id: { $in: certs.map((c) => c._id) } }, { $set: { published: true } });
    published += certs.length;
  }
  return published;
}

export async function runSync() {
  if (running) return { skipped: true, reason: 'A sync is already running' };
  running = true;
  const summary = { fetched: 0, issued: 0, issues: 0, alreadyProcessed: 0, emailRetries: 0, startedAt: new Date() };

  try {
    const scriptUrl = await getSetting('google.scriptUrl');
    if (!scriptUrl) return { skipped: true, reason: 'Google Form not connected' };

    // Notice when the coordinator updates the Google script (checked every 10 minutes)
    if (!(await getSetting('google.verifySupported')) || Number(await getSetting('google.scriptVersion', 1)) < LATEST_SCRIPT_VERSION) {
      const lastCheck = await getSetting('google.infoCheckedAt');
      if (!lastCheck || Date.now() - new Date(lastCheck).getTime() > 10 * 60 * 1000) {
        await setSetting('google.infoCheckedAt', new Date().toISOString());
        const info = await fetchFormInfo(scriptUrl).catch(() => null);
        if (info) {
          await setSetting('google.scriptVersion', info.version || 1);
          await setSetting('google.verifySupported', Boolean(info.verify));
          await setSetting('google.registerUrl', info.registerUrl || null);
        }
      }
    }

    let since = await getSetting('google.lastResponseAt', new Date(0).toISOString());
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const sinceIso = new Date(new Date(since).getTime() - OVERLAP_MS).toISOString();
      // eslint-disable-next-line no-await-in-loop
      const data = await fetchResponses(scriptUrl, sinceIso);
      summary.fetched += data.responses.length;

      for (const response of data.responses) {
        // eslint-disable-next-line no-await-in-loop
        const known = await SyncIssue.exists({ formResponseId: response.id });
        let result;
        if (known) result = { status: 'already_processed' };
        // eslint-disable-next-line no-await-in-loop
        else result = await processResponse(response);

        if (result.status === 'issued') summary.issued += 1;
        else if (result.status === 'issue') summary.issues += 1;
        else summary.alreadyProcessed += 1;

        if (response.submittedAt > since) since = response.submittedAt;
      }
      // eslint-disable-next-line no-await-in-loop
      await setSetting('google.lastResponseAt', since);
      if (!data.hasMore) break;
    }

    const retry = await retryPendingDeliveries();
    summary.emailRetries = retry.tried;
    summary.published = await publishRegister(scriptUrl);

    await setSetting('google.lastSyncAt', new Date().toISOString());
    await setSetting('google.lastSyncError', null);
    await setSetting('google.lastSyncSummary', summary);
    return summary;
  } catch (err) {
    await setSetting('google.lastSyncAt', new Date().toISOString());
    await setSetting('google.lastSyncError', err.message);
    return { ...summary, error: err.message };
  } finally {
    running = false;
  }
}

export async function assignIssueToEvent(issueId, eventId) {
  const issue = await SyncIssue.findById(issueId);
  if (!issue) return { status: 'not_found' };
  const result = await processResponse(
    { id: issue.formResponseId, submittedAt: issue.submittedAt, answers: issue.answers },
    { forceEventId: eventId }
  );
  return result;
}

// Responses that arrived before the event was created are picked up automatically
export async function adoptWaitingResponses(event) {
  const waiting = await SyncIssue.find({ status: 'open', code: 'unknown_event' }).lean();
  let adopted = 0;
  for (const issue of waiting) {
    if (nameKeyOf(issue.answers?.eventName) !== event.nameKey) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await processResponse({ id: issue.formResponseId, submittedAt: issue.submittedAt, answers: issue.answers });
    if (r.status === 'issued') adopted += 1;
  }
  return adopted;
}

// After the registered list is uploaded or a check is switched off, responses that were held back
// for this event are checked again and issued if they now pass.
export async function recheckHeldResponses(event) {
  const held = await SyncIssue.find({ status: 'open', event: event._id, code: { $in: ['not_registered', 'wrong_code'] } }).lean();
  let issued = 0;
  for (const issue of held) {
    // eslint-disable-next-line no-await-in-loop
    const r = await processResponse({ id: issue.formResponseId, submittedAt: issue.submittedAt, answers: issue.answers });
    if (r.status === 'issued') issued += 1;
  }
  return issued;
}

export function startSyncLoop() {
  if (timer) return;
  const tick = async () => {
    const r = await runSync();
    if (r.issued || r.issues) console.log(`[sync] ${r.issued} certificate(s) issued, ${r.issues} need attention`);
    if (r.error) console.warn('[sync] error:', r.error);
  };
  timer = setInterval(tick, env.syncIntervalSec * 1000);
  timer.unref();
  setTimeout(tick, 3000).unref();
}

export function stopSyncLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

export const isSyncRunning = () => running;
