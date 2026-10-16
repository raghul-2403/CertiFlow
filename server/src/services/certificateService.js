import { env } from '../config/env.js';
import { Certificate, Event, Feedback, getSettings, setSetting } from '../models/index.js';
import { googleVerifyUrl } from './googleBridge.js';
import { renderCertificatePdf } from './certificatePdf.js';
import { renderDesignCertificatePdf } from './designPdf.js';
import fs from 'node:fs/promises';
import { savePdf, readPdf, readTemplate } from './gridfs.js';
import { DEFAULT_FIELDS, PRESETS } from '../templates/presets.js';
import { buildCertificateEmail, sendMail } from './mailer.js';
import { orgInfo, orgLogo } from './orgService.js';

export const MAX_EMAIL_ATTEMPTS = 5;

// Where the QR code on the certificate points:
//  - PUBLIC_BASE_URL if CertiFlow is deployed online,
//  - otherwise the Google script's public verify page (works from any phone),
//  - otherwise this computer (only works on the same laptop).
export async function verifyUrlFor(certificateId) {
  if (env.publicBaseUrlSet) return `${env.publicBaseUrl}/verify/${certificateId}`;
  const g = await getSettings(['google.scriptUrl', 'google.verifySupported']);
  if (g['google.scriptUrl'] && g['google.verifySupported']) return googleVerifyUrl(g['google.scriptUrl'], certificateId);
  return `${env.publicBaseUrl}/verify/${certificateId}`;
}

const safeFilePart = (s) => String(s).replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 40);

async function uniqueCertificateId(date) {
  for (let i = 0; i < 5; i += 1) {
    const id = Certificate.generateId(date);
    // eslint-disable-next-line no-await-in-loop
    if (!(await Certificate.exists({ certificateId: id }))) return id;
  }
  throw new Error('Could not generate a unique certificate ID');
}

const awardImages = new Map();
async function awardImage(presetKey) {
  if (!awardImages.has(presetKey)) awardImages.set(presetKey, await fs.readFile(PRESETS[presetKey].award.file));
  return awardImages.get(presetKey);
}

// Draws the certificate PDF using the event's chosen design.
// `award` (winner, runner-up, appreciation) changes the heading; see services/awards.js.
export async function renderForEvent(event, { certificateId, participant, award = null }) {
  const verifyUrl = await verifyUrlFor(certificateId);
  const eventInfo = { name: event.name, date: event.date, organizer: event.organizer, venue: event.venue };
  const design = event.certificate?.design;
  const presetAward = design?.preset && PRESETS[design.preset]?.award;

  // The club's own design. Awards need a version of it without the "Participation" heading,
  // which ready-made designs include; for other uploaded designs awards use the standard layout.
  if (design?.mode === 'image' && design.templateFileId && (!award || presetAward)) {
    const image = award ? await awardImage(design.preset) : await readTemplate(design.templateFileId);
    return renderDesignCertificatePdf({
      image,
      imageWidth: design.imageWidth,
      imageHeight: design.imageHeight,
      fields: design.fields || DEFAULT_FIELDS,
      certificateId,
      participant,
      event: eventInfo,
      verifyUrl,
      award,
      heading: award ? presetAward.heading : null,
    });
  }
  const [logo, org] = await Promise.all([orgLogo(), orgInfo()]);
  return renderCertificatePdf({
    orgName: org.name,
    certificateId,
    participant,
    event: eventInfo,
    verifyUrl,
    title: event.certificate?.title || 'Certificate of Participation',
    signatories: event.certificate?.signatories || [],
    award,
    logo: logo?.buffer,
  });
}

// Creates the PDF certificate for one feedback, stores it in MongoDB (GridFS)
// and saves the certificate record. Safe to call twice: returns the existing one.
export async function issueCertificate(feedbackOrId) {
  const feedback = feedbackOrId._id ? feedbackOrId : await Feedback.findById(feedbackOrId);
  if (!feedback) throw new Error('Feedback not found');

  const existing = await Certificate.findOne({ feedback: feedback._id });
  if (existing) return existing;

  const event = await Event.findById(feedback.event);
  if (!event) throw new Error('Event not found for this feedback');

  const issuedAt = new Date();
  const certificateId = await uniqueCertificateId(issuedAt);
  const participant = {
    name: feedback.participant.name,
    regNo: feedback.participant.regNo,
    college: feedback.participant.college,
    email: feedback.participant.email,
  };
  const eventSnapshot = { name: event.name, date: event.date, organizer: event.organizer };

  const pdf = await renderForEvent(event, { certificateId, participant });

  const filename = `${certificateId}_${safeFilePart(participant.name)}.pdf`;
  const file = await savePdf(pdf, filename, { certificateId, event: String(event._id) });

  const cert = await Certificate.create({
    certificateId,
    event: event._id,
    feedback: feedback._id,
    participant,
    eventSnapshot,
    file,
    issuedAt,
  });

  feedback.certificate = cert._id;
  await feedback.save();
  await Event.updateOne({ _id: event._id }, { $inc: { 'stats.certificatesIssued': 1 } });
  return cert;
}

// Gives a winner / runner-up / volunteer an award certificate (separate from their participation one)
export async function issueAwardCertificate(event, { participant, award }) {
  const issuedAt = new Date();
  const certificateId = await uniqueCertificateId(issuedAt);
  const pdf = await renderForEvent(event, { certificateId, participant, award });
  const filename = `${certificateId}_${safeFilePart(participant.name)}_${safeFilePart(award.title)}.pdf`;
  const file = await savePdf(pdf, filename, { certificateId, event: String(event._id), kind: 'award' });
  const cert = await Certificate.create({
    certificateId,
    event: event._id,
    kind: 'award',
    award: { type: award.type, title: award.title, line: award.line },
    participant,
    eventSnapshot: { name: event.name, date: event.date, organizer: event.organizer },
    file,
    issuedAt,
  });
  await Event.updateOne({ _id: event._id }, { $inc: { 'stats.awardsIssued': 1 } });
  return cert;
}

const QUOTA_RE = /too many times|quota|limit exceeded|Service invoked/i;

// Emails the certificate PDF to the participant and records the outcome
export async function deliverCertificate(certOrId) {
  const cert = certOrId._id ? certOrId : await Certificate.findById(certOrId);
  if (!cert) throw new Error('Certificate not found');
  if (cert.status === 'revoked') throw new Error('Certificate is revoked');

  const verifyUrl = await verifyUrlFor(cert.certificateId);
  const mail = buildCertificateEmail({
    participant: cert.participant,
    event: cert.eventSnapshot,
    certificateId: cert.certificateId,
    verifyUrl,
    award: cert.kind === 'award' ? cert.award : null,
    issuedAt: cert.issuedAt,
  });

  cert.delivery.attempts += 1;
  let quotaHit = false;
  try {
    const pdf = await readPdf(cert.file.gridFsId);
    const sent = await sendMail({
      to: cert.participant.email,
      ...mail,
      senderName: cert.eventSnapshot.organizer,
      attachments: [{ filename: cert.file.filename, content: pdf, contentType: 'application/pdf' }],
    });
    // Remember how many emails Gmail still allows today (shown as a warning on the dashboard)
    if (sent?.emailQuota != null) {
      await setSetting('google.emailQuota', sent.emailQuota);
      await setSetting('google.emailQuotaAt', new Date().toISOString());
    }
    cert.delivery.status = 'sent';
    cert.delivery.sentAt = new Date();
    cert.delivery.lastError = undefined;
    cert.delivery.nextAttemptAt = undefined;
  } catch (err) {
    cert.delivery.status = 'failed';
    quotaHit = QUOTA_RE.test(err.message);
    if (quotaHit) {
      // Gmail's daily limit: try again in 3 hours, and don't count it as a real failure
      cert.delivery.attempts -= 1;
      cert.delivery.lastError = "Gmail's daily email limit is reached. CertiFlow will send it automatically later.";
      await setSetting('google.emailQuota', 0);
      await setSetting('google.emailQuotaAt', new Date().toISOString());
      cert.delivery.nextAttemptAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    } else {
      cert.delivery.lastError = err.message.slice(0, 500);
      // wait 2, 4, 8, 16 minutes between automatic retries
      cert.delivery.nextAttemptAt = new Date(Date.now() + 2 * 60 * 1000 * 2 ** (cert.delivery.attempts - 1));
    }
  }
  await cert.save();
  cert.$locals.quotaHit = quotaHit;
  return cert;
}

// Retries certificates whose email is pending or failed (called by the sync loop)
export async function retryPendingDeliveries(limit = 20) {
  const now = new Date();
  const due = await Certificate.find({
    status: 'active',
    'delivery.status': { $in: ['pending', 'failed'] },
    'delivery.attempts': { $lt: MAX_EMAIL_ATTEMPTS },
    $or: [{ 'delivery.nextAttemptAt': { $exists: false } }, { 'delivery.nextAttemptAt': null }, { 'delivery.nextAttemptAt': { $lte: now } }],
  })
    .sort({ issuedAt: 1 })
    .limit(limit);
  let sent = 0;
  for (const cert of due) {
    // eslint-disable-next-line no-await-in-loop
    const result = await deliverCertificate(cert);
    if (result.delivery.status === 'sent') sent += 1;
    if (result.$locals.quotaHit) break; // no point trying the rest today
  }
  return { tried: due.length, sent };
}
