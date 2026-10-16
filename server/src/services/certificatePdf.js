// CertiFlow's own certificate layout (used when an event has no design image, and for award
// certificates on uploaded designs). A4 landscape, navy and gold, with the college logo on top.
// Returns a Buffer.
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { useFont } from './certificateFonts.js';

const C = {
  ink: '#0E1B36',
  muted: '#5B6275',
  navy: '#14284B',
  gold: '#B8892B',
  goldLight: '#F4DFA6',
  paper: '#FFFDF8',
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Shrinks text until it fits the given width
function fitFontSize(doc, text, maxSize, minSize, width, opts = {}) {
  let size = maxSize;
  while (size > minSize && doc.fontSize(size).widthOfString(text, opts) > width) size -= 0.5;
  return size;
}

function centered(doc, text, y, width, x0 = 0, opts = {}) {
  const w = doc.widthOfString(text, opts);
  doc.text(text, x0 + (width - w) / 2, y, { lineBreak: false, ...opts });
}

/** Navy ribbon with notched ends and the award title in gold capitals */
export function drawRibbon(doc, { cx, top, width, height, text, fontKey = 'cinzel', textColor = C.goldLight, fill = C.navy, border = '#C9A04A', maxText }) {
  const L = cx - width / 2;
  const R = cx + width / 2;
  const B = top + height;
  const mid = top + height / 2;
  const notch = height * 0.42;
  doc.save();
  doc.polygon([L, top], [R, top], [R - notch, mid], [R, B], [L, B], [L + notch, mid]).fill(fill);
  const i = Math.max(2, height * 0.08);
  doc.polygon([L + i * 1.6, top + i], [R - i * 1.6, top + i], [R - notch + i * 0.2, mid], [R - i * 1.6, B - i], [L + i * 1.6, B - i], [L + notch - i * 0.2, mid])
    .lineWidth(Math.max(0.5, height * 0.018)).strokeColor(border).stroke();
  doc.restore();
  useFont(doc, fontKey);
  const label = text.toUpperCase();
  const spacing = height * 0.04;
  const size = fitFontSize(doc, label, height * 0.5, 6, maxText || width - notch * 2 - height * 0.5, { characterSpacing: spacing });
  doc.fontSize(size).fillColor(textColor);
  const w = doc.widthOfString(label, { characterSpacing: spacing });
  doc.text(label, cx - w / 2, mid, { lineBreak: false, baseline: 'middle', characterSpacing: spacing });
}

export async function renderCertificatePdf({ certificateId, participant, event, verifyUrl, title, signatories = [], award = null, logo = null, orgName = '' }) {
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 220, color: { dark: C.navy, light: '#FFFFFF' } });
  const heading = award ? award.kicker || 'Certificate of Merit' : title || 'Certificate of Participation';

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: { Title: `${award ? `${heading} (${award.title})` : heading} — ${participant.name}`, Author: event.organizer, Subject: event.name, Keywords: certificateId },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width; // 841.89
  const H = doc.page.height; // 595.28
  const cx = W / 2;

  // Paper, side band and double gold frame
  doc.rect(0, 0, W, H).fill(C.paper);
  doc.rect(0, 0, 18, H).fill(C.navy);
  doc.rect(18, 0, 4, H).fill(C.gold);
  doc.lineWidth(1.2).strokeColor(C.gold).rect(40, 24, W - 64, H - 48).stroke();
  doc.lineWidth(0.5).strokeColor(C.gold).rect(46, 30, W - 76, H - 60).stroke();

  const contentX = 90;
  const contentW = W - 180;
  let y = 44;

  // College logo and name
  if (logo) {
    try {
      doc.image(logo, cx - 30, y, { fit: [60, 60], align: 'center', valign: 'center' });
      y += 68;
    } catch {
      /* unreadable logo: leave it out */
    }
  } else {
    y += 14;
  }
  if (orgName) {
    useFont(doc, 'cinzel');
    doc.fillColor(C.navy).fontSize(fitFontSize(doc, orgName.toUpperCase(), 13, 8, contentW, { characterSpacing: 0.8 }));
    centered(doc, orgName.toUpperCase(), y, contentW, contentX, { characterSpacing: 0.8 });
    y += 20;
  }
  doc.fillColor(C.muted).font('Helvetica').fontSize(10.5);
  centered(doc, event.organizer, y, contentW, contentX, { characterSpacing: 0.6 });
  y += 32;

  if (award) {
    // Kicker in spaced gold capitals, then the award title on a ribbon
    useFont(doc, 'cinzel');
    doc.fillColor(C.gold).fontSize(13);
    centered(doc, heading.toUpperCase(), y, contentW, contentX, { characterSpacing: 4 });
    y += 26;
    drawRibbon(doc, { cx, top: y, width: 340, height: 48, text: award.title });
    y += 70;
  } else {
    useFont(doc, 'cormorant');
    const size = fitFontSize(doc, heading, 40, 22, contentW);
    doc.fillColor(C.navy).fontSize(size);
    centered(doc, heading, y, contentW, contentX);
    y += size + 12;
    doc.moveTo(cx - 60, y).lineTo(cx + 60, y).lineWidth(1.5).strokeColor(C.gold).stroke();
    y += 24;
  }

  useFont(doc, 'cormorant-italic');
  doc.fillColor(C.muted).fontSize(17);
  centered(doc, 'This is to certify that', y, contentW, contentX);
  y += 30;

  // Participant name
  useFont(doc, 'cinzel');
  const nameText = participant.name.toUpperCase();
  const nameSize = fitFontSize(doc, nameText, 30, 16, contentW - 60);
  doc.fillColor(C.navy).fontSize(nameSize);
  centered(doc, nameText, y, contentW, contentX);
  y += nameSize + 12;
  doc.moveTo(cx - 200, y).lineTo(cx + 200, y).lineWidth(0.6).strokeColor(C.gold).stroke();
  y += 18;

  // Details
  doc.fillColor(C.ink).font('Times-Roman').fontSize(14);
  const has = (v) => v && v !== '-';
  const who = [has(participant.regNo) && `Register No. ${participant.regNo}`, has(participant.college) && participant.college].filter(Boolean).join(', ');
  if (who) {
    centered(doc, `${who},`, y, contentW, contentX);
    y += 24;
  }
  centered(doc, award ? award.line : 'has successfully participated in', y, contentW, contentX);
  y += 26;

  const eventSize = fitFontSize(doc.font('Times-Bold'), event.name, 21, 13, contentW - 40);
  doc.font('Times-Bold').fontSize(eventSize).fillColor(C.navy);
  centered(doc, event.name, y, contentW, contentX);
  y += eventSize + 10;

  doc.font('Times-Roman').fontSize(14).fillColor(C.ink);
  const closing = `organised by ${event.organizer} on ${fmtDate(event.date)}${event.venue ? `, ${event.venue}` : ''}.`;
  doc.font('Times-Roman').fontSize(fitFontSize(doc, closing, 14, 10, contentW));
  centered(doc, closing, y, contentW, contentX);

  // Signatories (bottom), up to 3
  const sigs = signatories.slice(0, 3);
  if (sigs.length) {
    const slotW = 180;
    const area = { x: contentX + 100, w: contentW - 100 };
    sigs.forEach((s, i) => {
      const x = sigs.length === 1 ? area.x + area.w - slotW : area.x + (i * (area.w - slotW)) / (sigs.length - 1);
      doc.moveTo(x + 15, 478).lineTo(x + slotW - 15, 478).lineWidth(0.6).strokeColor(C.ink).stroke();
      doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(s.name, x, 485, { width: slotW, align: 'center' });
      doc.fillColor(C.gold).font('Helvetica').fontSize(8.5).text(s.designation.toUpperCase(), x, 499, { width: slotW, align: 'center', characterSpacing: 0.5 });
    });
  }

  // Verification block (bottom left)
  doc.image(qrPng, 70, 440, { width: 62 });
  doc.fillColor(C.muted).font('Helvetica').fontSize(7).text('Certificate ID', 70, 507, { lineBreak: false });
  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(8.5).text(certificateId, 70, 516, { lineBreak: false });
  doc.fillColor(C.muted).font('Helvetica').fontSize(6.5).text('Scan to verify', 70, 528, { lineBreak: false });

  doc.end();
  return done;
}
