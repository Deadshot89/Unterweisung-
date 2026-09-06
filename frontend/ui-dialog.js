// v0.40: Gemeinsame, barrierearme Dialoggrundlage.
// Task 5 migriert die verbleibenden nativen prompt/confirm-Aufrufe schrittweise hierher.
(function(){
  let active = null;

  function ensureHost(){
    let host = document.getElementById('umDialogHost');
    if(host) return host;
    host = document.createElement('div');
    host.id = 'umDialogHost';
    host.className = 'um-dialog-host';
    host.hidden = true;
    document.body.appendChild(host);
    return host;
  }

  function close(value){
    if(!active) return;
    const current = active;
    active = null;
    current.host.hidden = true;
    current.host.innerHTML = '';
    current.resolve(value);
    current.restoreFocus?.focus?.({preventScroll:true});
  }

  function open({title='Hinweis', message='', confirmLabel='OK', cancelLabel='', inputValue=null, inputLabel='Eingabe'}={}){
    if(active) close(false);
    const host = ensureHost();
    const restoreFocus = document.activeElement;
    host.hidden = false;
    host.innerHTML = `<div class="um-dialog-backdrop" data-dialog-close="cancel">
      <section class="um-dialog" role="dialog" aria-modal="true" aria-labelledby="umDialogTitle">
        <header><h2 id="umDialogTitle"></h2></header>
        <div class="um-dialog-body"><p id="umDialogMessage"></p>${inputValue===null?'':`<label class="um-dialog-field"><span></span><input id="umDialogInput"></label>`}</div>
        <footer>${cancelLabel?'<button type="button" class="btn ghost" data-dialog-action="cancel"></button>':''}<button type="button" class="btn primary" data-dialog-action="confirm"></button></footer>
      </section>
    </div>`;
    host.querySelector('#umDialogTitle').textContent = title;
    host.querySelector('#umDialogMessage').textContent = message;
    const confirm = host.querySelector('[data-dialog-action="confirm"]');
    confirm.textContent = confirmLabel;
    const cancel = host.querySelector('[data-dialog-action="cancel"]');
    if(cancel) cancel.textContent = cancelLabel;
    const field = host.querySelector('.um-dialog-field span');
    const input = host.querySelector('#umDialogInput');
    if(field) field.textContent = inputLabel;
    if(input) input.value = inputValue ?? '';

    return new Promise(resolve => {
      active = {host, resolve, restoreFocus};
      const finish = accepted => close(input ? (accepted ? input.value : null) : accepted);
      confirm.addEventListener('click', () => finish(true));
      cancel?.addEventListener('click', () => finish(false));
      host.querySelector('.um-dialog-backdrop')?.addEventListener('click', event => {
        if(event.target?.dataset?.dialogClose === 'cancel' && cancelLabel) finish(false);
      });
      host.addEventListener('keydown', event => {
        if(event.key === 'Escape' && cancelLabel){ event.preventDefault(); finish(false); }
        if(event.key === 'Enter' && input && event.target === input){ event.preventDefault(); finish(true); }
      }, {once:false});
      (input || confirm).focus();
    });
  }

  window.UMDialog = {
    alert(message, title='Hinweis'){ return open({title,message,confirmLabel:'OK'}); },
    confirm(message, title='Bestätigen'){ return open({title,message,confirmLabel:'Bestätigen',cancelLabel:'Abbrechen'}); },
    prompt(message, value='', title='Eingabe'){ return open({title,message,confirmLabel:'Übernehmen',cancelLabel:'Abbrechen',inputValue:value,inputLabel:message}); },
    close
  };
})();
