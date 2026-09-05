import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('authenticated workspace is physically hidden in HTML until login and company context succeed',()=>{
  const index=read('frontend/index.html');
  assert.match(index,/id="companySelectionGate"/,'login/company gate must exist');
  assert.match(index,/id="authenticatedApp"[^>]*hidden/,'authenticated workspace must be hidden by HTML, not only by CSS');
  assert.ok(index.indexOf('id="companySelectionGate"') < index.indexOf('id="authenticatedApp"'),'login gate must live outside and before authenticated workspace');
  const workspace=index.slice(index.indexOf('id="authenticatedApp"'));
  assert.match(workspace,/id="portalNavigation"/,'navigation must be inside authenticated workspace');
  assert.match(workspace,/id="dashboard"/,'dashboard must be inside authenticated workspace');
});

test('startup renders the login shell immediately before checking the existing session',()=>{
  const app=read('frontend/app.js');
  const renderAt=app.lastIndexOf('\nrenderAuthenticationRequired();');
  const loadAt=app.lastIndexOf('\nloadData();');
  assert.ok(renderAt>=0,'startup must render the login shell');
  assert.ok(loadAt>=0,'startup must still check the existing session');
  assert.ok(renderAt<loadAt,'login shell must render before the initial session check');
  assert.match(app,/authenticatedApp[\s\S]{0,180}hidden\s*=\s*!visible|\$\(['"]authenticatedApp['"]\)[\s\S]{0,180}hidden\s*=\s*!visible/,'workspace visibility must be controlled by the authenticatedApp hidden attribute');
});

test('password setup mode takes precedence over any existing authenticated session',()=>{
  const auth=read('frontend/auth-login-v42.js');
  const app=read('frontend/app.js');
  assert.match(auth,/hasPasswordSetupToken/,'auth module must expose whether a password setup fragment is active');
  assert.match(auth,/passwordSetupToken\(\)/,'setup-mode check must reuse the fragment token parser');
  const startup=app.slice(app.lastIndexOf("document.getElementById('companySwitchAction')"));
  assert.match(startup,/renderAuthenticationRequired\(\);\s*if\s*\(!UMAuthLogin\.hasPasswordSetupToken\(\)\)\s*loadData\(\);/,'initial session lookup must be skipped while a password setup token is active');
});