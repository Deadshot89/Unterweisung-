// v0.37: Berechtigter Einstieg in die separate Fehlerdiagnose-PWA.
// Die sichtbare Freigabe ergänzt nur die Oberfläche; die API prüft diagnostics.view serverseitig erneut.
function diagnosticsAccessAllowed(){
  const roles = state.me?.roles || [];
  const permissions = state.me?.permissions || [];
  return roles.includes('system_admin') || permissions.includes('diagnostics.view');
}

function renderDiagnostics(){
  const target = $('diagnostics');
  if(!target) return;
  if(!diagnosticsAccessAllowed()){
    target.innerHTML = accessDeniedHtml('diagnostics');
    return;
  }
  const systemAdmin = (state.me?.roles || []).includes('system_admin');
  target.innerHTML = `<div class="grid">
    <div class="card span-12">
      <div class="toolbar"><div><h2>Fehlerdiagnose</h2><p class="muted">Systemstatus, Fehlerereignisse, Diagnoseexport und kritische Alarme.</p></div><a class="btn primary" href="/diagnostics.html">Diagnose-App öffnen</a></div>
      <div class="notice"><b>Zugriff:</b> ${systemAdmin?'Systemadmin':'Explizit freigegeben (diagnostics.view)'}. Die Diagnose-App verwendet dieselbe Anmeldung und dieselbe Firmenbegrenzung.</div>
      ${systemAdmin?'<p>In der Diagnose-App kannst du zusätzlich Handy-Benachrichtigungen für kritische Fehler aktivieren.</p>':'<p>Push- und E-Mail-Alarme bleiben ausschließlich dem Systemadmin vorbehalten.</p>'}
    </div>
  </div>`;
}

(function(){
  const originalRender = typeof render === 'function' ? render : null;
  if(originalRender){
    render = function(id){
      if(id === 'diagnostics'){ renderDiagnostics(); return; }
      originalRender(id);
    };
  }
})();
