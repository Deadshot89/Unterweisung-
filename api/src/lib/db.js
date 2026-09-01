import sql from 'mssql';

let poolPromise;

export function getSqlConnectionString() {
  if (process.env.SQL_CONNECTION_STRING && process.env.SQL_CONNECTION_STRING.trim()) {
    return process.env.SQL_CONNECTION_STRING.trim();
  }

  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DATABASE;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;

  if (!server || !database || !user || !password) {
    return null;
  }

  return [
    `Server=tcp:${server},1433`,
    `Initial Catalog=${database}`,
    'Persist Security Info=False',
    `User ID=${user}`,
    `Password=${password}`,
    'MultipleActiveResultSets=False',
    'Encrypt=True',
    'TrustServerCertificate=False',
    'Connection Timeout=30'
  ].join(';') + ';';
}

export function isDbConfigured() {
  return !!getSqlConnectionString();
}

export async function getPool() {
  const connectionString = getSqlConnectionString();
  if (!connectionString) {
    throw new Error('SQL connection is not configured. Set SQL_CONNECTION_STRING or SQL_SERVER, SQL_DATABASE, SQL_USER and SQL_PASSWORD.');
  }
  if (!poolPromise) {
    poolPromise = sql.connect(connectionString);
  }
  return poolPromise;
}

export { sql };
