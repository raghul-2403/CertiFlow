import express, { Router } from 'express';
import { env } from '../config/env.js';
import { isLocalDb } from '../config/db.js';
import { getSettings, setSetting } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { fetchFormInfo, renderScript, SCRIPT_URL_RE, GoogleBridgeError, LATEST_SCRIPT_VERSION } from '../services/googleBridge.js';
import { mailMode } from '../services/mailer.js';
import { runSync } from '../services/syncService.js';
import { ApiError } from '../utils/ApiError.js';
import { orgInfo, setOrgLogo, useOrgLogoPreset } from '../services/orgService.js';

const router = Router();
router.use(requireAuth);

const GOOGLE_KEYS = [
  'google.scriptUrl', 'google.formUrl', 'google.editUrl', 'google.eventEntryId', 'google.formTitle',
  'google.emailQuota', 'google.connectedAt', 'google.lastSyncAt', 'google.lastSyncError', 'google.lastSyncSummary',
  'google.scriptVersion', 'google.verifySupported', 'google.registerUrl',
];

export async function googleStatus() {
  const s = await getSettings(GOOGLE_KEYS);
  return {
    connected: Boolean(s['google.scriptUrl']),
    scriptUrl: s['google.scriptUrl'],
    formUrl: s['google.formUrl'],
    editUrl: s['google.editUrl'],
    formTitle: s['google.formTitle'],
    emailQuota: s['google.emailQuota'],
    connectedAt: s['google.connectedAt'],
    lastSyncAt: s['google.lastSyncAt'],
    lastSyncError: s['google.lastSyncError'],
    lastSyncSummary: s['google.lastSyncSummary'],
    scriptVersion: s['google.scriptVersion'] || 1,
    latestScriptVersion: LATEST_SCRIPT_VERSION,
    verifySupported: Boolean(s['google.verifySupported']),
    registerUrl: s['google.registerUrl'],
  };
}

async function saveFormInfo(scriptUrl, info) {
  await Promise.all([
    setSetting('google.scriptUrl', scriptUrl),
    setSetting('google.formUrl', info.formUrl),
    setSetting('google.editUrl', info.editUrl),
    setSetting('google.eventEntryId', info.eventEntryId),
    setSetting('google.formTitle', info.formTitle),
    setSetting('google.emailQuota', info.emailQuota),
    setSetting('google.scriptVersion', info.version || 1),
    setSetting('google.verifySupported', Boolean(info.verify)),
    setSetting('google.registerUrl', info.registerUrl || null),
  ]);
}

router.get('/', async (req, res) => {
  res.json({
    success: true,
    google: await googleStatus(),
    org: await orgInfo(),
    mailMode: mailMode(),
    syncIntervalSec: env.syncIntervalSec,
    database: isLocalDb() ? 'local' : 'remote',
    publicBaseUrl: env.publicBaseUrl,
    publicBaseUrlSet: env.publicBaseUrlSet,
  });
});

// Organisation shown in the sidebar, e.g. "R.M.K. College of Engineering and Technology" + "CSE Student Chapter"

router.get('/org', async (req, res) => {
  res.json({ success: true, org: await orgInfo() });
});

router.put('/org', requireRole('admin'), async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const unit = String(req.body?.unit || '').trim().slice(0, 120);
  await setSetting('org.name', name);
  await setSetting('org.unit', unit);
  res.json({ success: true, org: await orgInfo() });
});

// College logo: shown in the middle of every event QR code and as a watermark on the projector screen
router.put('/org/logo', requireRole('admin'), express.raw({ type: ['image/png', 'image/jpeg'], limit: 5 * 1024 * 1024 }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw ApiError.badRequest('Upload a PNG or JPG image (max 5 MB)');
  await setOrgLogo(req.body);
  res.json({ success: true, org: await orgInfo() });
});

// { use: 'crest' } = the bundled RMKCET crest, { use: 'none' } = no logo
router.post('/org/logo', requireRole('admin'), async (req, res) => {
  await useOrgLogoPreset(String(req.body?.use || ''));
  res.json({ success: true, org: await orgInfo() });
});

// The Apps Script with this app's secret key already filled in
router.get('/google/script', async (req, res) => {
  res.type('text/plain').send(await renderScript());
});

router.put('/google', requireRole('admin'), async (req, res) => {
  const scriptUrl = String(req.body?.scriptUrl || '').trim();
  if (!SCRIPT_URL_RE.test(scriptUrl)) {
    throw ApiError.badRequest('Paste the Web app URL from Apps Script. It starts with https://script.google.com/macros/s/ and ends with /exec');
  }
  let info;
  try {
    info = await fetchFormInfo(scriptUrl);
  } catch (err) {
    if (err instanceof GoogleBridgeError) throw ApiError.badRequest(err.message);
    throw err;
  }
  await saveFormInfo(scriptUrl, info);
  await setSetting('google.connectedAt', new Date().toISOString());
  res.json({ success: true, google: await googleStatus() });
});

router.post('/google/test', async (req, res) => {
  const { 'google.scriptUrl': scriptUrl } = await getSettings(['google.scriptUrl']);
  try {
    const info = await fetchFormInfo(scriptUrl);
    await saveFormInfo(scriptUrl, info);
    res.json({ success: true, google: await googleStatus() });
  } catch (err) {
    if (err instanceof GoogleBridgeError) throw ApiError.badRequest(err.message);
    throw err;
  }
});

router.delete('/google', requireRole('admin'), async (req, res) => {
  await Promise.all(GOOGLE_KEYS.map((k) => setSetting(k, null)));
  res.json({ success: true, google: await googleStatus() });
});

// "Check for responses now"
router.post('/sync', async (req, res) => {
  const result = await runSync();
  res.json({ success: !result.error, result, google: await googleStatus() });
});

export default router;
