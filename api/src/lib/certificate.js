import crypto from 'node:crypto';
import { sql } from './db.js';
import { uploadBufferToBlob } from './blob.js';

function esc(s='') {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return String(d); }
}

export function buildCertificateHtml({ company, employeeName, email, instructionName, language, conductedAt, validUntil, scorePercent, passed, confirmationText }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Unterweisungsnachweis</title>
<style>
body{font-family:Arial,sans-serif;color:#111827;margin:40px;line-height:1.45}.box{border:1px solid #d0d5dd;border-radius:14px;padding:24px;max-width:900px}h1{margin-top:0}.grid{display:grid;grid-template-columns:220px 1fr;gap:8px 18px}.label{font-weight:700;color:#475467}.ok{color:#067647;font-weight:700}.bad{color:#b42318;font-weight:700}.sig{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.line{border-top:1px solid #111;padding-top:8px;color:#475467}@media print{body{margin:18mm}.box{border:0;padding:0}}
</style></head><body><div class="box">
<h1>Unterweisungsnachweis</h1>
<div class="grid">
<div class="label">Firma</div><div>${esc(company?.name || company?.legalName || '—')}</div>
<div class="label">Teilnehmer</div><div>${esc(employeeName || email || '—')}</div>
<div class="label">E-Mail</div><div>${esc(email || '—')}</div>
<div class="label">Unterweisung</div><div>${esc(instructionName)}</div>
<div class="label">Sprache</div><div>${esc(language || 'de')}</div>
<div class="label">Durchgeführt am</div><div>${fmt(conductedAt)}</div>
<div class="label">Gültig bis</div><div>${fmt(validUntil)}</div>
<div class="label">Testergebnis</div><div><span class="${passed ? 'ok' : 'bad'}">${passed ? 'Bestanden' : 'Nicht bestanden'}</span>${Number.isFinite(Number(scorePercent)) ? ` · ${Number(scorePercent).toFixed(0)} %` : ''}</div>
<div class="label">Bestätigung</div><div>${esc(confirmationText || 'Teilnehmer hat die Unterweisung digital bestätigt.')}</div>
</div>
<p style="margin-top:28px;color:#475467">Dieser Nachweis wurde digital durch den Unterweisungsmanager erstellt. Der Abschluss ist zusätzlich im Audit-Log und in der Datenbank gespeichert.</p>
<div class="sig"><div class="line">Datum / Teilnehmer</div><div class="line">Verantwortlicher / HSE</div></div>
</div></body></html>`;
}

export async function saveCertificateHtml(pool, ctx, payload) {
  const id = crypto.randomUUID();
  const safeName = String(payload.employeeName || payload.email || 'Teilnehmer').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_');
  const safeInstruction = String(payload.instructionName || 'Unterweisung').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').slice(0,80);
  const fileName = `Nachweis_${safeName}_${safeInstruction}_${new Date().toISOString().slice(0,10)}.html`;
  const blobPath = `${ctx.companyId}/certificates/${new Date().toISOString().slice(0,7)}/${id}_${fileName}`;
  const html = buildCertificateHtml(payload);
  const buffer = Buffer.from(html, 'utf8');
  await uploadBufferToBlob(blobPath, buffer, 'text/html; charset=utf-8');
  await pool.request()
    .input('id', sql.NVarChar(80), id)
    .input('companyId', sql.NVarChar(80), ctx.companyId)
    .input('kind', sql.NVarChar(60), 'certificate')
    .input('fileName', sql.NVarChar(260), fileName)
    .input('blobPath', sql.NVarChar(500), blobPath)
    .input('contentType', sql.NVarChar(120), 'text/html; charset=utf-8')
    .input('sizeBytes', sql.BigInt, buffer.length)
    .input('sha256', sql.NVarChar(128), crypto.createHash('sha256').update(buffer).digest('hex'))
    .input('createdBy', sql.NVarChar(120), ctx.userId || 'external')
    .query(`INSERT INTO Files(id,companyId,kind,fileName,blobPath,contentType,sizeBytes,sha256,createdBy)
            VALUES(@id,@companyId,@kind,@fileName,@blobPath,@contentType,@sizeBytes,@sha256,@createdBy)`);
  return { id, fileName, blobPath };
}
