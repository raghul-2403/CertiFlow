import fs from 'node:fs';
import mongoose from 'mongoose';

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
let localServer = null;
let usingLocal = false;

async function tryConnect(uri, timeoutMs) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
    return true;
  } catch {
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

// Runs a real MongoDB server on this computer, saving data to `dbPath`,
// so the project works without a MongoDB Atlas account.
async function connectLocal(dbPath, port) {
  const uri = `mongodb://127.0.0.1:${port}/certiflow`;

  // If CertiFlow was closed abruptly, its database may still be running: reuse it.
  if (await tryConnect(uri, 1500)) {
    console.log('[db] reconnected to the database that was still running');
    return;
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(dbPath, { recursive: true });
  console.log('[db] starting local database (first run downloads MongoDB, ~1–2 min)...');
  try {
    localServer = await MongoMemoryServer.create({
      instance: { dbPath, port, storageEngine: 'wiredTiger', dbName: 'certiflow' },
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/download|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|403|404/i.test(msg)) {
      throw new Error(
        'Could not download the database engine. Connect to the internet and start again ' +
          '(only needed the first time), or put a MongoDB Atlas link in MONGODB_URI in server/.env.'
      );
    }
    if (/EADDRINUSE|address already in use/i.test(msg)) {
      throw new Error(`Port ${port} is used by another program. Set LOCAL_DB_PORT in server/.env to a free port, e.g. 27041.`);
    }
    if (/DBPathInUse|lock/i.test(msg)) {
      throw new Error('The database folder is in use by another CertiFlow window. Close it and start again.');
    }
    throw err;
  }
  await mongoose.connect(localServer.getUri('certiflow'), { serverSelectionTimeoutMS: 15000 });
}

export async function connectDB({ uri, localDbPath, localDbPort = 27031 }) {
  mongoose.set('strictQuery', true);

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    } catch (err) {
      throw new Error(`Could not connect to MONGODB_URI: ${err.message}. Check the link, password and Atlas Network Access.`);
    }
  } else {
    usingLocal = true;
    await connectLocal(localDbPath, localDbPort);
  }
  mongoose.connection.on('error', (err) => console.error('[db] error:', err.message));
  console.log(`[db] connected to "${mongoose.connection.name}"${usingLocal ? ` (local, data in ${localDbPath})` : ' (MongoDB Atlas / remote)'}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (localServer) {
    await localServer.stop({ doCleanup: false });
    localServer = null;
  }
}

export const dbState = () => STATES[mongoose.connection.readyState] ?? 'unknown';
export const isLocalDb = () => usingLocal;
