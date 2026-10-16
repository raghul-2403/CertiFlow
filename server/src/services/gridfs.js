// Stores files inside MongoDB itself using GridFS:
//  - "certificates" bucket: every issued certificate PDF
//  - "templates" bucket: certificate design images uploaded by coordinators
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const bucket = (name) => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: name });
const oid = (id) => new mongoose.Types.ObjectId(String(id));

function save(bucketName, buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const upload = bucket(bucketName).openUploadStream(filename, { metadata: { ...metadata, sha256, contentType } });
    upload.on('error', reject);
    upload.on('finish', () => resolve({ gridFsId: upload.id, filename, size: buffer.length, sha256 }));
    upload.end(buffer);
  });
}

async function read(bucketName, id) {
  const chunks = [];
  for await (const chunk of bucket(bucketName).openDownloadStream(oid(id))) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function remove(bucketName, id) {
  try {
    await bucket(bucketName).delete(oid(id));
  } catch {
    /* already gone */
  }
}

// Certificates
export const savePdf = (buffer, filename, metadata) => save('certificates', buffer, filename, 'application/pdf', metadata);
export const openPdfStream = (id) => bucket('certificates').openDownloadStream(oid(id));
export const readPdf = (id) => read('certificates', id);
export const deletePdf = (id) => remove('certificates', id);

// Design templates (cached in memory: the same image is used for every certificate of an event)
const templateCache = new Map();
export const saveTemplate = (buffer, filename, contentType, metadata) => save('templates', buffer, filename, contentType, metadata);
export async function readTemplate(id) {
  const key = String(id);
  if (!templateCache.has(key)) {
    if (templateCache.size > 20) templateCache.clear();
    templateCache.set(key, await read('templates', id));
  }
  return templateCache.get(key);
}
export async function deleteTemplate(id) {
  templateCache.delete(String(id));
  await remove('templates', id);
}
