(function(root){
  const escapeHtml=(value='')=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function passwordSetupToken(){
    const params=new URLSearchParams(String(location.hash || '').replace(/^#/,''));
    return String(params.get('passwordSetup') || '');
  }

  function hasPasswordSetupToken(){
    return !!passwordSetupToken();
  }

  function renderSetup({target,token}){
    target.hidden=false;
    target.innerHTML=`<section class="dual-login-shell">
      <div class="dual-login-head"><span class="portal-badge">Unterweisungsmanager</span><h2>Passwort festlegen</h2><p class="muted">Lege dein persönliches Passwort für den Unterweisungsmanager fest.</p></div>
      <div class="card dual-login-card" style="max-width:620px;margin:0 auto">
        <form id="authPasswordSetup">
          <div class="field"><label for="authSetupPassword">Neues Passwort</label><input id="authSetupPassword" type="password" autocomplete="new-password" minlength="10" maxlength="256" required></div>
          <div class="field"><label for="authSetupPasswordConfirm">Passwort bestätigen</label><input id="authSetupPasswordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="256" required></div>
          <p class="muted">Das Passwort muss 10 bis 256 Zeichen lang sein.</p>
          <button class="primary" type="submit">Passwort speichern</button>
          <div id="authSetupResult" class="employee-login-error"></div>
        </form>
      </div>
    </section>`;
    document.getElementById('authPasswordSetup')?.addEventListener('submit',event=>passwordSetup(event,target,token));
  }

  function render({target,message=''}){
    if(!target)return;
    const token=passwordSetupToken();
    if(token){renderSetup({target,token});return;}
    const detail=String(message||'').replace(/^.*?Fehler:\s*/,'').trim();
    target.hidden=false;
    target.innerHTML=`<section class="dual-login-shell">
      <div class="dual-login-head"><span class="portal-badge">Unterweisungsmanager</span><h2>Anmeldung</h2><p class="muted">Melde dich mit deiner E-Mail-Adresse und deinem persönlichen Passwort an.</p></div>
      <div class="card dual-login-card" style="max-width:620px;margin:0 auto">
        <h3>E-Mail und Passwort</h3>
        <p>Deine hinterlegte Rolle und Firmenzuordnung bestimmen automatisch, welche Bereiche und Daten du verwenden darfst.</p>
        <form id="authPasswordLogin">
          <div class="field"><label for="authLoginEmail">E-Mail</label><input id="authLoginEmail" type="email" autocomplete="username" required></div>
          <div class="field"><label for="authLoginPassword">Passwort</label><input id="authLoginPassword" type="password" autocomplete="current-password" required></div>
          <button class="primary" type="submit">Anmelden</button>
          <div id="authLoginResult" class="employee-login-error">${detail?`<div class="notice warning">${escapeHtml(detail)}</div>`:''}</div>
        </form>
        <p class="muted" style="margin-top:14px">Noch kein Passwort oder Passwort vergessen? Verwende den einmaligen Passwort-Setup-Link, den du von deinem Administrator erhalten hast.</p>
      </div>
      <p class="muted" style="text-align:center;margin-top:18px">Externe Unterweisungen bleiben unabhängig davon über ihren persönlichen Link erreichbar.</p>
    </section>`;
    document.getElementById('authPasswordLogin')?.addEventListener('submit',passwordLogin);
  }

  async function passwordSetup(event,target,token){
    event?.preventDefault();
    const result=document.getElementById('authSetupResult');
    const password=document.getElementById('authSetupPassword')?.value||'';
    const passwordConfirm=document.getElementById('authSetupPasswordConfirm')?.value||'';
    if(result)result.textContent='Passwort wird gespeichert …';
    if(password!==passwordConfirm){
      if(result)result.innerHTML='<div class="notice dangerbox">Die Passwörter stimmen nicht überein.</div>';
      return;
    }
    try{
      const response=await fetch('/api/auth/password/setup',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({token,password,passwordConfirm})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Passwort konnte nicht festgelegt werden.');
      history.replaceState(null,'',location.pathname + location.search);
      render({target,message:'Passwort wurde festgelegt. Du kannst dich jetzt anmelden.'});
    }catch(error){
      if(result)result.innerHTML=`<div class="notice dangerbox">${escapeHtml(error.message||error)}</div>`;
    }
  }

  async function passwordLogin(event){
    event?.preventDefault();
    const result=document.getElementById('authLoginResult');
    const submit=event?.currentTarget?.querySelector?.('button[type="submit"]');
    if(result)result.textContent='Anmeldung wird geprüft …';
    if(submit)submit.disabled=true;
    try{
      const response=await fetch('/api/auth/password/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:document.getElementById('authLoginEmail')?.value||'',password:document.getElementById('authLoginPassword')?.value||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Anmeldung fehlgeschlagen.');
      document.dispatchEvent(new CustomEvent('um:password-authenticated',{detail:data}));
    }catch(error){
      if(result)result.innerHTML=`<div class="notice dangerbox">${escapeHtml(error.message||error)}</div>`;
      if(submit)submit.disabled=false;
    }
  }

  async function logout(event){
    event?.preventDefault();
    try{await fetch('/api/auth/password/logout',{method:'POST',credentials:'include'});}catch{}
    location.href='/.auth/logout';
  }

  document.addEventListener('click',event=>{if(event.target?.closest?.('.logout-action'))logout(event);});
  root.UMAuthLogin=Object.freeze({render,passwordLogin,logout,hasPasswordSetupToken});
})(globalThis);