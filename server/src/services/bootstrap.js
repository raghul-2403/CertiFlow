// One-time setup that runs on every start: first admin account and JWT secret.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { Admin, Certificate, getSetting, setSetting } from '../models/index.js';

let jwtSecret = null;

export async function ensureJwtSecret() {
  if (env.jwtSecret) {
    jwtSecret = env.jwtSecret;
    return jwtSecret;
  }
  jwtSecret = await getSetting('auth.jwtSecret');
  if (!jwtSecret) jwtSecret = await setSetting('auth.jwtSecret', crypto.randomBytes(48).toString('hex'));
  return jwtSecret;
}

export const getJwtSecret = () => {
  if (!jwtSecret) throw new Error('JWT secret not initialised');
  return jwtSecret;
};

export async function ensureAdmin() {
  // exists() reads the real data; a count estimate can be stale after the computer shuts down abruptly
  if (await Admin.exists({})) return null;
  let admin;
  try {
    admin = await Admin.create({
      name: 'Coordinator',
      email: env.adminEmail,
      password: env.adminPassword,
      role: 'admin',
    });
  } catch (err) {
    if (err?.code === 11000) return null; // already there
    throw err;
  }
  await setSetting('auth.defaultPasswordActive', true);
  console.log(`[auth] first admin created → email: ${env.adminEmail}  password: ${env.adminPassword}`);
  return admin;
}

// Brings database indexes up to date after an upgrade (e.g. version 8 lets award
// certificates exist without a feedback, which needs the old feedback index replaced).
export async function ensureIndexes() {
  try {
    await Certificate.syncIndexes();
  } catch (err) {
    console.warn(`[db] could not update indexes: ${err.message}`);
  }
}
