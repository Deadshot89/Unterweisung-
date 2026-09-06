import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const portal = fs.readFileSync('frontend/portal-shell.js', 'utf8');
const reminderUi = fs.readFileSync('frontend/reminder-center-v30.js', 'utf8');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    console.error(`Fehlt: ${label}`);
    process.exit(1);
  }
}

function assertMatches(source, pattern, label) {
  if (!pattern.test(source)) {
    console.error(`Fehlt: ${label}`);
    process.exit(1);
  }
}

assertMatches(index, /Unterweisungsmanager Online · v0\./, 'sichtbare Online-Version');
assertIncludes(index, '<section id="work"', 'v0.40 Arbeitsbereich');
assertIncludes(index, '/reminder-center-v30.js', 'Erinnerungscenter geladen');
assertIncludes(index, '/portal-shell.js', 'v0.40 Portal-Shell geladen');

assertMatches(portal, /reminders:\s*\{view:'work',\s*tab:'reminders'\}/, 'Legacy-Route Erinnerungen auf Arbeit/Erinnerungen');
assertIncludes(portal, "['line_manager','hse','company_admin','system_admin'].includes(r)", 'Erinnerungen Rollenfreigabe');
assertIncludes(portal, "tabs.push({id:'reminders',label:'Erinnerungen'})", 'Erinnerungen als Arbeits-Unteransicht');
assertIncludes(portal, '<div id="reminders" class="portal-subview"', 'Erinnerungs-Unteransicht');
assertIncludes(portal, "if(active === 'reminders' && typeof renderReminders === 'function') renderReminders();", 'Erinnerungsrenderer wird aus Portal-Shell aufgerufen');

assertIncludes(reminderUi, 'function renderReminderCenter', 'Erinnerungscenter rendern');
assertIncludes(reminderUi, 'function copyReminderMailText', 'Mailtext erzeugen');
assertIncludes(reminderUi, 'function createReminderLinksForSelection', 'Einmal-Links erzeugen');
assertIncludes(reminderUi, 'function exportReminderCsv', 'CSV Export');
assertIncludes(reminderUi, 'function reminderGroupedByRecipient', 'Gruppierung nach Empfaenger');
assertIncludes(reminderUi, 'createExternalInvitationFromRow', 'externe Linklogik wird genutzt');
assertIncludes(reminderUi, 'REMINDER_LOG_KEY', 'lokaler Erinnerungsverlauf');
assertIncludes(reminderUi, "['missing','expired','critical','soon']", 'offene Status werden gefiltert');

console.log('Reminder center v0.40 regression check passed.');
