import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Benutzerliste ist auf Desktop ohne horizontales Scrollen ausgelegt', () => {
  const js = read('frontend/user-management-v19.js');
  const css = read('frontend/professional-suite-v35.css');

  assert.match(js, /class="table-wrap user-table-wrap"/);
  assert.match(js, /class="user-table"/);
  assert.match(js, /class="user-actions"/);
  assert.match(css, /#users \.user-table-wrap\s*\{[^}]*overflow-x:\s*hidden/i);
  assert.match(css, /#users \.user-table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/i);
  assert.match(css, /#users \.user-actions\s*\{[^}]*flex-wrap:\s*wrap/i);
});

test('Benutzerzeile besitzt einen persistenten Fokuszustand', () => {
  const js = read('frontend/user-management-v19.js');
  const css = read('frontend/professional-suite-v35.css');

  assert.match(js, /let\s+focusedUserId\s*=\s*''/);
  assert.match(js, /data-user-row=/);
  assert.match(js, /tabindex="0"/);
  assert.match(js, /is-focused/);
  assert.match(js, /setFocusedUserRow/);
  assert.match(css, /#users \.user-row\.is-focused/);
  assert.match(css, /#users \.user-row\.is-focused\s+td:first-child::before/);
});

test('Desktop-Navigation bleibt fest stehen und Arbeitsbereich scrollt getrennt', () => {
  const css = read('frontend/professional-suite-v35.css');

  assert.match(css, /body\.app-shell-v35 \.primary-tabs\.pro-navigation\s*\{[^}]*position:\s*fixed/i);
  assert.match(css, /body\.app-shell-v35 \.primary-tabs\.pro-navigation\s*\{[^}]*width:\s*272px/i);
  assert.match(css, /body\.app-shell-v35 \.primary-tabs\.pro-navigation\s*\{[^}]*overscroll-behavior:\s*contain/i);
});

test('Menü-Scrollleiste wird erst bei Hover oder Tastaturfokus sichtbar', () => {
  const css = read('frontend/professional-suite-v35.css');

  assert.match(css, /primary-tabs\.pro-navigation\s*\{[^}]*scrollbar-width:\s*none/i);
  assert.match(css, /primary-tabs\.pro-navigation:is\(:hover,:focus-within\)\s*\{[^}]*scrollbar-width:\s*thin/i);
  assert.match(css, /primary-tabs\.pro-navigation::-webkit-scrollbar\s*\{[^}]*width:\s*0/i);
  assert.match(css, /primary-tabs\.pro-navigation:is\(:hover,:focus-within\)::-webkit-scrollbar\s*\{[^}]*width:/i);
});
