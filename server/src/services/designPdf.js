// Renders a certificate on top of a coordinator's own design (PNG/JPG):
// the participant's name, the event date and a small verification QR + certificate ID.
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formatEventDate, useFont } from './certificateFonts.js';
import { drawRibbon } from './certificatePdf.js';

const PAGE_W = 841.89; // A4 landscape width in points

function placeText(doc, text, field, page) {
  if (!text || !field) return;
  const maxW = (field.maxWidth || 0.8) * page.w;
  let size = field.size * page.w;
  useFont(doc, field.font);
  // shrink long names until they fit the line
  while (size > 6 && doc.fontSize(size).widthOfString(text) > maxW) size -= 0.5;
  const width = doc.fontSize(size).widthOfString(text);
  doc.fillColor(field.color || '#000000')
    .text(text, field.x * page.w - width / 2, field.y * page.h, { lineBreak: false, baseline: 'alphabetic' });
}

export async function renderDesignCertificatePdf({ image, imageWidth, imageHeight, fields, certificateId, participant, event, verifyUrl, award = null, heading = null }) {
  const page = { w: PAGE_W, h: (PAGE_W * imageHeight) / imageWidth };
  const doc = new PDFDocument({
    size: [page.w, page.h],
    margin: 0,
    info: { Title: `Certificate — ${participant.name}`, Author: event.organizer, Subject: event.name, Keywords: certificateId },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.image(image, 0, 0, { width: page.w, height: page.h });

  // Award certificates: "CERTIFICATE OF MERIT" in spaced capitals and the award title on a ribbon
  if (award && heading) {
    const k = heading.kicker;
    const kicker = (award.kicker || 'Certificate of Merit').toUpperCase();
    useFont(doc, k.font);
    let size = k.size * page.w;
    const spacing = () => size * (k.spacing || 0);
    while (size > 6 && doc.fontSize(size).widthOfString(kicker, { characterSpacing: spacing() }) > heading.ribbon.w * page.w * 0.98) size -= 0.5;
    const kw = doc.fontSize(size).widthOfString(kicker, { characterSpacing: spacing() });
    doc.fillColor(k.color).text(kicker, k.x * page.w - kw / 2, k.y * page.h, { lineBreak: false, baseline: 'alphabetic', characterSpacing: spacing() });
    const r = heading.ribbon;
    drawRibbon(doc, {
      cx: r.x * page.w,
      top: r.y * page.h,
      width: r.w * page.w,
      height: r.h * page.h,
      text: award.title,
      fill: r.color,
      border: r.border,
      textColor: heading.title.color,
      fontKey: heading.title.font,
    });
  }

  const name = fields.name?.uppercase ? participant.name.toUpperCase() : participant.name;
  placeText(doc, name, fields.name, page);
  placeText(doc, formatEventDate(event.date, fields.date?.format), fields.date, page);

  const v = fields.verify;
  if (v?.show) {
    const size = v.size * page.w;
    const left = v.x * page.w - size / 2;
    const top = v.y * page.h;
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300, color: { dark: '#14284B', light: '#FFFFFF' } });
    doc.image(qr, left, top, { width: size });
    doc.font('Helvetica-Bold').fontSize(Math.max(5, size * 0.13)).fillColor('#14284B');
    const idW = doc.widthOfString(certificateId);
    doc.text(certificateId, v.x * page.w - idW / 2, top + size + 2, { lineBreak: false });
    doc.font('Helvetica').fontSize(Math.max(4, size * 0.11)).fillColor('#5B6275');
    const hint = 'Scan to verify';
    doc.text(hint, v.x * page.w - doc.widthOfString(hint) / 2, top + size + 2 + size * 0.17, { lineBreak: false });
  }

  doc.end();
  return done;
}
