import assert from 'node:assert/strict';
import { getRequestContext } from '../api/src/lib/auth.js';

const savedNodeEnv = process.env.NODE_ENV;
const savedLocalDev = process.env.AUTH_LOCAL_DEV;

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  delete process.env.NODE_ENV;
  delete process.env.AUTH_LOCAL_DEV;

  const cloudLikeRequest = new Request('https://example.azurewebsites.net/api/me');
  const cloudContext = getRequestContext(cloudLikeRequest);

  assert.equal(
    cloudContext.isLocalDev,
    false,
    'Ein Cloud-Request ohne x-ms-client-principal darf bei fehlendem NODE_ENV nicht als lokale Entwicklung gelten.'
  );
  assert.equal(
    cloudContext.isAuthenticated,
    false,
    'Ein Cloud-Request ohne x-ms-client-principal darf bei fehlendem NODE_ENV nicht automatisch authentifiziert sein.'
  );

  process.env.NODE_ENV = 'development';
  const localRequest = new Request('http://localhost:7071/api/me', {
    headers: {
      'x-dev-user': 'local@example.test',
      'x-dev-user-id': 'local-user',
      'x-dev-roles': 'company_admin'
    }
  });
  const localContext = getRequestContext(localRequest);

  assert.equal(localContext.isLocalDev, true, 'Explizite NODE_ENV=development muss lokale Entwicklung weiter erlauben.');
  assert.equal(localContext.isAuthenticated, true, 'Explizite lokale Entwicklung muss Dev-Authentifizierung weiter erlauben.');
  assert.equal(localContext.email, 'local@example.test');

  console.log('Auth environment guard checks passed');
} finally {
  restore('NODE_ENV', savedNodeEnv);
  restore('AUTH_LOCAL_DEV', savedLocalDev);
}
