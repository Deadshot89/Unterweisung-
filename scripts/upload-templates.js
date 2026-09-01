import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sql from 'mssql';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const sqlConnectionString = process.env.SQL_CONNECTION_STRING;
const containerName = process.env.BLOB_CONTAINER_TEMPLATES || process.env.BLOB_CONTAINER || 'templates';
const companyId = process.env.COMPANY_ID || 'company-essentra';
const templatesDir = path.resolve(process.argv[2] || 'templates');

if (!storageConnectionString) {
  console.error('AZURE_STORAGE_CONNECTION_STRING fehlt.');
  process.exit(1);
}
if (!sqlConnectionString) {
  console.error('SQL_CONNECTION_STRING fehlt.');
  process.exit(1);
}
if (!fs.existsSync(templatesDir)) {
  console.error('Templates-Ordner nicht gefunden:', templatesDir);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const blobService = BlobServiceClient.fromConnectionString(storageConnectionString);
const container = blobService.getContainerClient(containerName);
// Private container: omit access option. Azure Blob SDK only accepts public values 'blob' or 'container'.
await container.createIfNotExists();
const pool = await sql.connect(sqlConnectionString);
try {
  const files = fs.readdirSync(templatesDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  for (const fileName of files) {
    const full = path.join(templatesDir, fileName);
    const buffer = fs.readFileSync(full);
    const blobPath = `${companyId}/templates/${fileName}`;
    const blob = container.getBlockBlobClient(blobPath);
    await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/pdf' } });
    const hash = sha256(buffer);
    const fileId = uuidv4();

    await pool.request()
      .input('fileId', sql.NVarChar(80), fileId)
      .input('companyId', sql.NVarChar(80), companyId)
      .input('fileName', sql.NVarChar(260), fileName)
      .input('blobPath', sql.NVarChar(500), blobPath)
      .input('sizeBytes', sql.BigInt, buffer.length)
      .input('sha256', sql.NVarChar(128), hash)
      .query(`IF NOT EXISTS(SELECT 1 FROM dbo.Files WHERE companyId=@companyId AND blobPath=@blobPath)
              INSERT INTO dbo.Files(id,companyId,kind,fileName,blobPath,contentType,sizeBytes,sha256)
              VALUES(@fileId,@companyId,'template',@fileName,@blobPath,'application/pdf',@sizeBytes,@sha256);
              UPDATE dbo.Templates SET blobPath=@blobPath WHERE companyId=@companyId AND fileName=@fileName;`);
    console.log('✓ Vorlage hochgeladen:', fileName, '→', blobPath);
  }
  console.log('Upload abgeschlossen:', files.length, 'PDF-Dateien.');
} finally {
  await pool.close();
}
