from pathlib import Path

path=Path('frontend/app.js')
text=path.read_text()
old="""function setCoreWorkspaceVisible(visible){
  const nav = document.getElementById('portalNavigation') || document.querySelector('.primary-tabs');
  if(nav) nav.hidden = !visible;
  document.querySelectorAll('.view').forEach(view => { view.hidden = !visible; });
  document.body.classList.toggle('auth-pending', !visible);
}"""
new="""function setCoreWorkspaceVisible(visible){
  const authenticatedApp = $('authenticatedApp');
  if(authenticatedApp) authenticatedApp.hidden = !visible;
  const nav = document.getElementById('portalNavigation') || document.querySelector('.primary-tabs');
  if(nav) nav.hidden = !visible;
  document.querySelectorAll('.view').forEach(view => { view.hidden = !visible; });
  document.body.classList.toggle('auth-pending', !visible);
}"""
if text.count(old) != 1:
    raise SystemExit(f'workspace visibility anchor count={text.count(old)}')
text=text.replace(old,new)
old_tail="""document.getElementById('companySwitchAction')?.addEventListener('click', leaveCompanyContext);
loadData();"""
new_tail="""document.getElementById('companySwitchAction')?.addEventListener('click', leaveCompanyContext);
renderAuthenticationRequired();
loadData();"""
if text.count(old_tail) != 1:
    raise SystemExit(f'startup anchor count={text.count(old_tail)}')
path.write_text(text.replace(old_tail,new_tail))
