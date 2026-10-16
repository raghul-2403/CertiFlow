const IST = 'Asia/Kolkata';

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST }) : '';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST })
    : '';

export function timeAgo(d) {
  if (!d) return 'never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return fmtDateTime(d);
}

// <input type="datetime-local"> wants local time without a timezone
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

export const plural = (n, word, many) => `${n} ${n === 1 ? word : many || `${word}s`}`;
