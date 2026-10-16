// Tests for the version 8 features: attendance check (registered list + event code),
// award certificates, issuing from Excel, the event report, student lookup and the Gmail limit warning.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
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

const answers = (over = {}) => ({
  name: 'Nithish Barath R',
  regNo: '111625102144',
  college: 'RMKCET',
  eventName: 'Hack Night',
  email: 'nithish@example.com',
  rating: '5',
  review: 'Excellent',
  comments: 'Loved it',
  ...over,
});

const sync = () => api('POST', '/settings/sync');
const waitFor = async (fn, ms = 60000) => {
  const end = Date.now() + ms;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 150));
  }
};

async function xlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('certiflow_features');
  process.env.NODE_ENV = 'production';
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
    bridge: await import('../src/services/googleBridge.js'),
    code: await import('../src/services/eventCode.js'),
  };
  google = await startFakeGoogleScript({ secret: await mods.bridge.getScriptSecret() });
  token = (await api('POST', '/auth/login', { email: 'admin@certiflow.local', password: 'Admin@123' })).data.token;
  await mods.models.setSetting('google.scriptUrl', google.url);
  await api('POST', '/settings/google/test');
});

after(async () => {
  server?.close();
  await google?.close();
  const { disconnectDB } = await import('../src/config/db.js');
  await disconnectDB();
  await mongo?.stop();
});

describe('attendance check', () => {
  let event;

  test('event is created', async () => {
    const r = await api('POST', '/events', { name: 'Hack Night', organizer: 'Coding Club', date: '2026-10-20T18:00:00+05:30' });
    assert.equal(r.status, 201);
    event = r.data.event;
  });

  test('turning on "registered only" needs the list first', async () => {
    const r = await api('PATCH', `/events/${event._id}/access`, { registeredOnly: true });
    assert.equal(r.status, 400);
  });

  test('registered list is read from Excel, whatever the column order', async () => {
    const file = await xlsx([
      ['S.No', 'Student Name', 'E-mail', 'Register Number', 'College Name'],
      [1, 'Nithish Barath R', 'nithish@example.com', 111625102144, 'RMKCET'],
      [2, 'Divya K', 'divya@example.com', '111625102150', 'RMKCET'],
      [3, 'Arun M', 'arun@example.com', '111625102151 ', 'RMD'],
    ]);
    const r = await api('POST', `/events/${event._id}/registrations`, file, { raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.added, 3);
    assert.equal(r.data.columns.regNo, 'Register Number');
    assert.equal(r.data.columns.name, 'Student Name');
    const list = await api('GET', `/events/${event._id}/registrations?search=divya`);
    assert.equal(list.data.total, 3);
    assert.equal(list.data.registrations[0].regNo, '111625102150');
  });

  test('CSV with semicolons and quotes is read too', async () => {
    const csv = Buffer.from('﻿Reg No;Name;Email\n"111625102152";"Kumar, S";kumar@example.com\n');
    const r = await api('POST', `/events/${event._id}/registrations`, csv, { raw: true, headers: { 'content-type': 'text/csv' } });
    assert.equal(r.data.added, 1);
    const list = await api('GET', `/events/${event._id}/registrations?search=kumar`);
    assert.equal(list.data.registrations[0].name, 'Kumar, S');
  });

  test('only registered students get a certificate automatically', async () => {
    await api('PATCH', `/events/${event._id}/access`, { registeredOnly: true });
    google.addResponse(answers(), 30);
    google.addResponse(answers({ name: 'Gate Crasher', regNo: '999999999', email: 'gc@example.com' }), 20);
    const r = await sync();
    assert.equal(r.data.result.issued, 1);
    assert.equal(r.data.result.issues, 1);
    const dash = await api('GET', '/dashboard');
    const held = dash.data.issues.find((i) => i.code === 'not_registered');
    assert.match(held.reason, /999999999 is not on the registered list/);
    assert.equal(held.event.name, 'Hack Night');
  });

  test('adding a held student to the list releases their certificate', async () => {
    const before = google.state.emails.length;
    const csv = Buffer.from('Register No,Name\n999999999,Gate Crasher\n');
    const r = await api('POST', `/events/${event._id}/registrations`, csv, { raw: true, headers: { 'content-type': 'text/csv' } });
    assert.equal(r.data.released, 1);
    assert.equal(google.state.emails.length, before + 1);
  });

  test('event code: wrong or missing code is held, the projector code is accepted', async () => {
    await api('PATCH', `/events/${event._id}/access`, { registeredOnly: false, codeRequired: true });
    const shown = await api('GET', `/events/${event._id}/code`);
    assert.equal(shown.data.enabled, true);
    assert.match(shown.data.code, /^\d{4}$/);
    const wrong = shown.data.code === '0000' ? '1111' : '0000';
    google.addResponse(answers({ name: 'Code Right', regNo: '111625102150', email: 'divya@example.com', code: ` ${shown.data.code} ` }), 5);
    google.addResponse(answers({ name: 'Code Wrong', regNo: '111625102151', email: 'arun@example.com', code: wrong }), 4);
    google.addResponse(answers({ name: 'No Code', regNo: '111625102152', email: 'kumar@example.com' }), 3);
    const r = await sync();
    assert.equal(r.data.result.issued, 1);
    assert.equal(r.data.result.issues, 2);
  });

  test('a code from a few minutes earlier still counts; a much older one does not', async () => {
    const ev = await mods.models.Event.findById(event._id);
    const now = Date.now();
    const fiveMinAgo = mods.code.currentCode(ev, now - 5 * 60 * 1000).code;
    assert.equal(mods.code.codeMatches(ev, fiveMinAgo, new Date(now)), true);
    const hourAgo = mods.code.currentCode(ev, now - 60 * 60 * 1000).code;
    const sameByChance = [0, 1, 2].some((b) => mods.code.currentCode(ev, now - b * 5 * 60 * 1000).code === hourAgo);
    if (!sameByChance) assert.equal(mods.code.codeMatches(ev, hourAgo, new Date(now)), false);
  });

  test('coordinator can approve a held response from the inbox', async () => {
    const dash = await api('GET', '/dashboard');
    const held = dash.data.issues.find((i) => i.code === 'wrong_code');
    const r = await api('POST', `/dashboard/issues/${held._id}/assign`, { eventId: event._id });
    assert.equal(r.status, 200);
    assert.equal(r.data.result.status, 'issued');
  });

  test('switching the code off releases what it was holding', async () => {
    const r = await api('PATCH', `/events/${event._id}/access`, { codeRequired: false });
    assert.equal(r.data.released, 1);
    assert.equal(r.data.access.held, 0);
  });
});

describe('award certificates', () => {
  let event;
  let feedbackId;

  test('award types are listed', async () => {
    const r = await api('GET', '/events/meta/award-types');
    assert.ok(r.data.types.some((t) => t.key === 'first' && t.title === 'First Place'));
  });

  test('winner gets a merit certificate on the RMKCET design by email', async () => {
    event = (await api('POST', '/events', { name: 'Query Quest 2', organizer: 'CSE Student Chapter Association', date: '2026-10-21T10:00:00+05:30', designPreset: 'rmkcet-query-quest' })).data.event;
    google.addResponse(answers({ eventName: 'Query Quest 2', regNo: '111625102200', name: 'Aishwarya Ramesh', email: 'aish@example.com' }), 2);
    await sync();
    const fb = await api('GET', `/events/${event._id}/feedback`);
    feedbackId = fb.data.feedback[0]._id;
    const before = google.state.emails.length;
    const r = await api('POST', `/events/${event._id}/awards`, { type: 'first', feedbackId });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.certificate.kind, 'award');
    assert.equal(r.data.certificate.award.title, 'First Place');
    assert.equal(r.data.certificate.delivery.status, 'sent');
    const mail = google.state.emails[before];
    assert.match(mail.subject, /Congratulations! Your First Place certificate/);
    assert.match(mail.html, /linkedin\.com\/profile\/add/);
    assert.ok(mail.attachments[0].bytes.length > 100_000, 'drawn on the design image');
  });

  test('the same award twice is refused', async () => {
    const r = await api('POST', `/events/${event._id}/awards`, { type: 'first', feedbackId });
    assert.equal(r.status, 409);
  });

  test('volunteer without a form response gets an appreciation certificate', async () => {
    const r = await api('POST', `/events/${event._id}/awards`, { type: 'volunteer', participant: { name: 'Helper One', email: 'helper@example.com' } });
    assert.equal(r.status, 201);
    assert.equal(r.data.certificate.participant.regNo, '-');
    const bad = await api('POST', `/events/${event._id}/awards`, { type: 'volunteer', participant: { name: 'X', email: 'nope' } });
    assert.equal(bad.status, 400);
  });

  test('awards are listed and do not change the participation numbers', async () => {
    const r = await api('GET', `/events/${event._id}/awards`);
    assert.equal(r.data.awards.length, 2);
    const ev = await api('GET', `/events/${event._id}`);
    assert.equal(ev.data.event.stats.certificatesIssued, 1);
    assert.equal(ev.data.event.stats.emailed, 1);
    assert.equal(ev.data.event.stats.awardsIssued, 2);
  });

  test('verify page shows the award', async () => {
    const [a] = (await api('GET', `/events/${event._id}/awards`)).data.awards;
    const r = await api('GET', `/public/verify/${a.certificateId}`, null, { auth: false });
    assert.equal(r.data.valid, true);
    assert.ok(['First Place', 'Volunteer'].includes(r.data.certificate.award));
  });

  test('award preview PDF and re-creating keeps awards as awards', async () => {
    const p = await api('GET', `/events/${event._id}/awards/preview.pdf?type=second`);
    assert.equal(p.data.subarray(0, 4).toString(), '%PDF');
    const r = await api('POST', `/events/${event._id}/design/regenerate`, { resend: false });
    assert.equal(r.data.result.recreated, 3);
    const awards = (await api('GET', `/events/${event._id}/awards`)).data.awards;
    assert.ok(awards.every((a) => a.kind === 'award'));
  });
});

describe('issue certificates from Excel', () => {
  let event;
  let rows;

  test('preview marks each row ready or skipped', async () => {
    event = (await api('POST', '/events', { name: 'Guest Lecture', organizer: 'IEEE SB', date: '2026-10-22T11:00:00+05:30' })).data.event;
    const file = await xlsx([
      ['Name', 'Reg No', 'Email ID', 'College'],
      ['Student A', '111625109001', 'a@example.com', 'RMKCET'],
      ['Student B', '111625109002', 'b@example.com', 'RMKCET'],
      ['Student B again', '111625109002', 'b2@example.com', 'RMKCET'],
      ['No Mail', '111625109003', '', 'RMKCET'],
      ['', '111625109004', 'nameless@example.com', 'RMKCET'],
    ]);
    const r = await api('POST', `/events/${event._id}/bulk/preview`, file, { raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    rows = r.data.rows;
    assert.equal(r.data.ready, 2);
    assert.deepEqual(rows.map((x) => x.reason), [null, null, 'Listed twice in the file', 'No email', 'No name']);
  });

  test('issuing runs in the background and emails everyone', async () => {
    const before = google.state.emails.length;
    const start = await api('POST', `/events/${event._id}/bulk`, { people: rows });
    assert.equal(start.status, 202);
    const job = await waitFor(async () => {
      const j = (await api('GET', `/events/${event._id}/bulk/${start.data.job.id}`)).data.job;
      return j.status === 'done' ? j : null;
    });
    assert.equal(job.issued, 2);
    assert.equal(job.emailed, 2);
    assert.equal(google.state.emails.length, before + 2);
  });

  test('a second upload of the same list skips people who already have one', async () => {
    const file = await xlsx([['Name', 'Reg No', 'Email'], ['Student A', '111625109001', 'a@example.com']]);
    const r = await api('POST', `/events/${event._id}/bulk/preview`, file, { raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(r.data.ready, 0);
    assert.equal(r.data.rows[0].reason, 'Already has a certificate for this event');
  });

  test('people from a list have no rating, and the average ignores them', async () => {
    const r = await api('GET', `/events/${event._id}/feedback`);
    assert.equal(r.data.analytics.total, 2);
    assert.equal(r.data.analytics.averageRating, null);
  });

  test('old .xls files get a clear message', async () => {
    const r = await api('POST', `/events/${event._id}/bulk/preview`, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]), { raw: true, headers: { 'content-type': 'application/octet-stream' } });
    assert.equal(r.status, 400);
    assert.match(r.data.message, /\.xlsx/);
  });
});

describe('report, student lookup and Gmail limit', () => {
  test('event report PDF has every section', async () => {
    const events = (await api('GET', '/events')).data.events;
    const qq = events.find((e) => e.name === 'Query Quest 2');
    const r = await api('GET', `/events/${qq._id}/report.pdf`);
    assert.equal(r.status, 200);
    assert.equal(r.data.subarray(0, 4).toString(), '%PDF');
    assert.ok(r.data.length > 5000);
  });

  test('a student finds all their certificates with register number + email', async () => {
    const r = await api('POST', '/public/my-certificates', { regNo: '111625102200', email: 'AISH@example.com ' }, { auth: false });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, 'Aishwarya Ramesh');
    assert.equal(r.data.certificates.length, 2, 'participation + First Place');
    const dl = await fetch(`${base}${r.data.certificates[0].download}`);
    assert.equal(dl.status, 200);
    assert.equal(Buffer.from(await dl.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  });

  test('the wrong email finds nothing, and download links cannot be reused for another certificate', async () => {
    const r = await api('POST', '/public/my-certificates', { regNo: '111625102200', email: 'other@example.com' }, { auth: false });
    assert.equal(r.data.certificates.length, 0);
    const good = await api('POST', '/public/my-certificates', { regNo: '111625102200', email: 'aish@example.com' }, { auth: false });
    const [a, b] = good.data.certificates;
    const swapped = a.download.replace(a.certificateId, b.certificateId);
    assert.equal((await fetch(`${base}${swapped}`)).status, 401);
  });

  test('dashboard shows how many emails Gmail still allows today', async () => {
    const r = await api('GET', '/dashboard');
    assert.equal(r.data.email.leftToday, 100 - google.state.emails.length);
  });

  test('student lookup is rate limited', async () => {
    let last;
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await api('POST', '/public/my-certificates', { regNo: 'X', email: 'x@example.com' }, { auth: false });
    }
    assert.equal(last.status, 429);
  });
});
