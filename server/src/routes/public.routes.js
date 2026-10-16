import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Certificate } from '../models/index.js';
import { getJwtSecret } from '../services/bootstrap.js';
import { openPdfStream } from '../services/gridfs.js';
import { rateLimit } from '../utils/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import { orgInfo, orgLogo } from '../services/orgService.js';

const router = Router();

// Anyone can check a certificate is genuine using its ID (no login)
router.get('/verify/:certificateId', async (req, res) => {
  const id = String(req.params.certificateId || '').trim().toUpperCase();
  if (!/^CF-\d{4}-[A-Z0-9]{6}$/.test(id)) throw ApiError.badRequest('That does not look like a CertiFlow certificate ID (e.g. CF-2026-7K3QXM)');

  const cert = await Certificate.findOne({ certificateId: id }).lean();
  if (!cert) return res.status(404).json({ success: false, valid: false, message: 'No certificate exists with this ID' });

  const reg = cert.participant.regNo;
  res.json({
    success: true,
    valid: cert.status === 'active',
    certificate: {
      certificateId: cert.certificateId,
      status: cert.status,
      name: cert.participant.name,
      // Partially hidden so the public page doesn't expose full register numbers
      regNo: reg.length > 4 ? `${'•'.repeat(reg.length - 4)}${reg.slice(-4)}` : reg,
      college: cert.participant.college,
      event: cert.eventSnapshot.name,
      eventDate: cert.eventSnapshot.date,
      organizer: cert.eventSnapshot.organizer,
      issuedAt: cert.issuedAt,
      award: cert.kind === 'award' ? cert.award?.title : null,
    },
  });
});

// "My certificates": a student finds all their certificates with their register number + email.
// Both must match what they typed in the form. Download links work for one hour.
const lookupLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/my-certificates', lookupLimit, async (req, res) => {
  const regNo = String(req.body?.regNo || '').replace(/\s/g, '').toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!regNo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Enter your register number and the email you used in the form');
  const certs = await Certificate.find({ 'participant.regNo': regNo, 'participant.email': email, status: 'active' }).sort({ issuedAt: -1 }).lean();
  const secret = getJwtSecret();
  res.json({
    success: true,
    name: certs[0]?.participant.name || null,
    certificates: certs.map((c) => ({
      certificateId: c.certificateId,
      event: c.eventSnapshot.name,
      eventDate: c.eventSnapshot.date,
      organizer: c.eventSnapshot.organizer,
      issuedAt: c.issuedAt,
      award: c.kind === 'award' ? c.award?.title : null,
      download: `/api/public/certificates/${c.certificateId}/pdf?t=${jwt.sign({ c: c.certificateId, p: 'dl' }, secret, { expiresIn: '1h' })}`,
    })),
  });
});

router.get('/certificates/:certificateId/pdf', async (req, res, next) => {
  let payload;
  try {
    payload = jwt.verify(String(req.query.t || ''), getJwtSecret());
  } catch {
    throw ApiError.unauthorized('This download link has expired. Search for your certificates again.');
  }
  const id = String(req.params.certificateId).toUpperCase();
  if (payload.p !== 'dl' || payload.c !== id) throw ApiError.unauthorized('Invalid download link');
  const cert = await Certificate.findOne({ certificateId: id, status: 'active' }).lean();
  if (!cert?.file?.gridFsId) throw ApiError.notFound('Certificate not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${cert.file.filename}"`);
  openPdfStream(cert.file.gridFsId).on('error', next).pipe(res);
});

// College name and logo for public pages (the logo is not secret: it is printed on every poster)
router.get('/org', async (req, res) => {
  const { name, unit, logo, logoVersion } = await orgInfo();
  res.json({ success: true, org: { name, unit, logo, logoVersion } });
});

router.get('/org/logo', async (req, res) => {
  const logo = await orgLogo();
  if (!logo) throw ApiError.notFound('No college logo has been set');
  res.setHeader('Content-Type', logo.type);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(logo.buffer);
});

export default router;
