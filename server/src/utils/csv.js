// Minimal CSV builder (Excel-friendly: BOM + CRLF, quotes escaped, formula injection guarded)
const cell = (v) => {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(','));
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}
