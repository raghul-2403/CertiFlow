// Fonts available for text placed on uploaded certificate designs.
// Files come from @fontsource packages (bundled with npm, no internet needed at runtime).
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);

export const FONTS = {
  cinzel: { label: 'Cinzel (classic capitals)', file: fontFile('@fontsource/cinzel', 'cinzel-latin-700-normal.woff') },
  cormorant: { label: 'Cormorant Garamond', file: fontFile('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-700-normal.woff') },
  'cormorant-italic': {
    label: 'Cormorant Garamond italic',
    file: fontFile('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-700-italic.woff'),
  },
  times: { label: 'Times bold', builtin: 'Times-Bold' },
  helvetica: { label: 'Helvetica bold', builtin: 'Helvetica-Bold' },
};

export function useFont(doc, key) {
  const f = FONTS[key] || FONTS.times;
  if (f.builtin) return doc.font(f.builtin);
  doc.registerFont(key, f.file);
  return doc.font(key);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const DATE_FORMATS = ['D MMMM YYYY', 'D MMMM YYYY.', 'DD/MM/YYYY', 'MMMM D, YYYY'];

// Formats in Indian time so an evening event doesn't show the next day
export function formatEventDate(date, format = 'D MMMM YYYY') {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(new Date(date))
      .map((p) => [p.type, p.value])
  );
  const d = Number(parts.day);
  const m = Number(parts.month);
  const y = parts.year;
  switch (format) {
    case 'DD/MM/YYYY': return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    case 'MMMM D, YYYY': return `${MONTHS[m - 1]} ${d}, ${y}`;
    case 'D MMMM YYYY.': return `${d} ${MONTHS[m - 1]} ${y}.`;
    default: return `${d} ${MONTHS[m - 1]} ${y}`;
  }
}
