import crypto from 'node:crypto';
import { sql } from './db.js';

export async function writeMailLog(pool, ctx, entry) {
  const id = crypto.randomUUID();
  await pool.request()
    .input('id', sql.NVarChar(80), id)
    .input('companyId', sql.NVarChar(80), entry.companyId || ctx?.companyId)
    .input('relatedEntityType', sql.NVarChar(80), entry.relatedEntityType || null)
    .input('relatedEntityId', sql.NVarChar(80), entry.relatedEntityId || null)
    .input('provider', sql.NVarChar(80), entry.provider || 'microsoft-graph')
    .input('fromEmail', sql.NVarChar(254), entry.fromEmail || null)
    .input('toEmail', sql.NVarChar(sql.MAX), Array.isArray(entry.to) ? entry.to.join(';') : String(entry.to || ''))
    .input('ccEmail', sql.NVarChar(sql.MAX), Array.isArray(entry.cc) ? entry.cc.join(';') : (entry.cc ? String(entry.cc) : null))
    .input('subject', sql.NVarChar(300), entry.subject || '')
    .input('bodyPreview', sql.NVarChar(1000), String(entry.bodyPreview || '').slice(0, 1000))
    .input('providerMessageId', sql.NVarChar(200), entry.providerMessageId || null)
    .input('status', sql.NVarChar(40), entry.status || 'unknown')
    .input('errorMessage', sql.NVarChar(sql.MAX), entry.errorMessage || null)
    .input('createdBy', sql.NVarChar(120), ctx?.userId || entry.createdBy || null)
    .query(`INSERT INTO MailLog(id,companyId,relatedEntityType,relatedEntityId,provider,fromEmail,toEmail,ccEmail,subject,bodyPreview,providerMessageId,status,errorMessage,createdBy)
            VALUES(@id,@companyId,@relatedEntityType,@relatedEntityId,@provider,@fromEmail,@toEmail,@ccEmail,@subject,@bodyPreview,@providerMessageId,@status,@errorMessage,@createdBy)`);
  return id;
}
