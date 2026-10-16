// Draws the event QR code as a designed SVG: rounded navy modules, gold-centred corner
// "eyes", and the college logo in a white circle in the middle.
// With a logo the QR uses error correction level H (30%), so the covered centre still scans.
import QRCode from 'qrcode';

const QUIET = 4; // white margin, in modules (QR standard asks for 4)

export const QR_COLORS = { dark: '#14284B', eye: '#7A5A12' };

const isFinder = (r, c, n) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

function finder(x, y, { dark, eye }) {
  // 7x7 ring (even-odd path) + 3x3 centre
  const ring =
    `M${x + 1.3} ${y}h4.4a1.3 1.3 0 0 1 1.3 1.3v4.4a1.3 1.3 0 0 1-1.3 1.3h-4.4a1.3 1.3 0 0 1-1.3-1.3v-4.4a1.3 1.3 0 0 1 1.3-1.3z` +
    `M${x + 1.6} ${y + 1}h3.8a0.6 0.6 0 0 1 0.6 0.6v3.8a0.6 0.6 0 0 1-0.6 0.6h-3.8a0.6 0.6 0 0 1-0.6-0.6v-3.8a0.6 0.6 0 0 1 0.6-0.6z`;
  return (
    `<path d="${ring}" fill="${dark}" fill-rule="evenodd"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.6" fill="${eye}"/>`
  );
}

/**
 * @param {string} text  what the QR opens (the Google Form link)
 * @param {{ logo?: Buffer, logoType?: string, size?: number, colors?: {dark:string, eye:string} }} opts
 * @returns {string} SVG markup
 */
export function designedQrSvg(text, { logo, logoType = 'image/png', size = 1024, colors = QR_COLORS } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: logo ? 'H' : 'Q' });
  const n = qr.modules.size;
  const total = n + QUIET * 2;
  const mid = total / 2;

  // Logo zone: a circle about a quarter of the code wide (about 5% of its area)
  const logoD = logo ? Math.max(7, Math.round(n * 0.26)) : 0;
  const clearR = logoD / 2 + 0.6;

  let modules = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.modules.get(r, c) || isFinder(r, c, n)) continue;
      const x = c + QUIET;
      const y = r + QUIET;
      if (logo && Math.hypot(x + 0.5 - mid, y + 0.5 - mid) < clearR) continue;
      modules += `<rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="0.28"/>`;
    }
  }

  const finders =
    finder(QUIET, QUIET, colors) + finder(QUIET + n - 7, QUIET, colors) + finder(QUIET, QUIET + n - 7, colors);

  let centre = '';
  if (logo) {
    const box = logoD * 0.78;
    centre =
      `<circle cx="${mid}" cy="${mid}" r="${logoD / 2}" fill="#ffffff"/>` +
      `<circle cx="${mid}" cy="${mid}" r="${logoD / 2 - 0.15}" fill="none" stroke="#B8892B" stroke-width="0.3"/>` +
      `<image x="${mid - box / 2}" y="${mid - box / 2}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet" ` +
      `href="data:${logoType};base64,${logo.toString('base64')}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="geometricPrecision">` +
    `<rect width="${total}" height="${total}" rx="2.4" fill="#ffffff"/>` +
    `<g fill="${colors.dark}">${modules}</g>${finders}${centre}</svg>`
  );
}

export const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
