import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin, getSetting, setSetting } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getJwtSecret } from '../services/bootstrap.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const publicAdmin = (a) => ({ id: a._id, name: a.name, email: a.email, role: a.role });
const sign = (admin) => jwt.sign({ sub: String(admin._id), role: admin.role }, getJwtSecret(), { expiresIn: env.jwtExpiresIn });

// Tells the login page whether to show the first-time login hint
// Only on a local install: once CertiFlow is online (PUBLIC_BASE_URL set) the password is never shown.
router.get('/bootstrap', async (req, res) => {
  const active = await getSetting('auth.defaultPasswordActive', false);
  const local = !env.publicBaseUrlSet;
  res.json({ success: true, defaultLogin: active && local ? { email: env.adminEmail, password: env.adminPassword } : null });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw ApiError.badRequest('Enter your email and password');

  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) throw ApiError.unauthorized('Wrong email or password');

  res.json({ success: true, token: sign(admin), admin: publicAdmin(admin) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, admin: publicAdmin(req.admin) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) throw ApiError.badRequest('New password must be at least 8 characters');

  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!(await admin.comparePassword(String(currentPassword || '')))) throw ApiError.badRequest('Current password is wrong');

  admin.password = String(newPassword);
  await admin.save();
  if (admin.email === env.adminEmail) await setSetting('auth.defaultPasswordActive', false);
  res.json({ success: true, message: 'Password changed' });
});

// Coordinators (team members) — admin only
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await Admin.find().sort({ createdAt: 1 });
  res.json({ success: true, users: users.map(publicAdmin) });
});

router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'coordinator' } = req.body || {};
  if (!name || !email || !password) throw ApiError.badRequest('Name, email and password are required');
  if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
  const user = await Admin.create({ name, email, password, role: role === 'admin' ? 'admin' : 'coordinator' });
  res.status(201).json({ success: true, user: publicAdmin(user) });
});

router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (String(req.params.id) === String(req.admin._id)) throw ApiError.badRequest("You can't remove your own account");
  const user = await Admin.findByIdAndDelete(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true });
});

export default router;
