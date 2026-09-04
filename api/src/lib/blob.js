import './runtime-settings.js';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

let serviceClient;

function getAccountInfoFromConnectionString(connectionString) {
  const parts = Object.fromEntries(connectionString.split(';').map(p => {
    const idx = p.indexOf('=');
    return idx > -1 ? [p.slice(0, idx), p.slice(idx + 1)] : [p, ''];
  }));
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

function envOr(name, fallback) {
  return process.env[name] || fallback;
}

export function getBlobContainerName(options = {}) {
  if (options.containerName) return options.containerName;
  if (options.kind === 'template') return envOr('BLOB_CONTAINER_TEMPLATES', 'templates');
  if (options.kind === 'backup') return envOr('BLOB_CONTAINER_BACKUPS', 'backups');
  if (options.kind === 'export') return envOr('BLOB_CONTAINER_EXPORTS', 'exports');
  if (options.kind === 'proof' || options.kind === 'certificate') return envOr('BLOB_CONTAINER_PROOFS', 'proofs');

  const blobPath = options.blobPath || '';
  if (blobPath.startsWith('backups/')) return envOr('BLOB_CONTAINER_BACKUPS', 'backups');
  if (blobPath.startsWith('exports/')) return envOr('BLOB_CONTAINER_EXPORTS', 'exports');
  if (blobPath.startsWith('vorlagen/') || blobPath.startsWith('templates/')) return envOr('BLOB_CONTAINER_TEMPLATES', 'templates');
  if (blobPath.includes('/certificates/') || blobPath.includes('/proofs/')) return envOr('BLOB_CONTAINER_PROOFS', 'proofs');

  return process.env.BLOB_CONTAINER || envOr('BLOB_CONTAINER_PROOFS', 'proofs');
}

export function getBlobServiceClient() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }
  if (!serviceClient) {
    serviceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  }
  return serviceClient;
}

export function getContainerClient(options = {}) {
  return getBlobServiceClient().getContainerClient(getBlobContainerName(options));
}

export async function ensureContainer(options = {}) {
  const container = getContainerClient(options);
  // Do not pass { access: 'private' } here. The Azure Blob SDK only accepts
  // public access values 'blob' or 'container'. Omitting access creates/keeps a private container.
  await container.createIfNotExists();
  return container;
}

export async function ensureConfiguredContainers() {
  const containers = [
    envOr('BLOB_CONTAINER_TEMPLATES', 'templates'),
    envOr('BLOB_CONTAINER_PROOFS', 'proofs'),
    envOr('BLOB_CONTAINER_BACKUPS', 'backups'),
    envOr('BLOB_CONTAINER_EXPORTS', 'exports')
  ];
  const unique = [...new Set(containers.filter(Boolean))];
  for (const containerName of unique) {
    await ensureContainer({ containerName });
  }
  return unique;
}

export async function uploadBufferToBlob(blobPath, buffer, contentType = 'application/octet-stream', options = {}) {
  const container = await ensureContainer({ ...options, blobPath });
  const blob = container.getBlockBlobClient(blobPath);
  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    metadata: options.metadata || undefined,
    tags: options.tags || undefined
  });
  return { blobPath, containerName: container.containerName, url: blob.url };
}

export async function deleteBlobIfExists(blobPath, options = {}) {
  const container = await ensureContainer({ ...options, blobPath });
  const blob = container.getBlockBlobClient(blobPath);
  await blob.deleteIfExists();
}

export async function blobExists(blobPath, options = {}) {
  if (!blobPath) return false;
  const container = getContainerClient({ ...options, blobPath });
  const blob = container.getBlobClient(blobPath);
  try {
    return await blob.exists();
  } catch (err) {
    const status = Number(err?.statusCode || err?.status || err?.details?.errorCode === 'BlobNotFound' ? 404 : 0);
    if (status === 404) return false;
    throw err;
  }
}

export function createReadSasUrl(blobPath, minutes = 10, options = {}) {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }
  const { accountName, accountKey } = getAccountInfoFromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  if (!accountName || !accountKey) {
    throw new Error('Storage connection string must contain AccountName and AccountKey for SAS generation');
  }
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const containerName = getBlobContainerName({ ...options, blobPath });
  const startsOn = new Date(Date.now() - 60 * 1000);
  const expiresOn = new Date(Date.now() + minutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName: blobPath,
    permissions: BlobSASPermissions.parse('r'),
    startsOn,
    expiresOn
  }, credential).toString();
  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobPath).replace(/%2F/g, '/')}?${sas}`;
}
