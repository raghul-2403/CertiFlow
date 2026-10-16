// Ready-made certificate designs. Positions are fractions of the image:
// x = horizontal centre of the text, y = text baseline (or top edge for the QR),
// size = font height / QR width as a fraction of the image width.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PRESETS = {
  'rmkcet-query-quest': {
    label: 'RMKCET – Query Quest (CSE Student Chapter)',
    file: path.join(here, 'rmkcet-query-quest.jpg'),
    contentType: 'image/jpeg',
    fields: {
      name: { x: 0.6828, y: 0.5176, size: 0.0245, maxWidth: 0.4, color: '#14284B', font: 'cinzel', uppercase: true },
      date: { x: 0.6477, y: 0.6839, size: 0.0158, color: '#15294B', font: 'cormorant', format: 'D MMMM YYYY.' },
      verify: { show: true, x: 0.9128, y: 0.757, size: 0.052 },
    },
    // Award certificates (winner, runner-up, appreciation) use a copy of the design with the
    // "Certificate of Participation" heading removed; CertiFlow writes the award heading there.
    award: {
      file: path.join(here, 'rmkcet-query-quest-award.jpg'),
      contentType: 'image/jpeg',
      heading: {
        kicker: { x: 0.6468, y: 0.3705, size: 0.0175, color: '#B8892B', font: 'cinzel', spacing: 0.32 },
        ribbon: { x: 0.6468, y: 0.3795, w: 0.40, h: 0.052, color: '#14284B', border: '#C9A04A' },
        title: { size: 0.0255, color: '#F4DFA6', font: 'cinzel' },
      },
    },
  },
};

export const DEFAULT_FIELDS = {
  name: { x: 0.5, y: 0.5, size: 0.035, maxWidth: 0.6, color: '#1B2340', font: 'cinzel', uppercase: true },
  date: { x: 0.5, y: 0.65, size: 0.018, color: '#1B2340', font: 'cormorant', format: 'D MMMM YYYY' },
  verify: { show: true, x: 0.9, y: 0.78, size: 0.06 },
};
