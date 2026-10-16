import { Router } from 'express';
import mongoose from 'mongoose';
import { Certificate } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { deliverCertificate } from '../services/certificateService.js';
import { openPdfStream } from '../services/gridfs.js';
import { ApiError } from '../utils/ApiError.js';
import { toCsv } from '../utils/csv.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter(q) {
  const filter = {};
  if (q.event && mongoose.isValidObjectId(q.event)) filter.event = q.event;
  if (['active', 'revoked'].includes(q.status)) filter.status = q.status;
  if (['pending', 'sent', 'failed'].includes(q.delivery)) filter['delivery.status'] = q.delivery;
  if (q.kind === 'award') filter.kind = 'award';
  if (q.kind === 'participation') filter.kind = { $ne: 'award' };
  if (q.search && String(q.search).trim()) {
    const rx = new RegExp(escapeRegex(String(q.search).trim()), 'i');
    filter.$or = [
      { certificateId: rx },
      { 'award.title': rx },
      { 'participant.name': rx },
      { 'participant.regNo': rx },
      { 'participant.email': rx },
      { 'participant.college': rx },
      { 'eventSnapshot.name': rx },
    ];
  }
  return filter;
}

async function findCert(id) {
  const cert = mongoose.isValidObjectId(id)
    ? await Certificate.findById(id)
    : await Certificate.findOne({ certificateId: String(id).toUpperCase() });
  if (!cert) throw ApiError.notFound('Certificate not found');
  return cert;
}

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter = buildFilter(req.query);
  const [items, total] = await Promise.all([
    Certificate.find(filter).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Certificate.countDocuments(filter),
  ]);
  res.json({ success: true, certificates: items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/export.csv', async (req, res) => {
  const rows = await Certificate.find(buildFilter(req.query)).sort({ issuedAt: 1 }).lean();
  const csv = toCsv(
    [
      { label: 'Certificate ID', value: (r) => r.certificateId },
      { label: 'Issued at', value: (r) => r.issuedAt },
      { label: 'Name', value: (r) => r.participant.name },
      { label: 'Register No', value: (r) => r.participant.regNo },
      { label: 'College', value: (r) => r.participant.college },
      { label: 'Email', value: (r) => r.participant.email },
      { label: 'Event', value: (r) => r.eventSnapshot.name },
      { label: 'Event date', value: (r) => r.eventSnapshot.date },
      { label: 'Type', value: (r) => (r.kind === 'award' ? `Award: ${r.award?.title || ''}` : 'Participation') },
      { label: 'Email status', value: (r) => r.delivery.status },
      { label: 'Status', value: (r) => r.status },
    ],
    rows
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="certificates.csv"');
  res.send(csv);
});

router.get('/:id', async (req, res) => {
  res.json({ success: true, certificate: await findCert(req.params.id) });
});

// Streams the PDF stored in MongoDB GridFS
router.get('/:id/download', async (req, res, next) => {
  const cert = await findCert(req.params.id);
  if (!cert.file?.gridFsId) throw ApiError.notFound('PDF file missing for this certificate');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="${cert.file.filename}"`);
  openPdfStream(cert.file.gridFsId).on('error', next).pipe(res);
});

router.post('/:id/resend', async (req, res) => {
  const cert = await findCert(req.params.id);
  if (cert.status === 'revoked') throw ApiError.badRequest('This certificate is revoked; restore it before resending');
  if (req.body?.email) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Enter a valid email address');
    cert.participant.email = email;
  }
  const result = await deliverCertificate(cert);
  if (result.delivery.status !== 'sent') throw ApiError.badRequest(`Email not sent: ${result.delivery.lastError}`);
  res.json({ success: true, certificate: result });
});

router.patch('/:id/status', async (req, res) => {
  const cert = await findCert(req.params.id);
  const status = req.body?.status;
  if (!['active', 'revoked'].includes(status)) throw ApiError.badRequest('Status must be active or revoked');
  cert.status = status;
  cert.published = false; // update the public register on the next sync
  await cert.save();
  res.json({ success: true, certificate: cert });
});

export default router;
