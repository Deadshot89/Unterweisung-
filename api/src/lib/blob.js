import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

let serviceClient;

function getAccountInfoFromConnectionString(connectionString) {
  const parts = Object.fromEntries(connectionString.split(';').map(p => {
    const idx = p.indexOf('=');
    return idx > -1 ? [p.slice(0, idx), p.slice(idx + 1)] : [p, ''];
  }));
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

export function getBlobContainerName() {
  return process.env.BLOB_CONTAINER || 'unterweisungsmanager';
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

export function getContainerClient() {
  return getBlobServiceClient().getContainerClient(getBlobContainerName());
}

export async function ensureContainer() {
  const container = getContainerClient();
  await container.createIfNotExists({ access: 'private' });
  return container;
}

export async function uploadBufferToBlob(blobPath, buffer, contentType = 'application/octet-stream', options = {}) {
  const container = await ensureContainer();
  const blob = container.getBlockBlobClient(blobPath);
  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    metadata: options.metadata || undefined,
    tags: options.tags || undefined
  });
  return { blobPath, url: blob.url };
}

export async function deleteBlobIfExists(blobPath) {
  const container = await ensureContainer();
  const blob = container.getBlockBlobClient(blobPath);
  await blob.deleteIfExists();
}


export function createReadSasUrl(blobPath, minutes = 10) {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }
  const { accountName, accountKey } = getAccountInfoFromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  if (!accountName || !accountKey) {
    throw new Error('Storage connection string must contain AccountName and AccountKey for SAS generation');
  }
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const containerName = getBlobContainerName();
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
