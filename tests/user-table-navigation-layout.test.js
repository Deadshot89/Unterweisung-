import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('frontend/professional-suite-v35.css');
const users = read('frontend/user-management-v19.js');

function userFixture(t){
  const dom = new JSDOM('<!doctype html><body><section id="users"></section></body>', { runScripts:'dangerously', url:'https://ui-test.invalid' });
  t.after(()=>dom.window.close());
  const w = dom.window;
  Object.assign(w, {
    state:{ me:{ roles:['system_admin'] }, companyId:'company-test', users:[] },
    DEFAULT_COMPANY_ID:'company-test',
    $:id=>w.document.getElementById(id),
    esc:value=>String(value ?? '').replace(/[&<>"']/g, char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])),
    fmtDate:()=> '—',
    api:async()=>({}),
    alert:()=>{}
  });
  w.eval(users);
  return w;
}

const sampleUsers = [
  { id:'user-a', displayName:'Anna Beispiel', email:'anna.beispiel@firma.example', role:'employee', active:true, provider:'aad', passwordEnabled:false },
  { id:'user-b', displayName:'Ben Beispiel', email:'ben.beispiel@firma.example', role:'line_manager', active:true, provider:'aad', passwordEnabled:true }
];

test('Benutzertabelle passt ohne horizontalen Seiten- oder Tabellen-Scroll in den Arbeitsbereich', () => {
  assert.match(users, /class="table-wrap user-table-wrap"/, 'Benutzertabelle braucht einen eigenen kompakten Wrapper.');
  assert.match(users, /class="user-table"/, 'Benutzertabelle braucht eine eigene Tabellenklasse.');
  assert.match(css, /#users\s+\.user-table-wrap\s*\{[^}]*overflow-x\s*:\s*hidden/s, 'Benutzer-Wrapper darf horizontal nicht scrollen.');
  assert.match(css, /#users\s+\.user-table\s*\{[^}]*min-width\s*:\s*0[^}]*table-layout\s*:\s*fixed/s, 'Benutzertabelle muss ohne globale Mindestbreite mit festem Layout arbeiten.');
  assert.match(css, /#users\s+\.user-table\s+td[^}]*overflow-wrap\s*:\s*anywhere/s, 'Lange Inhalte muessen innerhalb ihrer Zelle umbrechen.');
  assert.match(css, /#users\s+\.user-actions\s*\{[^}]*display\s*:\s*grid/s, 'Benutzeraktionen muessen kompakt innerhalb der Aktionszelle angeordnet werden.');
});

test('angeklickte oder fokussierte Benutzerzeile bleibt als Fokuszeile sichtbar', t => {
  const w = userFixture(t);
  w.state.users = sampleUsers;
  w.document.getElementById('users').innerHTML = w.userTable(sampleUsers, true);
  let rows = [...w.document.querySelectorAll('#users tr[data-user-row]')];
  assert.equal(rows.length, 2, 'Benutzerzeilen brauchen stabile Datenkennungen.');

  rows[0].querySelector('td').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  assert.equal(rows[0].classList.contains('is-focused'), true, 'Angeklickte Zeile wird markiert.');
  assert.equal(rows[0].getAttribute('aria-selected'), 'true');

  rows[1].querySelector('button').dispatchEvent(new w.FocusEvent('focusin', { bubbles:true }));
  assert.equal(rows[0].classList.contains('is-focused'), false, 'Vorherige Fokuszeile wird geloest.');
  assert.equal(rows[1].classList.contains('is-focused'), true, 'Fokus innerhalb einer anderen Zeile verschiebt die Markierung.');

  w.document.getElementById('users').innerHTML = w.userTable(sampleUsers, true);
  rows = [...w.document.querySelectorAll('#users tr[data-user-row]')];
  assert.equal(rows[1].classList.contains('is-focused'), true, 'Die Fokuszeile bleibt auch nach einem Neurendern erhalten.');
  assert.match(css, /#users\s+\.user-table\s+tbody\s+tr\.is-focused\s+td/, 'Fokuszeile braucht eine sichtbare Tabellenformatierung.');
});

test('Desktop-Navigation bleibt fest und scrollt nur innerhalb der Menueleiste', () => {
  assert.match(css, /body\.app-shell-v35\s+\.primary-tabs\.pro-navigation\s*\{[^}]*position\s*:\s*fixed/s, 'Desktop-Menue muss im Viewport fixiert sein.');
  assert.match(css, /body\.app-shell-v35\s+\.primary-tabs\.pro-navigation\s*\{[^}]*overflow-y\s*:\s*auto/s, 'Menue braucht eigenen vertikalen Scrollbereich.');
  assert.match(css, /body\.app-shell-v35\s+\.primary-tabs\.pro-navigation\s*\{[^}]*overscroll-behavior-y\s*:\s*contain/s, 'Scrollen im Menue darf nicht auf die Hauptseite durchgereicht werden.');
  assert.match(css, /body\.app-shell-v35\s+\.primary-tabs\.pro-navigation\s*\{[^}]*scrollbar-width\s*:\s*none/s, 'Menue-Scrollbar soll ausserhalb der Interaktion verborgen sein.');
  assert.match(css, /\.primary-tabs\.pro-navigation:hover[^}]*scrollbar-width\s*:\s*thin/s, 'Beim Arbeiten im Menue soll dessen Scrollbar sichtbar werden.');
  assert.match(css, /@media\(max-width:1180px\)[\s\S]*?\.primary-tabs\.pro-navigation\s*\{[^}]*position\s*:\s*static/s, 'Kompakte Ansichten muessen weiterhin auf die bestehende horizontale Navigation wechseln.');
});
