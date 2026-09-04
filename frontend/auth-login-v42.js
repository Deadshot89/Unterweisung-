(function(root){
  const escapeHtml=(value='')=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function render({target,message=''}){
    if(!target)return;
    const detail=String(message||'').replace(/^.*?Fehler:\s*/,'').trim();
    target.hidden=false;
    target.innerHTML=`<section class="dual-login-shell">
      <div class="dual-login-head"><span class="portal-badge">Unterweisungsmanager</span><h2>Anmeldung</h2><p class="muted">Microsoft oder E-Mail und Passwort – beide Wege verwenden dieselben Rollen und Firmenrechte.</p></div>
      <div class="dual-login-grid">
        <div class="card dual-login-card"><h3>Mit Microsoft anmelden</h3><p>Für Benutzer mit Microsoft-/Entra-Konto. Deine hinterlegte Rolle bestimmt anschließend den Funktionsumfang.</p><a class="btn primary" href="/.auth/login/aad">Mit Microsoft anmelden</a></div>
        <div class="card dual-login-card"><h3>E-Mail und Passwort</h3><p>Für interne Benutzer ohne Microsoft-Konto. Die Rechte entsprechen der im Benutzerkonto hinterlegten Rolle.</p>
          <form id="authPasswordLogin"><div class="field"><label for="authLoginEmail">E-Mail</label><input id="authLoginEmail" type="email" autocomplete="username" required></div>
          <div class="field"><label for="authLoginPassword">Passwort</label><input id="authLoginPassword" type="password" autocomplete="current-password" required></div>
          <button class="primary" type="submit">Anmelden</button><div id="authLoginResult" class="employee-login-error">${detail?`<div class="notice warning">${escapeHtml(detail)}</div>`:''}</div></form></div>
      </div><p class="muted" style="text-align:center;margin-top:18px">Externe Unterweisungen bleiben unabhängig davon über ihren persönlichen Link erreichbar.</p>
    </section>`;
    document.getElementById('authPasswordLogin')?.addEventListener('submit',passwordLogin);
  }

  async function passwordLogin(event){
    event?.preventDefault();
    const result=document.getElementById('authLoginResult');
    if(result)result.textContent='Anmeldung wird geprüft …';
    try{
      const response=await fetch('/api/auth/password/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:document.getElementById('authLoginEmail')?.value||'',password:document.getElementById('authLoginPassword')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Anmeldung fehlgeschlagen.');
      location.reload();
    }catch(error){
      if(result)result.innerHTML=`<div class="notice dangerbox">${escapeHtml(error.message||error)}</div>`;
    }
  }

  async function logout(event){
    event?.preventDefault();
    try{await fetch('/api/auth/password/logout',{method:'POST',credentials:'include'});}catch{}
    location.href='/.auth/logout';
  }

  function bindLogout(){document.querySelector('.logout-action')?.addEventListener('click',logout);}
  document.addEventListener('DOMContentLoaded',bindLogout);
  bindLogout();
  root.UMAuthLogin=Object.freeze({render,passwordLogin,logout});
})(globalThis);
