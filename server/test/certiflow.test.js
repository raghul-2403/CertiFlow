// End-to-end tests for CertiFlow.  Run with:  npm test
// Uses a temporary in-memory MongoDB and a fake Google script, so nothing real is touched.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { startFakeGoogleScript } from './helpers/fakeGoogleScript.js';

let mongo;
let google;
let server;
let base;
let token;
let mods;

const api = async (method, path, body, { auth = true, raw = false, headers = {} } = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
};

const participant = (over = {}) => ({
  name: 'Nithish Barath R',
  regNo: '111625102144',
  college: 'RMK College of Engineering and Technology',
  eventName: 'Query Quest',
  email: 'nithish@example.com',
  rating: '5',
  review: 'Excellent',
  comments: 'Great event',
  ...over,
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('certiflow_test');
  process.env.NODE_ENV = 'production'; // quieter logs
  delete process.env.PUBLIC_BASE_URL;

  const { connectDB } = await import('../src/config/db.js');
  const { ensureAdmin, ensureIndexes, ensureJwtSecret } = await import('../src/services/bootstrap.js');
  await connectDB({ uri: process.env.MONGODB_URI });
  await ensureJwtSecret();
  await ensureAdmin();
  await ensureIndexes();

  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;

  mods = {
    models: await import('../src/models/index.js'),
    sync: await import('../src/services/syncService.js'),
    bridge: await import('../src/services/googleBridge.js'),
    bootstrap: { ensureAdmin },
  };
  google = await startFakeGoogleScript({ secret: await mods.bridge.getScriptSecret() });
});

after(async () => {
  server?.close();
  await google?.close();
  const { disconnectDB } = await import('../src/config/db.js');
  await disconnectDB();
  await mongo?.stop();
});

describe('start-up and login', () => {
  test('health check reports the database as connected', async () => {
    const r = await api('GET', '/health', null, { auth: false });
    assert.equal(r.status, 200);
    assert.equal(r.data.database, 'connected');
  });

  test('starting twice does not try to create the admin again', async () => {
    assert.equal(await mods.bootstrap.ensureAdmin(), null);
  });

  test('wrong password is rejected, right password logs in', async () => {
    const bad = await api('POST', '/auth/login', { email: 'admin@certiflow.local', password: 'nope' }, { auth: false });
    assert.equal(bad.status, 401);
    const ok = await api('POST', '/auth/login', { email: 'admin@certiflow.local', password: 'Admin@123' }, { auth: false });
    assert.equal(ok.status, 200);
    token = ok.data.token;
  });

  test('pages that need login refuse requests without it', async () => {
    const r = await api('GET', '/events', null, { auth: false });
    assert.equal(r.status, 401);
  });
});

describe('Google connection', () => {
  test('the script handed out contains this app’s secret', async () => {
    const r = await api('GET', '/settings/google/script');
    assert.match(r.data.toString(), new RegExp(await mods.bridge.getScriptSecret()));
  });

  test('a link that is not an Apps Script web app is refused', async () => {
    const r = await api('PUT', '/settings/google', { scriptUrl: 'https://example.com' });
    assert.equal(r.status, 400);
  });

  test('connection test reads the form details and script version', async () => {
    await mods.models.setSetting('google.scriptUrl', google.url);
    const r = await api('POST', '/settings/google/test');
    assert.equal(r.status, 200);
    assert.equal(r.data.google.verifySupported, true);
    assert.equal(r.data.google.scriptVersion, 3);
  });
});

describe('events and certificate design', () => {
  let eventId;

  test('event is created with the RMKCET design chosen in the form', async () => {
    const r = await api('POST', '/events', {
      name: 'Query Quest',
      organizer: 'CSE Student Chapter Association',
      venue: 'Seminar Hall',
      date: '2026-10-20T09:30:00+05:30',
      designPreset: 'rmkcet-query-quest',
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.event.certificate.design.mode, 'image');
    eventId = r.data.event._id;
  });

  test('an unknown design is refused and no half-made event is left', async () => {
    const r = await api('POST', '/events', { name: 'Broken', organizer: 'x', date: '2026-10-20', designPreset: 'nope' });
    assert.equal(r.status, 400);
    const list = await api('GET', '/events');
    assert.ok(!list.data.events.some((e) => e.name === 'Broken'));
  });

  test('two events cannot share a name (ignoring case and spaces)', async () => {
    const r = await api('POST', '/events', { name: '  query   QUEST ', organizer: 'x', date: '2026-10-20' });
    assert.equal(r.status, 409);
  });

  test('QR code opens the form with the event name filled in', async () => {
    const r = await api('GET', `/events/${eventId}/qr`);
    assert.equal(r.status, 200);
    assert.match(r.data.formLink, /entry\.1234567=Query\+Quest/);
    assert.match(r.data.qrDataUrl, /^data:image\/svg\+xml;base64,/);
    assert.equal(r.data.withLogo, true, 'the college crest is in the middle by default');
    const svg = Buffer.from(r.data.qrDataUrl.split(',')[1], 'base64').toString();
    assert.match(svg, /#14284B/);
    assert.match(svg, /<image [^>]*href="data:image\/png;base64,/);
  });

  test('college logo can be uploaded, removed and restored', async () => {
    const pub = await api('GET', '/public/org/logo', null, { auth: false });
    assert.equal(pub.status, 200);
    assert.equal(pub.headers.get('content-type'), 'image/png');

    const tiny = Buffer.from('89504e470d0a1a0a0000000d4948445200000010000000100806000000', 'hex');
    const small = await api('PUT', '/settings/org/logo', Buffer.concat([tiny, Buffer.alloc(20)]), { raw: true, headers: { 'content-type': 'image/png' } });
    assert.equal(small.status, 400);

    const up = await api('PUT', '/settings/org/logo', pub.data, { raw: true, headers: { 'content-type': 'image/png' } });
    assert.equal(up.status, 200);
    assert.equal(up.data.org.logo, 'custom');

    const none = await api('POST', '/settings/org/logo', { use: 'none' });
    assert.equal(none.data.org.logo, 'none');
    const qr = await api('GET', `/events/${eventId}/qr`);
    assert.equal(qr.data.withLogo, false);
    assert.equal((await api('GET', '/public/org/logo', null, { auth: false })).status, 404);

    const back = await api('POST', '/settings/org/logo', { use: 'crest' });
    assert.equal(back.data.org.logo, 'crest');
  });

  test('preview PDF uses the design image', async () => {
    const r = await api('GET', `/events/${eventId}/design/preview.pdf`);
    assert.equal(r.status, 200);
    assert.equal(r.data.subarray(0, 4).toString(), '%PDF');
    assert.ok(r.data.length > 100_000, 'design certificates embed the image, so they are large');
  });

  test('editing the event keeps its design', async () => {
    const r = await api('PATCH', `/events/${eventId}`, { venue: 'Main Hall', certificate: { title: 'X', signatories: [] } });
    assert.equal(r.data.event.certificate.design.mode, 'image');
  });

  describe('form responses → certificates → email', () => {
    test('valid responses become certificates and are emailed; problems are flagged', async () => {
      google.addResponse(participant(), 50);
      google.addResponse(participant({ name: 'Priya S', regNo: '111625102001', email: 'priya@example.com', eventName: 'query quest' }), 40);
      google.addResponse(participant({ name: 'Priya S', regNo: '111625102001', email: 'priya@example.com', review: 'Good' }), 30); // duplicate
      google.addResponse(participant({ name: 'Arun', regNo: '999', eventName: 'AI Bootcamp' }), 20); // unknown event
      google.addResponse(participant({ name: 'Bad Mail', regNo: 'X1', email: 'not-an-email' }), 10); // invalid

      const r = await api('POST', '/settings/sync');
      assert.equal(r.data.result.issued, 2);
      assert.equal(r.data.result.issues, 3);
      assert.equal(google.state.emails.length, 2);

      const dash = await api('GET', '/dashboard');
      const codes = dash.data.issues.map((i) => i.code).sort();
      assert.deepEqual(codes, ['duplicate', 'invalid', 'unknown_event']);
    });

    test('emailed PDF is on the design and the verify link works from any phone', async () => {
      const mail = google.state.emails[0];
      assert.equal(mail.attachments[0].bytes.subarray(0, 4).toString(), '%PDF');
      assert.ok(mail.attachments[0].bytes.length > 100_000);
      assert.match(mail.html, new RegExp(`${google.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?verify=CF-`));
    });

    test('running the check again does not send anything twice', async () => {
      const r = await api('POST', '/settings/sync');
      assert.equal(r.data.result.issued, 0);
      assert.equal(google.state.emails.length, 2);
    });

    test('issued certificates are added to the public register', async () => {
      assert.equal(google.state.register.size, 2);
      const [first] = google.state.register.values();
      assert.match(first.regNo, /^•+\d{4}$/, 'register numbers are partly hidden');
    });

    test('creating the missing event issues the waiting certificate', async () => {
      const r = await api('POST', '/events', { name: 'AI Bootcamp', organizer: 'AI Club', date: '2026-10-18', designPreset: 'rmkcet-query-quest' });
      assert.equal(r.data.adoptedResponses, 1);
      assert.equal(google.state.emails.length, 3);
    });

    test('feedback analytics and Excel export', async () => {
      const r = await api('GET', `/events/${eventId}/feedback`);
      assert.equal(r.data.analytics.total, 2);
      assert.equal(r.data.analytics.averageRating, 5);
      const csv = await api('GET', `/events/${eventId}/export.csv`);
      assert.match(csv.data.toString(), /Nithish Barath R,111625102144/);
    });
  });

  describe('certificate management', () => {
    let cert;

    test('search finds a certificate by register number', async () => {
      const r = await api('GET', '/certificates?search=102144');
      assert.equal(r.data.total, 1);
      [cert] = r.data.certificates;
    });

    test('public verify page shows it as genuine', async () => {
      const r = await api('GET', `/public/verify/${cert.certificateId}`, null, { auth: false });
      assert.equal(r.data.valid, true);
      assert.equal(r.data.certificate.regNo, '••••••••2144');
    });

    test('revoking updates the verify page and the Google register', async () => {
      await api('PATCH', `/certificates/${cert._id}/status`, { status: 'revoked' });
      const r = await api('GET', `/public/verify/${cert.certificateId}`, null, { auth: false });
      assert.equal(r.data.valid, false);
      await api('POST', '/settings/sync');
      assert.equal(google.state.register.get(cert.certificateId).status, 'revoked');
      await api('PATCH', `/certificates/${cert._id}/status`, { status: 'active' });
    });

    test('re-creating certificates keeps their IDs and emails them again', async () => {
      const before = (await api('GET', `/certificates?event=${eventId}`)).data.certificates.map((c) => c.certificateId).sort();
      const emailsBefore = google.state.emails.length;
      const r = await api('POST', `/events/${eventId}/design/regenerate`, { resend: true });
      assert.equal(r.data.result.recreated, 2);
      assert.equal(r.data.result.emailed, 2);
      const afterIds = (await api('GET', `/certificates?event=${eventId}`)).data.certificates.map((c) => c.certificateId).sort();
      assert.deepEqual(afterIds, before);
      assert.equal(google.state.emails.length, emailsBefore + 2);
    });

    test('old PDFs are removed from the database after re-creating', async () => {
      const { default: mongoose } = await import('mongoose');
      const files = await mongoose.connection.db.collection('certificates.files').countDocuments();
      const certs = await mongoose.connection.db.collection('certificates').countDocuments();
      assert.equal(files, certs);
    });

    test('hitting Gmail’s daily limit waits 3 hours instead of using up retries', async () => {
      google.state.failNextEmails = 1;
      const r = await api('POST', `/certificates/${cert._id}/resend`, {});
      assert.equal(r.status, 400);
      const c = await mods.models.Certificate.findById(cert._id);
      assert.equal(c.delivery.status, 'failed');
      assert.match(c.delivery.lastError, /daily email limit/);
      assert.ok(c.delivery.nextAttemptAt - Date.now() > 2.5 * 60 * 60 * 1000);
    });

    test('resend with a corrected email address works', async () => {
      const r = await api('POST', `/certificates/${cert._id}/resend`, { email: 'nithish.new@example.com' });
      assert.equal(r.status, 200);
      assert.equal(google.state.emails.at(-1).to, 'nithish.new@example.com');
    });

    test('an event with certificates cannot be deleted', async () => {
      const r = await api('DELETE', `/events/${eventId}`);
      assert.equal(r.status, 409);
    });
  });
});

describe('small helpers', () => {
  test('image size is read from PNG and JPEG headers', async () => {
    const { imageInfo } = await import('../src/utils/imageSize.js');
    const fs = await import('node:fs');
    const { PRESETS } = await import('../src/templates/presets.js');
    const info = imageInfo(fs.readFileSync(PRESETS['rmkcet-query-quest'].file));
    assert.deepEqual(info, { type: 'image/jpeg', width: 2248, height: 1588 });
    assert.equal(imageInfo(Buffer.from('not an image at all, just text')), null);
  });

  test('event dates are printed in Indian time', async () => {
    const { formatEventDate } = await import('../src/services/certificateFonts.js');
    assert.equal(formatEventDate('2026-10-20T20:00:00Z', 'D MMMM YYYY.'), '21 October 2026.');
    assert.equal(formatEventDate('2026-10-20T04:00:00Z', 'DD/MM/YYYY'), '20/10/2026');
  });

  test('CSV export protects against spreadsheet formulas', async () => {
    const { toCsv } = await import('../src/utils/csv.js');
    const csv = toCsv([{ label: 'Name', value: (r) => r }], ['=HYPERLINK("x")', 'Plain, "quoted"']);
    assert.match(csv, /'=HYPERLINK/);
    assert.match(csv, /"Plain, ""quoted"""/);
  });
});
