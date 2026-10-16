import { exec } from 'node:child_process';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { ensureAdmin, ensureIndexes, ensureJwtSecret } from './services/bootstrap.js';
import { startSyncLoop, stopSyncLoop } from './services/syncService.js';
import app from './app.js';

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function start() {
  try {
    await connectDB({ uri: env.mongoUri, localDbPath: env.localDbPath, localDbPort: env.localDbPort });
    await ensureJwtSecret();
    await ensureAdmin();
    await ensureIndexes();
  } catch (err) {
    console.error(`\n  ❌ CertiFlow could not start: ${err.message}\n`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    const url = `http://localhost:${env.port}`;
    console.log('\n  ✅ CertiFlow is running');
    console.log(`  Open ${url} in your browser\n`);
    if (env.openBrowser) openBrowser(url);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] Port ${env.port} is already in use. Is CertiFlow already running? Close it or set PORT in server/.env`);
      process.exit(1);
    }
    throw err;
  });

  startSyncLoop();

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[api] ${signal} received, shutting down...`);
    stopSyncLoop();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
