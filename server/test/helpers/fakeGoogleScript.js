// A stand-in for the Google Apps Script web app, used by the tests.
// It behaves like the real one: JSON answers, a 302 redirect after POST,
// form responses, email sending, and the certificate register.
import http from 'node:http';

export function startFakeGoogleScript({ secret }) {
  const prefix = Math.random().toString(36).slice(2, 8);
  const state = {
    responses: [],
    emails: [],
    register: new Map(),
    failNextEmails: 0,
    failMessage: 'Service invoked too many times for one day: email.',
    version: 3,
    quota: 100, // Gmail's daily allowance
  };
  const results = new Map();
  let n = 0;

  const send = (res, obj) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/echo') return send(res, results.get(url.searchParams.get('id')));

    if (req.method === 'GET') {
      if (url.searchParams.has('verify')) {
        const row = state.register.get(url.searchParams.get('verify'));
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(row ? `<h1>${row.status === 'active' ? 'genuine' : 'revoked'}</h1>` : '<h1>Not a valid certificate</h1>');
      }
      if (url.searchParams.get('key') !== secret) return send(res, { ok: false, error: 'unauthorized' });
      if (url.searchParams.get('action') === 'responses') {
        const since = new Date(url.searchParams.get('since'));
        const list = state.responses.filter((r) => new Date(r.submittedAt) > since);
        return send(res, { ok: true, count: list.length, hasMore: false, responses: list });
      }
      return send(res, {
        ok: true,
        version: state.version,
        verify: state.version >= 2,
        codeQuestion: state.version >= 3,
        registerUrl: 'https://docs.google.com/spreadsheets/d/FAKE',
        formTitle: 'Event Feedback & Certificate',
        formUrl: 'https://docs.google.com/forms/d/e/FAKE/viewform',
        editUrl: 'https://docs.google.com/forms/d/FAKE/edit',
        eventEntryId: '1234567',
        acceptingResponses: true,
        emailQuota: state.quota - state.emails.length,
      });
    }

    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const b = JSON.parse(body);
      let out;
      if (b.key !== secret) out = { ok: false, error: 'unauthorized' };
      else if (b.action === 'sendEmail') {
        if (state.failNextEmails > 0) {
          state.failNextEmails -= 1;
          out = { ok: false, error: `Exception: ${state.failMessage}` };
        } else {
          state.emails.push({ to: b.to, subject: b.subject, html: b.html, attachments: b.attachments.map((a) => ({ filename: a.filename, bytes: Buffer.from(a.base64, 'base64') })) });
          out = { ok: true, emailQuota: state.quota - state.emails.length };
        }
      } else if (b.action === 'publish') {
        for (const r of b.records) state.register.set(r.certificateId, r);
        out = { ok: true, published: b.records.length };
      } else out = { ok: false, error: 'unknown action' };
      n += 1;
      results.set(String(n), out);
      res.writeHead(302, { location: `/echo?id=${n}` }); // Apps Script answers POSTs with a redirect
      res.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({
        url: `http://localhost:${port}/exec`,
        state,
        addResponse(answers, secondsAgo = 0) {
          // Google's response ids are unique; a prefix per fake keeps them unique across fakes too
          const id = `R${prefix}${state.responses.length + 1}`;
          state.responses.push({ id, submittedAt: new Date(Date.now() - secondsAgo * 1000).toISOString(), answers });
          return id;
        },
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
