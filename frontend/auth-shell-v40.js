// v0.40: Sichtbare Hauptoberfläche erst nach bestätigter Authentifizierung.
(function(){
  function setAuthenticationShellState(mode){
    const body=document.body;if(!body)return;
    body.classList.remove('auth-pending','auth-required','auth-authenticated');
    if(mode==='authenticated')body.classList.add('auth-authenticated');
    else if(mode==='required')body.classList.add('auth-required');
    else body.classList.add('auth-pending');
    body.dataset.authState=mode;
  }

  const originalRenderUserInfo=typeof renderUserInfo==='function'?renderUserInfo:null;
  if(originalRenderUserInfo){
    renderUserInfo=function(ok=true){
      if(ok&&state?.me)setAuthenticationShellState('authenticated');
      else if(!ok)setAuthenticationShellState('required');
      return originalRenderUserInfo(ok);
    };
  }

  window.setAuthenticationShellState=setAuthenticationShellState;
  setAuthenticationShellState(state?.me?'authenticated':'pending');
})();
