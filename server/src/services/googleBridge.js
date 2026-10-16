// Talks to the Google Apps Script web app the coordinator deployed.
// CertiFlow always calls out to Google (never the other way round), so it works
// on a laptop with no public URL.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSetting, setSetting } from '../models/index.js';
import { env } from '../config/env.js';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'google', 'Code.gs.template');
const TIMEOUT_MS = 30000;

export const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

export async function getScriptSecret() {
  let secret = await getSetting('google.secret');
  if (!secret) secret = await setSetting('google.secret', crypto.randomBytes(24).toString('hex'));
  return secret;
}

export async function renderScript() {
  const [template, secret] = await Promise.all([fs.readFile(TEMPLATE, 'utf8'), getScriptSecret()]);
  return template.replace('{{SECRET}}', secret).replace('{{APP_URL}}', env.publicBaseUrlSet ? env.publicBaseUrl : '');
}

export class GoogleBridgeError extends Error {}

async function parse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Apps Script returns an HTML page when the deployment is wrong or private
    throw new GoogleBridgeError(
      'Google returned a web page instead of data. Check the deployment: "Execute as: Me" and "Who has access: Anyone".'
    );
  }
  if (!data.ok) {
    if (data.error === 'unauthorized')
      throw new GoogleBridgeError('The script rejected the secret key. Copy the latest script from Settings and redeploy it.');
    throw new GoogleBridgeError(data.error || 'Google script error');
  }
  return data;
}

async function call(scriptUrl, { method = 'GET', params = {}, body } = {}) {
  if (!scriptUrl) throw new GoogleBridgeError('Google Form is not connected yet. Open Settings to connect it.');
  const secret = await getScriptSecret();
  const url = new URL(scriptUrl);
  if (method === 'GET') {
    url.searchParams.set('key', secret);
    for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      redirect: 'follow', // Apps Script answers with a redirect to the result
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ ...body, key: secret }) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new GoogleBridgeError(`Could not reach Google: ${err.message}. Check your internet connection.`);
  }
  if (!res.ok) throw new GoogleBridgeError(`Google answered with HTTP ${res.status}`);
  return parse(res);
}

export const fetchFormInfo = (scriptUrl) => call(scriptUrl);

export const fetchResponses = (scriptUrl, sinceIso, limit = 200) =>
  call(scriptUrl, { params: { action: 'responses', since: sinceIso, limit } });

export const LATEST_SCRIPT_VERSION = 3;

export const publishRecords = (scriptUrl, records) => call(scriptUrl, { method: 'POST', body: { action: 'publish', records } });

// Public verification page served by the Google script (works from any phone)
export const googleVerifyUrl = (scriptUrl, certificateId) => `${scriptUrl}?verify=${encodeURIComponent(certificateId)}`;

export const sendEmailViaGoogle = (scriptUrl, mail) =>
  call(scriptUrl, { method: 'POST', body: { action: 'sendEmail', ...mail } });

// Builds the link a participant opens from the QR code, with the event name pre-filled
export function prefilledFormUrl(formUrl, eventEntryId, eventName) {
  if (!formUrl) return null;
  const url = new URL(formUrl);
  if (eventEntryId) {
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set(`entry.${eventEntryId}`, eventName);
  }
  return url.toString();
}
