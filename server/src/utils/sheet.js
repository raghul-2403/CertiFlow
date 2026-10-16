// Reads a student list from an Excel (.xlsx) or CSV file and finds the
// name / register number / email / college columns, whatever order they are in.
import ExcelJS from 'exceljs';
import { ApiError } from './ApiError.js';

export const MAX_ROWS = 5000;

const HEADER_PATTERNS = {
  regNo: /reg(ister|istration)?\s*(no|num|number|\.)?|roll\s*(no|num|number)?|enrol+ment|usn|student\s*id|^id$/i,
  email: /e-?mail|mail\s*id/i,
  college: /college|institution|institute|university|school/i,
  name: /name/i,
};

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (value.richText) return value.richText.map((r) => r.text).join('');
    if (value.text != null) return String(value.text); // hyperlink cell
    if (value.result != null) return String(value.result); // formula cell
    if (value.error) return '';
  }
  if (typeof value === 'number' && Number.isInteger(value)) return value.toFixed(0); // long register numbers stay whole
  return String(value);
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function readRows(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw ApiError.badRequest('The file is empty');
  // .xlsx files are zip archives, which start with "PK"
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer);
    } catch {
      throw ApiError.badRequest('Could not read this Excel file. Save it as .xlsx or .csv and try again.');
    }
    const sheet = wb.worksheets.find((ws) => ws.actualRowCount > 0);
    if (!sheet) throw ApiError.badRequest('The Excel file has no data');
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (r) => {
      const values = [];
      r.eachCell({ includeEmpty: true }, (cell, col) => { values[col - 1] = cellText(cell.value).trim(); });
      rows.push(Array.from(values, (v) => v ?? ''));
    });
    return rows;
  }
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf) {
    throw ApiError.badRequest('This is an old Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx), then upload that.');
  }
  return parseCsv(buffer.toString('utf8').replace(/^﻿/, '')).map((r) => r.map((v) => v.trim()));
}

// Which column holds what. Uses the header row if there is one, otherwise looks at the data.
function detectColumns(rows) {
  const headerRowIndex = rows.slice(0, 5).findIndex((r) => r.some((v) => HEADER_PATTERNS.regNo.test(v) || HEADER_PATTERNS.email.test(v)));
  const cols = {};
  if (headerRowIndex >= 0) {
    const header = rows[headerRowIndex];
    for (const key of ['regNo', 'email', 'college', 'name']) {
      const idx = header.findIndex((h, i) => HEADER_PATTERNS[key].test(h) && !Object.values(cols).includes(i));
      if (idx >= 0) cols[key] = idx;
    }
    return { cols, dataStart: headerRowIndex + 1, header };
  }
  // No header: guess from the values in the first rows
  const sample = rows.slice(0, 20);
  const width = Math.max(...sample.map((r) => r.length));
  const share = (i, test) => sample.filter((r) => test(r[i] || '')).length / sample.length;
  for (let i = 0; i < width; i += 1) {
    if (cols.email == null && share(i, (v) => /@/.test(v)) > 0.6) cols.email = i;
    else if (cols.regNo == null && share(i, (v) => /^[A-Z0-9]*\d{5,}[A-Z0-9]*$/i.test(v.replace(/\s/g, ''))) > 0.6) cols.regNo = i;
    else if (cols.name == null && share(i, (v) => /^[A-Za-z][A-Za-z .']{2,}$/.test(v)) > 0.6) cols.name = i;
  }
  return { cols, dataStart: 0, header: null };
}

/**
 * @returns {Promise<{ people: Array<{row:number, name:string, regNo:string, email:string, college:string}>, columns: object, totalRows: number }>}
 */
export async function readPeopleSheet(buffer) {
  const rows = (await readRows(buffer)).filter((r) => r.some((v) => v));
  if (!rows.length) throw ApiError.badRequest('The file has no rows');
  const { cols, dataStart, header } = detectColumns(rows);
  if (cols.regNo == null) {
    throw ApiError.badRequest('Could not find a register number column. Add a heading like "Register No" above that column.');
  }
  const body = rows.slice(dataStart, dataStart + MAX_ROWS);
  const at = (r, key) => (cols[key] == null ? '' : String(r[cols[key]] || '').trim().replace(/\s+/g, ' '));
  const people = body
    .map((r, i) => ({
      row: dataStart + i + 1,
      name: at(r, 'name'),
      regNo: at(r, 'regNo').replace(/\s/g, '').toUpperCase(),
      email: at(r, 'email').toLowerCase(),
      college: at(r, 'college'),
    }))
    .filter((p) => p.regNo || p.name || p.email);
  const columns = Object.fromEntries(Object.entries(cols).map(([k, i]) => [k, header ? header[i] : `Column ${i + 1}`]));
  return { people, columns, totalRows: rows.length - dataStart, truncated: rows.length - dataStart > MAX_ROWS };
}
