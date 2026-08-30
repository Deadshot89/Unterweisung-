import crypto from 'node:crypto';

const DEFAULT_MAX_MB = 15;
const ALLOWED = new Map([
  ['pdf',  ['application/pdf']],
  ['jpg',  ['image/jpeg']],
  ['jpeg', ['image/jpeg']],
  ['png',  ['image/png']],
  ['webp', ['image/webp']]
]);

const MAGIC = [
  { ext: 'pdf', test: b => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-' },
  { ext: 'jpg', test: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { ext: 'webp', test: b => b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' }
];

export function getMaxUploadBytes() {
  const configured = Number(process.env.UPLOAD_MAX_MB || DEFAULT_MAX_MB);
  return Math.max(1, Math.min(configured || DEFAULT_MAX_MB, 50)) * 1024 * 1024;
}

export function sanitizeFileName(name = 'nachweis.pdf') {
  const safe = String(name || 'nachweis.pdf')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180);
  return safe || 'nachweis.pdf';
}

export function fileExtension(fileName = '') {
  const m = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function decodeBase64Upload(body = {}) {
  const raw = body.base64 || body.dataBase64 || body.contentBase64 || '';
  if (!raw) {
    const err = new Error('Dateiinhalt fehlt. Erwartet wird base64/dataBase64.');
    err.status = 400;
    throw err;
  }
  const value = String(raw).includes(',') ? String(raw).split(',').pop() : String(raw);
  let buffer;
  try { buffer = Buffer.from(value, 'base64'); }
  catch {
    const err = new Error('Dateiinhalt ist kein gültiges Base64.');
    err.status = 400;
    throw err;
  }
  if (!buffer.length) {
    const err = new Error('Datei ist leer.');
    err.status = 400;
    throw err;
  }
  return buffer;
}

export function detectExtension(buffer) {
  return MAGIC.find(m => m.test(buffer))?.ext || '';
}

export function contentTypeForExtension(ext, fallback = 'application/octet-stream') {
  const map = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return map[ext] || fallback;
}

export function validateUploadedFile({ fileName, contentType, buffer }) {
  const safeName = sanitizeFileName(fileName);
  const ext = fileExtension(safeName);
  if (!ALLOWED.has(ext)) {
    const err = new Error('Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG und WEBP.');
    err.status = 415;
    throw err;
  }

  const maxBytes = getMaxUploadBytes();
  if (buffer.length > maxBytes) {
    const err = new Error(`Datei ist zu groß. Maximal erlaubt: ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    err.status = 413;
    throw err;
  }

  const detected = detectExtension(buffer);
  if (!detected) {
    const err = new Error('Dateiinhalt passt zu keinem erlaubten Dateityp.');
    err.status = 415;
    throw err;
  }
  if (ext === 'jpeg' ? detected !== 'jpg' : detected !== ext) {
    const err = new Error(`Dateiendung passt nicht zum Dateiinhalt. Endung: ${ext}, erkannt: ${detected}.`);
    err.status = 415;
    throw err;
  }

  const normalizedContentType = contentTypeForExtension(ext === 'jpeg' ? 'jpg' : ext, contentType);
  const allowedContentTypes = ALLOWED.get(ext) || [];
  if (contentType && !allowedContentTypes.includes(String(contentType).toLowerCase())) {
    const err = new Error(`Content-Type nicht erlaubt: ${contentType}.`);
    err.status = 415;
    throw err;
  }

  return {
    safeName,
    extension: ext,
    detectedExtension: detected,
    contentType: normalizedContentType,
    sizeBytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export function blobPathForUpload({ companyId, kind = 'proof', fileId, fileName }) {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const safe = sanitizeFileName(fileName);
  return `${companyId}/${kind}/${yyyy}/${mm}/${fileId}_${safe}`;
}

export function initialScanStatus() {
  return String(process.env.UPLOAD_SCAN_STATUS || 'pending').toLowerCase();
}
