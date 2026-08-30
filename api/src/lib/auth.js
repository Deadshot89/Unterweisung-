// Startversion: Für lokale Tests wird companyId aus Header gelesen.
// Produktionsziel: Microsoft Entra / Static Web Apps auth claims aus x-ms-client-principal validieren.
export function getRequestContext(request) {
  const companyId = request.headers.get('x-company-id') || 'company-essentra';
  let principal = null;
  const raw = request.headers.get('x-ms-client-principal');
  if (raw) {
    try {
      principal = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      principal = null;
    }
  }
  return {
    companyId,
    userId: principal?.userId || 'local-dev-user',
    userDetails: principal?.userDetails || 'local-dev',
    roles: principal?.userRoles || ['anonymous']
  };
}
