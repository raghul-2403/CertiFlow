// College / organisation details: name, department, and the logo used in the middle of
// event QR codes and as a watermark on the projector screen.
//
// Setting 'org.logo' is one of:
//   (not set) or 'crest'  -> the RMKCET crest bundled in src/templates/rmkcet-crest.png
//   'none'                -> no logo
//   '<GridFS file id>'    -> a logo uploaded in Settings (stored in the "templates" bucket)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings, setSetting } from '../models/index.js';
import { saveTemplate, readTemplate, deleteTemplate } from './gridfs.js';
import { imageInfo } from '../utils/imageSize.js';
import { ApiError } from '../utils/ApiError.js';

const CREST_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../templates/rmkcet-crest.png');
let crestCache = null;

export async function orgInfo() {
  const s = await getSettings(['org.name', 'org.unit', 'org.logo']);
  const logo = s['org.logo'];
  return {
    name: s['org.name'] || '',
    unit: s['org.unit'] || '',
    logo: !logo || logo === 'crest' ? 'crest' : logo === 'none' ? 'none' : 'custom',
    // changes whenever the logo changes, so browsers re-download it
    logoVersion: logo || 'crest',
  };
}

/** @returns {Promise<{ buffer: Buffer, type: string } | null>} */
export async function orgLogo() {
  const s = await getSettings(['org.logo', 'org.logoType']);
  const logo = s['org.logo'];
  if (logo === 'none') return null;
  if (!logo || logo === 'crest') {
    crestCache ??= await fs.readFile(CREST_FILE);
    return { buffer: crestCache, type: 'image/png' };
  }
  try {
    return { buffer: await readTemplate(logo), type: s['org.logoType'] || 'image/png' };
  } catch {
    return null; // file went missing: carry on without a logo rather than break the QR
  }
}

async function dropUploadedLogo() {
  const current = (await getSettings(['org.logo']))['org.logo'];
  if (current && !['crest', 'none'].includes(current)) await deleteTemplate(current).catch(() => {});
}

export async function setOrgLogo(buffer) {
  const info = imageInfo(buffer);
  if (!info) throw ApiError.badRequest('Upload the logo as a PNG or JPG image');
  if (Math.min(info.width, info.height) < 64) throw ApiError.badRequest('That logo is too small. Use an image at least 200 pixels wide.');
  await dropUploadedLogo();
  const { gridFsId } = await saveTemplate(buffer, `org-logo.${info.type === 'image/png' ? 'png' : 'jpg'}`, info.type, { kind: 'org-logo' });
  await setSetting('org.logo', String(gridFsId));
  await setSetting('org.logoType', info.type);
}

export async function useOrgLogoPreset(choice) {
  if (!['crest', 'none'].includes(choice)) throw ApiError.badRequest('Unknown logo choice');
  await dropUploadedLogo();
  await setSetting('org.logo', choice);
  await setSetting('org.logoType', choice === 'crest' ? 'image/png' : null);
}
