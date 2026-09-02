// v0.33: Professionelles Dashboard ohne technische Testtexte.
// Fokus: Essentra Arbeitsuebersicht, klare Kennzahlen, schnelle Aktionen.

const DASHBOARD_DESIGN_VERSION = 'v0.33';

function dashboardRows(){
  return state.statusRows?.length ? state.statusRows : buildLocalStatusRows();
}

function dashboardCounts(){
  const rows = dashboardRows();
  const activeEmployees = employees().filter(e => e.active !== false).length;
  const open = rows.filter(r => ['missing','expired','critical','soon'].includes(r.status));
  const expired = rows.filter(r => r.status === 'expired');
  const missing = rows.filter(r => r.status === 'missing');
  const dueSoon = rows.filter(r => r.status === 'critical' || r.status === 'soon');
  const valid = rows.filter(r => r.status === 'valid');
  const proofMissing = rows.filter(r => r.recordId && r.status !== 'not_required' && !r.certificateFileId);
  return {
    activeEmployees,
    instructionTypes: types().filter(t => t.active !== false).length,
    valid: valid.length,
    open: open.length,
    expired: expired.length,
    missing: missing.length,
    dueSoon: dueSoon.length,
    proofMissing: proofMissing.length,
    completionRate: rows.length ? Math.round((valid.length / rows.length) * 100) : 0
  };
}

function dashboardTopOpen(limit = 8){
  const priority = { expired:1, missing:2, critical:3, soon:4 };
  return dashboardRows()
    .filter(r => ['missing','expired','critical','soon'].includes(r.status))
    .sort((a,b) => (priority[a.status] || 9) - (priority[b.status] || 9) || String(a.employeeName || '').localeCompare(String(b.employeeName || ''), 'de'))
    .slice(0, limit);
}

function dashboardMetric(label, value, tone, subline){
  return `<div class="metric-card ${tone || ''}">
    <span class="metric-label">${esc(label)}</span>
    <strong>${esc(value)}</strong>
    ${subline ? `<span class="metric-subline">${esc(subline)}</span>` : ''}
  </div>`;
}

function renderModernDashboard(){
  const el = $('dashboard');
  if(!el) return;
  const c = dashboardCounts();
  const companyName = typeof designCompanyName === 'function' ? designCompanyName() : 'Essentra Components GmbH';
  const openRows = dashboardTopOpen();
  const sourceText = state.apiAvailable ? 'Daten verbunden' : 'Offline-Daten';
  el.innerHTML = `<div class="grid dashboard-grid">
    <section class="card dashboard-hero span-12">
      <div>
        <span class="eyebrow">${esc(companyName)}</span>
        <h2>Essentra Übersicht</h2>
        <p>Aktueller Unterweisungsstand, offene Aufgaben und direkte Aktionen auf einen Blick.</p>
      </div>
      <div class="hero-status">
        <span class="status-dot"></span>
        <strong>${esc(sourceText)}</strong>
      </div>
    </section>

    ${dashboardMetric('Mitarbeiter aktiv', c.activeEmployees, 'blue', 'Stammdaten')}
    ${dashboardMetric('Unterweisungen', c.instructionTypes, 'blue', 'aktive Typen')}
    ${dashboardMetric('Gueltig', c.valid, 'green', `${c.completionRate}% Abdeckung`)}
    ${dashboardMetric('Offene Aufgaben', c.open, c.open ? 'yellow' : 'green', 'fehlt / faellig')}
    ${dashboardMetric('Abgelaufen', c.expired, c.expired ? 'red' : 'green', 'sofort pruefen')}
    ${dashboardMetric('Fehlend', c.missing, c.missing ? 'yellow' : 'green', 'noch nie erledigt')}
    ${dashboardMetric('Bald faellig', c.dueSoon, c.dueSoon ? 'yellow' : 'green', 'naechste 60 Tage')}
    ${dashboardMetric('Nachweise offen', c.proofMissing, c.proofMissing ? 'yellow' : 'green', 'Datei fehlt')}

    <section class="card span-8 dashboard-panel">
      <div class="panel-head">
        <div><h3>Offene Aufgaben</h3><p class="muted">Priorisiert nach abgelaufen, fehlend und bald faellig.</p></div>
        <button class="small ghost" onclick="setView('status')">Alle anzeigen</button>
      </div>
      ${openRows.length ? `<div class="status-list">${openRows.map(r => `<div class="status-row">
        <div><strong>${esc(r.employeeName)}</strong><span>${esc(r.instructionName)}</span></div>
        <div>${badge(r.status)}</div>
      </div>`).join('')}</div>` : '<div class="empty-state">Keine offenen Unterweisungen fuer die aktuelle Auswahl.</div>'}
    </section>

    <section class="card span-4 dashboard-panel">
      <div class="panel-head"><div><h3>Schnellzugriff</h3><p class="muted">Direkt in die wichtigsten Arbeitsbereiche.</p></div></div>
      <div class="quick-actions">
        <button onclick="setView('status')">Status bearbeiten</button>
        <button onclick="setView('reminders')">Erinnerungen erstellen</button>
        <button onclick="setView('planning')">Unterweisung planen</button>
        <button onclick="setView('proofs')">Nachweise pruefen</button>
        <button onclick="setView('managerReport')">Manager-Report</button>
        <button onclick="setView('employees')">Mitarbeiter pflegen</button>
      </div>
    </section>
  </div>`;
}

if(typeof renderDashboard === 'function'){
  renderDashboard = renderModernDashboard;
}

window.renderModernDashboard = renderModernDashboard;
window.dashboardCounts = dashboardCounts;
window.dashboardTopOpen = dashboardTopOpen;

setTimeout(() => {
  if(document.getElementById('dashboard')?.classList.contains('active')) renderModernDashboard();
  const version = document.getElementById('appVersion');
  if(version) version.textContent = DASHBOARD_DESIGN_VERSION;
}, 0);
