// One-click event report for the HOD / department records (NAAC, NBA files):
// summary numbers, feedback charts, colleges, awards, comments and the full participant list.
import PDFDocument from 'pdfkit';
import { Certificate, Feedback, REVIEW_OPTIONS } from '../models/index.js';
import { orgInfo, orgLogo } from './orgService.js';
import { useFont } from './certificateFonts.js';

const C = { ink: '#0E1B36', soft: '#3B4660', muted: '#6B7385', navy: '#14284B', gold: '#B8892B', line: '#E4E0D6', wash: '#F6F5F1', ok: '#1E7A55', bad: '#B42318' };
const M = 48; // page margin

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function fit(doc, text, width) {
  let t = String(text ?? '');
  if (doc.widthOfString(t) <= width) return t;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t}…`;
}

export async function renderEventReport(event) {
  const [feedback, certs, org, logo] = await Promise.all([
    Feedback.find({ event: event._id }).sort({ submittedAt: 1 }).lean(),
    Certificate.find({ event: event._id }).sort({ issuedAt: 1 }).lean(),
    orgInfo(),
    orgLogo(),
  ]);
  const participation = certs.filter((c) => c.kind !== 'award');
  const awards = certs.filter((c) => c.kind === 'award');
  const certByFeedback = new Map(participation.map((c) => [String(c.feedback), c]));
  const rated = feedback.filter((f) => f.rating);
  const avg = rated.length ? rated.reduce((s, f) => s + f.rating, 0) / rated.length : null;
  const emailed = participation.filter((c) => c.delivery?.status === 'sent' && c.status === 'active').length;
  const colleges = Object.entries(feedback.reduce((m, f) => ({ ...m, [f.participant.college]: (m[f.participant.college] || 0) + 1 }), {}))
    .filter(([name]) => name && name !== '-')
    .sort((a, b) => b[1] - a[1]);
  const comments = feedback.filter((f) => f.comments).slice(-40).reverse();

  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: `Event report: ${event.name}`, Author: org.name || event.organizer } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const W = doc.page.width - M * 2;
  const bottom = () => doc.page.height - M - 20;
  let y = M;
  const ensure = (h) => {
    if (y + h > bottom()) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text) => {
    ensure(60);
    y += 10;
    useFont(doc, 'cormorant');
    doc.fillColor(C.navy).fontSize(17).text(text, M, y, { lineBreak: false });
    y += 24;
    doc.moveTo(M, y).lineTo(M + 40, y).lineWidth(1.5).strokeColor(C.gold).stroke();
    y += 12;
  };

  // ---- Header ----
  let textX = M;
  if (logo) {
    try {
      doc.image(logo.buffer, M, y, { fit: [54, 54] });
      textX = M + 68;
    } catch {
      /* skip unreadable logo */
    }
  }
  useFont(doc, 'cinzel');
  doc.fillColor(C.navy).fontSize(12).text((org.name || event.organizer).toUpperCase(), textX, y + 6, { width: W - (textX - M), characterSpacing: 0.5 });
  doc.font('Helvetica').fontSize(10).fillColor(C.muted).text(org.unit || event.organizer, textX, doc.y + 2, { width: W - (textX - M) });
  y = Math.max(y + 62, doc.y + 12);
  doc.rect(M, y, W, 2.5).fill(C.gold);
  y += 18;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.gold).text('EVENT REPORT', M, y, { characterSpacing: 2 });
  y += 14;
  useFont(doc, 'cormorant');
  doc.fillColor(C.ink).fontSize(30).text(event.name, M, y, { width: W });
  y = doc.y + 4;
  const facts = [
    ['Date', `${fmtDate(event.date)}, ${fmtTime(event.date)}`],
    ['Organised by', event.organizer],
    event.venue ? ['Venue', event.venue] : null,
    ['Report generated', `${fmtDate(new Date())}, ${fmtTime(new Date())}`],
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(10);
  for (const [k, v] of facts) {
    doc.fillColor(C.muted).text(k, M, y, { width: 110, lineBreak: false });
    doc.fillColor(C.ink).text(v, M + 110, y, { width: W - 110 });
    y = doc.y + 3;
  }
  if (event.description) {
    y += 4;
    doc.fillColor(C.soft).fontSize(10).text(event.description, M, y, { width: W });
    y = doc.y;
  }
  y += 16;

  // ---- Key numbers ----
  const kpis = [
    ['Participants', feedback.length],
    ['Certificates issued', participation.length],
    ['Emailed', `${emailed}${participation.length ? ` (${Math.round((emailed / participation.length) * 100)}%)` : ''}`],
    ['Average rating', avg == null ? '-' : `${avg.toFixed(1)} / 5`],
    ['Colleges', colleges.length],
    ['Awards', awards.length],
  ];
  const boxW = (W - 10 * 2) / 3;
  kpis.forEach(([label, value], i) => {
    const bx = M + (i % 3) * (boxW + 10);
    const by = y + Math.floor(i / 3) * 62;
    doc.roundedRect(bx, by, boxW, 54, 6).fillAndStroke('#FFFFFF', C.line);
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(label, bx + 12, by + 10, { lineBreak: false });
    useFont(doc, 'cormorant');
    doc.fontSize(22).fillColor(C.ink).text(String(value), bx + 12, by + 22, { lineBreak: false });
  });
  y += 62 * 2 + 6;

  // ---- Feedback charts ----
  if (rated.length) {
    heading('What participants said');
    const bars = (title, rows, x, width, color) => {
      let by = y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(title, x, by, { lineBreak: false });
      by += 18;
      const max = Math.max(1, ...rows.map((r) => r[1]));
      for (const [label, n] of rows) {
        doc.font('Helvetica').fontSize(9.5).fillColor(C.soft).text(label, x, by, { width: 70, lineBreak: false });
        const bw = width - 70 - 34;
        doc.roundedRect(x + 72, by + 2, bw, 7, 3.5).fill(C.wash);
        if (n) doc.roundedRect(x + 72, by + 2, Math.max(7, (bw * n) / max), 7, 3.5).fill(color);
        doc.fillColor(C.ink).text(String(n), x + width - 28, by, { width: 28, align: 'right', lineBreak: false });
        by += 18;
      }
      return by;
    };
    const half = (W - 24) / 2;
    const reviewRows = REVIEW_OPTIONS.map((o) => [o, rated.filter((f) => f.review === o).length]);
    const ratingRows = [5, 4, 3, 2, 1].map((r) => [`${r} star${r > 1 ? 's' : ''}`, rated.filter((f) => f.rating === r).length]);
    const y1 = bars('How was the event?', reviewRows, M, half, C.navy);
    const y2 = bars('Rating', ratingRows, M + half + 24, half, C.gold);
    y = Math.max(y1, y2) + 6;
  }

  // ---- Colleges ----
  if (colleges.length) {
    heading('Colleges');
    doc.font('Helvetica').fontSize(10);
    for (const [name, n] of colleges.slice(0, 15)) {
      ensure(18);
      doc.fillColor(C.ink).text(fit(doc, name, W - 80), M, y, { lineBreak: false });
      doc.fillColor(C.muted).text(`${n} participant${n === 1 ? '' : 's'}`, M + W - 80, y, { width: 80, align: 'right', lineBreak: false });
      y += 17;
    }
    if (colleges.length > 15) {
      doc.fillColor(C.muted).text(`and ${colleges.length - 15} more`, M, y);
      y += 17;
    }
  }

  // ---- Awards ----
  if (awards.length) {
    heading('Awards');
    doc.font('Helvetica').fontSize(10);
    for (const a of awards) {
      ensure(18);
      doc.font('Helvetica-Bold').fillColor(C.gold).text(fit(doc, a.award?.title || 'Award', 130), M, y, { lineBreak: false });
      doc.font('Helvetica').fillColor(C.ink).text(fit(doc, `${a.participant.name}${a.participant.college && a.participant.college !== '-' ? `, ${a.participant.college}` : ''}`, W - 250), M + 140, y, { lineBreak: false });
      doc.fillColor(C.muted).text(a.certificateId, M + W - 105, y, { width: 105, align: 'right', lineBreak: false });
      y += 18;
    }
  }

  // ---- Comments ----
  if (comments.length) {
    heading('Comments');
    for (const f of comments) {
      useFont(doc, 'cormorant-italic');
      doc.fontSize(12);
      const h = doc.heightOfString(`“${f.comments}”`, { width: W });
      ensure(h + 22);
      doc.fillColor(C.ink).text(`“${f.comments}”`, M, y, { width: W });
      y = doc.y + 1;
      doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(`${f.participant.name}, ${f.participant.college}${f.rating ? `  ·  ${f.rating}/5` : ''}`, M, y);
      y = doc.y + 9;
    }
  }

  // ---- Participant list ----
  doc.addPage();
  y = M;
  heading(`Participants and certificates (${feedback.length})`);
  const cols = [
    { label: '#', w: 24 },
    { label: 'Name', w: 128 },
    { label: 'Register no.', w: 84 },
    { label: 'College', w: 112 },
    { label: 'Certificate ID', w: 92 },
    { label: 'Email', w: W - 24 - 128 - 84 - 112 - 92 },
  ];
  const header = () => {
    doc.rect(M, y, W, 20).fill(C.wash);
    let x = M + 6;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.soft);
    for (const c of cols) {
      doc.text(c.label, x, y + 6, { width: c.w - 6, lineBreak: false });
      x += c.w;
    }
    y += 24;
  };
  header();
  feedback.forEach((f, i) => {
    if (y + 16 > bottom()) {
      doc.addPage();
      y = M;
      header();
    }
    const cert = certByFeedback.get(String(f._id));
    const status = !cert ? 'No certificate' : cert.status === 'revoked' ? 'Revoked' : cert.delivery?.status === 'sent' ? 'Sent' : cert.delivery?.status === 'failed' ? 'Failed' : 'Sending';
    const values = [String(i + 1), f.participant.name, f.participant.regNo, f.participant.college === '-' ? '' : f.participant.college, cert?.certificateId || '-', status];
    let x = M + 6;
    doc.font('Helvetica').fontSize(8.5);
    values.forEach((v, j) => {
      doc.fillColor(j === 5 ? (status === 'Sent' ? C.ok : status === 'Failed' || status === 'Revoked' ? C.bad : C.muted) : C.ink);
      doc.text(fit(doc, v, cols[j].w - 8), x, y, { lineBreak: false });
      x += cols[j].w;
    });
    y += 15;
    doc.moveTo(M, y - 3).lineTo(M + W, y - 3).lineWidth(0.4).strokeColor(C.line).stroke();
  });
  if (!feedback.length) {
    doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('No participants yet.', M, y);
  }

  // ---- Footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing in the margin must not start a new page
    const fy = doc.page.height - M + 10;
    doc.moveTo(M, fy - 6).lineTo(M + W, fy - 6).lineWidth(0.4).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(C.muted);
    doc.text(`${event.name}: event report`, M, fy, { lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, M, fy, { width: W, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
