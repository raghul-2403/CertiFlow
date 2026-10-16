// Certificate design per event: use the built-in layout, a ready preset,
// or upload the club's own design and place the name/date/QR on it.
import express, { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { PRESETS, DEFAULT_FIELDS } from '../templates/presets.js';
import { FONTS, DATE_FORMATS } from '../services/certificateFonts.js';
import { readTemplate } from '../services/gridfs.js';
import { adoptWaitingResponses } from '../services/syncService.js';
import { renderForEvent } from '../services/certificateService.js';
import { applyPreset, cleanFields, publicDesign, regenerateCertificates, setDesignImage } from '../services/designService.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// ---- /api/designs (shared lists for the editor and the New event form) ----
export const designCatalog = Router();
designCatalog.use(requireAuth);
designCatalog.get('/', (req, res) => {
  res.json({
    success: true,
    presets: Object.entries(PRESETS).map(([key, p]) => ({ key, label: p.label })),
    fonts: Object.entries(FONTS).map(([key, f]) => ({ key, label: f.label })),
    dateFormats: DATE_FORMATS,
    defaults: DEFAULT_FIELDS,
  });
});

// ---- /api/events/:id/design ----
const router = Router({ mergeParams: true });
router.use(requireAuth);

async function findEvent(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Event not found');
  const event = await Event.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

router.get('/', async (req, res) => {
  const event = await findEvent(req.params.id);
  res.json({ success: true, design: publicDesign(event) });
});

// Upload your own design (raw image body)
router.put('/image', express.raw({ type: ['image/png', 'image/jpeg'], limit: MAX_IMAGE_BYTES }), async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw ApiError.badRequest('Upload a PNG or JPG image (max 10 MB)');
  await setDesignImage(event, req.body);
  // Responses waiting for this event now get their certificates on the new design
  const adoptedResponses = await adoptWaitingResponses(event);
  res.json({ success: true, design: publicDesign(event), adoptedResponses });
});

// Use one of the ready-made designs
router.post('/preset', async (req, res) => {
  const event = await findEvent(req.params.id);
  await applyPreset(event, req.body?.preset);
  res.json({ success: true, design: publicDesign(event) });
});

// Switch between built-in and own design, or move the text
router.patch('/', async (req, res) => {
  const event = await findEvent(req.params.id);
  const design = event.certificate?.design || {};
  const mode = req.body?.mode;
  if (mode === 'image' && !design.templateFileId) throw ApiError.badRequest('Upload a design image first');
  if (mode && !['builtin', 'image'].includes(mode)) throw ApiError.badRequest('Unknown design mode');
  if (mode) event.set('certificate.design.mode', mode);
  if (req.body?.fields) event.set('certificate.design.fields', cleanFields(req.body.fields));
  event.markModified('certificate.design');
  await event.save();
  res.json({ success: true, design: publicDesign(event) });
});

// Re-create already issued certificates with the current design (same IDs), optionally email again
router.post('/regenerate', async (req, res) => {
  const event = await findEvent(req.params.id);
  const result = await regenerateCertificates(event, { resend: req.body?.resend !== false });
  res.json({ success: true, result });
});

router.get('/image', async (req, res) => {
  const event = await findEvent(req.params.id);
  const d = event.certificate?.design;
  if (!d?.templateFileId) throw ApiError.notFound('No design uploaded');
  res.setHeader('Content-Type', d.contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(await readTemplate(d.templateFileId));
});

// Sample certificate so coordinators can check the layout before the event
router.get('/preview.pdf', async (req, res) => {
  const event = await findEvent(req.params.id);
  const name = String(req.query.name || 'Sample Participant Name').slice(0, 80);
  const pdf = await renderForEvent(event, {
    certificateId: `CF-${new Date().getFullYear()}-SAMPLE`,
    participant: { name, regNo: '111600000000', college: 'Sample College', email: 'sample@example.com' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${event.slug}-preview.pdf"`);
  res.send(pdf);
});

export default router;
