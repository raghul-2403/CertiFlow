// Loads environment variables once. Everything is optional: with no .env at all,
// CertiFlow runs a local database and sends mail through your Google account.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..', '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const port = Number(process.env.PORT) || 5000;

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port,

  // Leave empty to use the built-in local database (stored in server/.data)
  mongoUri: process.env.MONGODB_URI || '',
  localDbPath: process.env.LOCAL_DB_PATH || path.join(SERVER_ROOT, '.data', 'db'),
  localDbPort: Number(process.env.LOCAL_DB_PORT) || 27031,

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Public URL of this app — printed on certificates as the verification link
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  publicBaseUrlSet: Boolean(process.env.PUBLIC_BASE_URL),

  // Optional: if not set, a secret is generated and stored in the database
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

  // First admin account, created automatically when the database is empty
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@certiflow.local').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',

  // How often to check Google Form for new responses
  syncIntervalSec: Math.max(10, Number(process.env.SYNC_INTERVAL_SEC) || 30),

  // Optional SMTP. If SMTP_USER is empty, certificates are mailed through the Google script.
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || '',
  },

  openBrowser: process.env.OPEN_BROWSER === '1',
});
