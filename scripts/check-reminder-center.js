import fs from 'node:fs';

const index = fs.readFileSync('frontend/index.html', 'utf8');
const roleGuard = fs.readFileSync('frontend/role-guard-v20.js', 'utf8');
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
assertIncludes(index, 'data-view="reminders"', 'Erinnerungen-Reiter');
assertIncludes(index, '<section id="reminders"', 'Erinnerungen-Section');
assertIncludes(index, '/reminder-center-v30.js', 'Erinnerungscenter geladen');

assertIncludes(roleGuard, 'reminders:', 'Rollenmatrix fuer Erinnerungen');
assertIncludes(roleGuard, "'dashboard','status','reminders'", 'Erinnerungen in erlaubter Startreihenfolge');
assertIncludes(roleGuard, "'company_admin','hse','line_manager','system_admin'", 'Erinnerungen Rollenfreigabe');

assertIncludes(reminderUi, 'function renderReminderCenter', 'Erinnerungscenter rendern');
assertIncludes(reminderUi, 'function copyReminderMailText', 'Mailtext erzeugen');
assertIncludes(reminderUi, 'function createReminderLinksForSelection', 'Einmal-Links erzeugen');
assertIncludes(reminderUi, 'function exportReminderCsv', 'CSV Export');
assertIncludes(reminderUi, 'function reminderGroupedByRecipient', 'Gruppierung nach Empfaenger');
assertIncludes(reminderUi, 'createExternalInvitationFromRow', 'externe Linklogik wird genutzt');
assertIncludes(reminderUi, 'REMINDER_LOG_KEY', 'lokaler Erinnerungsverlauf');
assertIncludes(reminderUi, "['missing','expired','critical','soon']", 'offene Status werden gefiltert');

console.log('Reminder center regression check passed.');
