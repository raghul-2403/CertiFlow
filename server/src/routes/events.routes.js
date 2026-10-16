import express, { Router } from 'express';
import mongoose from 'mongoose';
import { designedQrSvg, svgDataUrl } from '../services/qrDesign.js';
import { orgLogo } from '../services/orgService.js';
import { Event, Feedback, Certificate, Registration, SyncIssue, REVIEW_OPTIONS, getSettings, nameKeyOf } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { prefilledFormUrl } from '../services/googleBridge.js';
import { adoptWaitingResponses, recheckHeldResponses } from '../services/syncService.js';
import { currentCode, newCodeSecret } from '../services/eventCode.js';
import { AWARD_TYPES, buildAward } from '../services/awards.js';
import { deliverCertificate, issueAwardCertificate, renderForEvent } from '../services/certificateService.js';
import { readPeopleSheet } from '../utils/sheet.js';
import { checkPeople, emailsLeftToday, getJob, startBulkIssue } from '../services/bulkIssue.js';
import { renderEventReport } from '../services/reportPdf.js';
import { applyPreset } from '../services/designService.js';
import { deleteTemplate } from '../services/gridfs.js';
import { ApiError } from '../utils/ApiError.js';
import { toCsv } from '../utils/csv.js';

const router = Router();
router.use(requireAuth);

const EDITABLE = ['name', 'description', 'organizer', 'venue', 'date', 'formUrl', 'feedbackOpen', 'certificate'];

function pickEditable(body = {}) {
  const out = {};
  for (const key of EDITABLE) if (body[key] !== undefined) out[key] = body[key];
  if (out.certificate) {
    out.certificate = {
      title: String(out.certificate.title || 'Certificate of Participation').trim(),
      signatories: (out.certificate.signatories || [])
        .filter((s) => s && String(s.name || '').trim() && String(s.designation || '').trim())
        .slice(0, 3)
        .map((s) => ({ name: String(s.name).trim(), designation: String(s.designation).trim() })),
    };
  }
  return out;
}

async function formLinkFor(event) {
  if (event.formUrl) return event.formUrl;
  const g = await getSettings(['google.formUrl', 'google.eventEntryId']);
  return prefilledFormUrl(g['google.formUrl'], g['google.eventEntryId'], event.name);
}

async function findEvent(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Event not found');
  const event = await Event.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

// How many certificates of each event have been emailed
async function emailedCounts(eventIds) {
  const rows = await Certificate.aggregate([
    { $match: { event: { $in: eventIds }, status: 'active', kind: { $ne: 'award' }, 'delivery.status': 'sent' } },
    { $group: { _id: '$event', n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
}

router.get('/meta/award-types', (req, res) => {
  res.json({ success: true, types: Object.entries(AWARD_TYPES).map(([key, t]) => ({ key, ...t })) });
});

router.get('/', async (req, res) => {
  const events = await Event.find().sort({ date: -1 }).lean();
  const emailed = await emailedCounts(events.map((e) => e._id));
  for (const e of events) e.stats.emailed = emailed[String(e._id)] || 0;
  res.json({ success: true, events });
});

router.post('/', async (req, res) => {
  const data = pickEditable(req.body);
  if (await Event.exists({ nameKey: nameKeyOf(data.name) })) {
    throw ApiError.conflict('An event with this name already exists. Event names must be unique so form answers match the right event.');
  }
  const event = await Event.create({ ...data, createdBy: req.admin._id });
  // Ready-made certificate design chosen in the New event form (applied before any certificate is made)
  if (req.body?.designPreset) {
    try {
      await applyPreset(event, req.body.designPreset);
    } catch (err) {
      await event.deleteOne();
      throw err;
    }
  }
  // When the coordinator will upload their own design next, don't issue waiting certificates yet
  const adopted = req.body?.uploadingDesign ? 0 : await adoptWaitingResponses(event);
  res.status(201).json({ success: true, event: await Event.findById(event._id).lean(), adoptedResponses: adopted });
});

router.get('/:id', async (req, res) => {
  const event = await findEvent(req.params.id);
  const emailed = (await emailedCounts([event._id]))[String(event._id)] || 0;
  const data = event.toObject();
  data.stats.emailed = emailed;
  res.json({ success: true, event: data, formLink: await formLinkFor(event) });
});

router.patch('/:id', async (req, res) => {
  const event = await findEvent(req.params.id);
  const data = pickEditable(req.body);
  if (data.name && nameKeyOf(data.name) !== event.nameKey && (await Event.exists({ nameKey: nameKeyOf(data.name) }))) {
    throw ApiError.conflict('Another event already uses this name');
  }
  // Set certificate title/signatures individually so the design settings are kept
  const { certificate, ...rest } = data;
  Object.assign(event, rest);
  if (certificate) {
    event.set('certificate.title', certificate.title);
    event.set('certificate.signatories', certificate.signatories);
  }
  await event.save();
  res.json({ success: true, event, formLink: await formLinkFor(event) });
});

router.delete('/:id', async (req, res) => {
  const event = await findEvent(req.params.id);
  if (await Certificate.exists({ event: event._id })) {
    throw ApiError.conflict('This event has issued certificates, so it cannot be deleted. Close feedback instead.');
  }
  await Feedback.deleteMany({ event: event._id });
  await Registration.deleteMany({ event: event._id });
  if (event.certificate?.design?.templateFileId) await deleteTemplate(event.certificate.design.templateFileId);
  await event.deleteOne();
  res.json({ success: true });
});

// QR code that opens the Google Form with this event's name already filled in
router.get('/:id/qr', async (req, res) => {
  const event = await findEvent(req.params.id);
  const formLink = await formLinkFor(event);
  if (!formLink) throw ApiError.conflict('Connect your Google Form in Settings first, then the QR code appears here.');
  // Coloured QR with the college logo in the middle (Settings > Organisation decides the logo)
  const logo = await orgLogo();
  const qrDataUrl = svgDataUrl(designedQrSvg(formLink, { logo: logo?.buffer, logoType: logo?.type }));
  res.json({ success: true, formLink, qrDataUrl, withLogo: Boolean(logo) });
});

// ---- Attendance check ----

const accessInfo = async (event) => ({
  registeredOnly: Boolean(event.access?.registeredOnly),
  codeRequired: Boolean(event.access?.codeRequired),
  codeMinutes: event.access?.codeMinutes || 5,
  registered: await Registration.countDocuments({ event: event._id }),
  held: await SyncIssue.countDocuments({ status: 'open', event: event._id, code: { $in: ['not_registered', 'wrong_code'] } }),
});

router.get('/:id/access', async (req, res) => {
  const event = await findEvent(req.params.id);
  const g = await getSettings(['google.scriptVersion']);
  res.json({ success: true, access: await accessInfo(event), scriptSupportsCode: Number(g['google.scriptVersion'] || 1) >= 3 });
});

router.patch('/:id/access', async (req, res) => {
  const event = await findEvent(req.params.id);
  const { registeredOnly, codeRequired, codeMinutes } = req.body || {};
  if (registeredOnly !== undefined) event.set('access.registeredOnly', Boolean(registeredOnly));
  if (codeRequired !== undefined) event.set('access.codeRequired', Boolean(codeRequired));
  if (codeMinutes !== undefined) event.set('access.codeMinutes', Math.min(60, Math.max(1, Math.round(Number(codeMinutes) || 5))));
  if (event.access.codeRequired && !event.access.codeSecret) event.set('access.codeSecret', newCodeSecret());
  if (event.access.registeredOnly && !(await Registration.exists({ event: event._id }))) {
    throw ApiError.badRequest('Upload the registered students list first, then turn this on.');
  }
  await event.save();
  // Switching a check off releases the responses it was holding back
  const released = await recheckHeldResponses(event);
  res.json({ success: true, access: await accessInfo(event), released });
});

// The code to show on the projector right now
router.get('/:id/code', async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!event.access?.codeRequired || !event.access.codeSecret) return res.json({ success: true, enabled: false });
  res.json({ success: true, enabled: true, ...currentCode(event) });
});

router.get('/:id/registrations', async (req, res) => {
  const event = await findEvent(req.params.id);
  const filter = { event: event._id };
  const q = String(req.query.search || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ regNo: rx }, { name: rx }, { email: rx }, { college: rx }];
  }
  const [items, total] = await Promise.all([
    Registration.find(filter).sort({ regNo: 1 }).limit(200).lean(),
    Registration.countDocuments({ event: event._id }),
  ]);
  const regNos = items.map((r) => r.regNo);
  const attended = new Set((await Feedback.find({ event: event._id, 'participant.regNo': { $in: regNos } }, 'participant.regNo').lean()).map((f) => f.participant.regNo));
  res.json({ success: true, total, registrations: items.map((r) => ({ ...r, attended: attended.has(r.regNo) })) });
});

// Upload the registered list (Excel .xlsx or CSV). Adds to the list; ?replace=1 replaces it.
router.post('/:id/registrations', express.raw({ type: () => true, limit: '10mb' }), async (req, res) => {
  const event = await findEvent(req.params.id);
  const { people, columns, truncated } = await readPeopleSheet(req.body);
  const valid = people.filter((p) => p.regNo);
  if (!valid.length) throw ApiError.badRequest('No register numbers found in the file');
  if (req.query.replace === '1') await Registration.deleteMany({ event: event._id });
  const ops = valid.map((p) => ({
    updateOne: {
      filter: { event: event._id, regNo: p.regNo },
      update: { $set: { name: p.name || undefined, email: p.email || undefined, college: p.college || undefined } },
      upsert: true,
    },
  }));
  const result = await Registration.bulkWrite(ops, { ordered: false });
  const released = await recheckHeldResponses(event);
  res.json({
    success: true,
    columns,
    added: result.upsertedCount,
    updated: result.matchedCount,
    skipped: people.length - valid.length,
    truncated,
    released,
    access: await accessInfo(event),
  });
});

router.delete('/:id/registrations', async (req, res) => {
  const event = await findEvent(req.params.id);
  await Registration.deleteMany({ event: event._id });
  if (event.access?.registeredOnly) {
    event.set('access.registeredOnly', false);
    await event.save();
  }
  res.json({ success: true, access: await accessInfo(event) });
});

// ---- Award certificates (winner, runner-up, appreciation) ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/:id/awards', async (req, res) => {
  const event = await findEvent(req.params.id);
  const awards = await Certificate.find({ event: event._id, kind: 'award' }).sort({ issuedAt: -1 }).lean();
  res.json({ success: true, awards });
});

// Sample of the award certificate, nothing saved
router.get('/:id/awards/preview.pdf', async (req, res) => {
  const event = await findEvent(req.params.id);
  const award = buildAward(String(req.query.type || 'first'), req.query.title);
  if (!award) throw ApiError.badRequest('Unknown award type');
  const pdf = await renderForEvent(event, {
    certificateId: `CF-${new Date().getFullYear()}-SAMPLE`,
    participant: { name: String(req.query.name || 'Sample Participant Name').slice(0, 80), regNo: '111600000000', college: 'Sample College', email: 'sample@example.com' },
    award,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${event.slug}-award-preview.pdf"`);
  res.send(pdf);
});

router.post('/:id/awards', async (req, res) => {
  const event = await findEvent(req.params.id);
  const award = buildAward(String(req.body?.type || ''), req.body?.title);
  if (!award) throw ApiError.badRequest('Choose the award');

  let participant;
  if (req.body?.feedbackId) {
    if (!mongoose.isValidObjectId(req.body.feedbackId)) throw ApiError.badRequest('Participant not found');
    const fb = await Feedback.findOne({ _id: req.body.feedbackId, event: event._id }).lean();
    if (!fb) throw ApiError.badRequest('Participant not found for this event');
    participant = { ...fb.participant };
    delete participant._id;
  } else {
    const p = req.body?.participant || {};
    participant = {
      name: String(p.name || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      regNo: String(p.regNo || '').trim().toUpperCase().slice(0, 40) || '-',
      college: String(p.college || '').trim().slice(0, 200) || '-',
      email: String(p.email || '').trim().toLowerCase(),
    };
    if (!participant.name) throw ApiError.badRequest('Enter the name for the certificate');
    if (!EMAIL_RE.test(participant.email)) throw ApiError.badRequest('Enter a valid email address');
  }
  if (await Certificate.exists({ event: event._id, kind: 'award', 'award.title': award.title, 'participant.email': participant.email, status: 'active' })) {
    throw ApiError.conflict(`${participant.name} already has the "${award.title}" award for this event`);
  }

  const cert = await issueAwardCertificate(event, { participant, award });
  const delivered = req.body?.send === false ? cert : await deliverCertificate(cert);
  res.status(201).json({ success: true, certificate: delivered });
});

// ---- Issue certificates from an Excel / CSV list ----

router.post('/:id/bulk/preview', express.raw({ type: () => true, limit: '10mb' }), async (req, res) => {
  const event = await findEvent(req.params.id);
  const { people, columns, truncated } = await readPeopleSheet(req.body);
  const rows = await checkPeople(event, people);
  res.json({
    success: true,
    columns,
    truncated,
    rows,
    ready: rows.filter((r) => r.status === 'ready').length,
    emailsLeftToday: await emailsLeftToday(),
  });
});

router.post('/:id/bulk', async (req, res) => {
  const event = await findEvent(req.params.id);
  const input = Array.isArray(req.body?.people) ? req.body.people.slice(0, 5000) : [];
  const people = (await checkPeople(event, input.map((p, i) => ({
    row: Number(p.row) || i + 1,
    name: String(p.name || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    regNo: String(p.regNo || '').replace(/\s/g, '').toUpperCase().slice(0, 40),
    email: String(p.email || '').trim().toLowerCase(),
    college: String(p.college || '').trim().slice(0, 200),
  })))).filter((p) => p.status === 'ready');
  if (!people.length) throw ApiError.badRequest('No rows are ready to issue');
  const job = startBulkIssue(event, people);
  res.status(202).json({ success: true, job });
});

router.get('/:id/bulk/:jobId', async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.eventId !== req.params.id) throw ApiError.notFound('This upload has finished or expired');
  res.json({ success: true, job });
});

router.get('/:id/feedback', async (req, res) => {
  const event = await findEvent(req.params.id);
  const feedback = await Feedback.find({ event: event._id })
    .sort({ submittedAt: -1 })
    .populate('certificate', 'certificateId delivery status')
    .lean();

  // People added from an Excel list didn't fill the form, so they have no rating
  const rated = feedback.filter((f) => f.rating);
  const ratingCounts = [1, 2, 3, 4, 5].map((r) => rated.filter((f) => f.rating === r).length);
  const reviewCounts = Object.fromEntries(REVIEW_OPTIONS.map((o) => [o, rated.filter((f) => f.review === o).length]));
  const avg = rated.length ? rated.reduce((s, f) => s + f.rating, 0) / rated.length : null;

  res.json({
    success: true,
    feedback,
    analytics: {
      total: feedback.length,
      rated: rated.length,
      averageRating: avg == null ? null : Math.round(avg * 10) / 10,
      ratingCounts,
      reviewCounts,
      colleges: [...new Set(feedback.map((f) => f.participant.college).filter((c) => c && c !== '-'))].length,
    },
  });
});

router.get('/:id/report.pdf', async (req, res) => {
  const event = await findEvent(req.params.id);
  const pdf = await renderEventReport(event);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="${event.slug}-report.pdf"`);
  res.send(pdf);
});

router.get('/:id/export.csv', async (req, res) => {
  const event = await findEvent(req.params.id);
  const rows = await Feedback.find({ event: event._id }).sort({ submittedAt: 1 }).populate('certificate').lean();
  const csv = toCsv(
    [
      { label: 'Submitted at', value: (r) => r.submittedAt },
      { label: 'Name', value: (r) => r.participant.name },
      { label: 'Register No', value: (r) => r.participant.regNo },
      { label: 'College', value: (r) => r.participant.college },
      { label: 'Email', value: (r) => r.participant.email },
      { label: 'Rating', value: (r) => r.rating },
      { label: 'Review', value: (r) => r.review },
      { label: 'Comments', value: (r) => r.comments },
      { label: 'Certificate ID', value: (r) => r.certificate?.certificateId },
      { label: 'Email status', value: (r) => r.certificate?.delivery?.status },
    ],
    rows
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${event.slug}-feedback.csv"`);
  res.send(csv);
});

export default router;
