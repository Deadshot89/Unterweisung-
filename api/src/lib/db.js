import sql from 'mssql';

let poolPromise;

export async function getPool() {
  if (!process.env.SQL_CONNECTION_STRING) {
    throw new Error('SQL_CONNECTION_STRING is not configured');
  }
  if (!poolPromise) {
    poolPromise = sql.connect(process.env.SQL_CONNECTION_STRING);
  }
  return poolPromise;
}

export { sql };
