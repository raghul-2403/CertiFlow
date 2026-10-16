// Applying a certificate design to an event, and re-creating issued certificates
import fs from 'node:fs/promises';
import { Certificate } from '../models/index.js';
import { PRESETS, DEFAULT_FIELDS } from '../templates/presets.js';
import { FONTS, DATE_FORMATS } from './certificateFonts.js';
import { saveTemplate, deleteTemplate, savePdf, deletePdf } from './gridfs.js';
import { renderForEvent, deliverCertificate } from './certificateService.js';
import { imageInfo } from '../utils/imageSize.js';
import { awardKicker } from './awards.js';
import { ApiError } from '../utils/ApiError.js';

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};
const color = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : fallback);

export function cleanFields(input = {}) {
  const d = DEFAULT_FIELDS;
  const text = (f = {}, def) => ({
    x: clamp(f.x, 0, 1, def.x),
    y: clamp(f.y, 0, 1, def.y),
    size: clamp(f.size, 0.004, 0.2, def.size),
    color: color(f.color, def.color),
    font: FONTS[f.font] ? f.font : def.font,
  });
  return {
    name: { ...text(input.name, d.name), maxWidth: clamp(input.name?.maxWidth, 0.05, 1, d.name.maxWidth), uppercase: Boolean(input.name?.uppercase ?? d.name.uppercase) },
    date: { ...text(input.date, d.date), format: DATE_FORMATS.includes(input.date?.format) ? input.date.format : d.date.format },
    verify: {
      show: Boolean(input.verify?.show ?? true),
      x: clamp(input.verify?.x, 0, 1, d.verify.x),
      y: clamp(input.verify?.y, 0, 1, d.verify.y),
      size: clamp(input.verify?.size, 0.02, 0.3, d.verify.size),
    },
  };
}

export const publicDesign = (event) => {
  const d = event.certificate?.design || {};
  return {
    mode: d.mode || 'builtin',
    preset: d.preset || null,
    hasImage: Boolean(d.templateFileId),
    imageId: d.templateFileId ? String(d.templateFileId) : null,
    imageWidth: d.imageWidth || null,
    imageHeight: d.imageHeight || null,
    fields: d.fields || DEFAULT_FIELDS,
  };
};

// Stores the design image in MongoDB and switches the event to it
export async function setDesignImage(event, buffer, { preset = null, fields } = {}) {
  const info = imageInfo(buffer);
  if (!info) throw ApiError.badRequest('Upload a PNG or JPG image');
  if (info.width < 800) throw ApiError.badRequest('This image is too small to print well. Use one at least 1600 pixels wide.');

  const old = event.certificate?.design?.templateFileId;
  const saved = await saveTemplate(buffer, `${event.slug}-design.${info.type === 'image/png' ? 'png' : 'jpg'}`, info.type, { event: String(event._id) });
  const keepFields = event.certificate?.design?.mode === 'image' && event.certificate?.design?.fields;

  event.set('certificate.design', {
    mode: 'image',
    preset,
    templateFileId: saved.gridFsId,
    contentType: info.type,
    imageWidth: info.width,
    imageHeight: info.height,
    fields: cleanFields(fields || keepFields || DEFAULT_FIELDS),
  });
  event.markModified('certificate.design');
  await event.save();
  if (old) await deleteTemplate(old);
}

export async function applyPreset(event, key) {
  const preset = PRESETS[key];
  if (!preset) throw ApiError.badRequest('Unknown design');
  await setDesignImage(event, await fs.readFile(preset.file), { preset: key, fields: preset.fields });
}

// Re-draws every valid certificate of an event with its current design (same IDs),
// replaces the stored PDFs and optionally emails them again.
export async function regenerateCertificates(event, { resend = true } = {}) {
  const certs = await Certificate.find({ event: event._id, status: 'active' }).sort({ issuedAt: 1 });
  const result = { total: certs.length, recreated: 0, emailed: 0, emailFailed: 0 };

  for (const cert of certs) {
    // eslint-disable-next-line no-await-in-loop
    const pdf = await renderForEvent(event, {
      certificateId: cert.certificateId,
      participant: cert.participant,
      award: cert.kind === 'award'
        ? { type: cert.award.type, title: cert.award.title, line: cert.award.line, kicker: awardKicker(cert.award) }
        : null,
    });
    const oldFile = cert.file?.gridFsId;
    // eslint-disable-next-line no-await-in-loop
    cert.file = await savePdf(pdf, cert.file?.filename || `${cert.certificateId}.pdf`, { certificateId: cert.certificateId, event: String(event._id) });
    cert.eventSnapshot = { name: event.name, date: event.date, organizer: event.organizer };
    cert.published = false;
    if (resend) {
      cert.delivery.status = 'pending';
      cert.delivery.attempts = 0;
      cert.delivery.lastError = undefined;
    }
    // eslint-disable-next-line no-await-in-loop
    await cert.save();
    // eslint-disable-next-line no-await-in-loop
    if (oldFile) await deletePdf(oldFile);
    result.recreated += 1;

    if (resend) {
      // eslint-disable-next-line no-await-in-loop
      const sent = await deliverCertificate(cert);
      if (sent.delivery.status === 'sent') result.emailed += 1;
      else result.emailFailed += 1;
    }
  }
  return result;
}
