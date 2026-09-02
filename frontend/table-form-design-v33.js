// v0.33: Professioneller Tabellen- und Formular-Layer.
// Keine Fachlogik, keine API-Aenderung: nur visuelle Klassifizierung dynamisch gerenderter Bereiche.

const TABLE_FORM_DESIGN_VERSION = 'v0.33';

function applyTableFormPolish(root = document){
  root.querySelectorAll('.table-wrap').forEach((wrap) => {
    wrap.classList.add('professional-table-wrap');
    wrap.querySelectorAll('table').forEach((table) => table.classList.add('professional-table'));
  });

  root.querySelectorAll('.toolbar').forEach((toolbar) => {
    toolbar.classList.add('professional-toolbar');
  });

  root.querySelectorAll('.filters').forEach((filters) => {
    filters.classList.add('professional-filters');
  });

  root.querySelectorAll('.form-grid').forEach((grid) => {
    grid.classList.add('professional-form-grid');
  });

  root.querySelectorAll('.field').forEach((field) => {
    field.classList.add('professional-field');
  });

  root.querySelectorAll('td:last-child').forEach((cell) => {
    const hasAction = cell.querySelector('button,a.btn,input[type="file"]');
    if(hasAction) cell.classList.add('actions-cell');
  });

  root.querySelectorAll('button').forEach((button) => {
    if(button.closest('.primary-tabs')) return;
    button.classList.add('ui-button');
  });

  const version = document.getElementById('appVersion');
  if(version) version.textContent = TABLE_FORM_DESIGN_VERSION;
  document.body.dataset.tableFormDesign = TABLE_FORM_DESIGN_VERSION;
}

if(typeof render === 'function'){
  const originalRenderForTableForm = render;
  render = function(id){
    const result = originalRenderForTableForm(id);
    window.requestAnimationFrame(() => applyTableFormPolish());
    return result;
  };
}

const tableFormObserver = new MutationObserver((mutations) => {
  if(!mutations.some(m => m.addedNodes && m.addedNodes.length)) return;
  window.requestAnimationFrame(() => applyTableFormPolish());
});

tableFormObserver.observe(document.body, { childList:true, subtree:true });

window.applyTableFormPolish = applyTableFormPolish;
window.TABLE_FORM_DESIGN_VERSION = TABLE_FORM_DESIGN_VERSION;

window.requestAnimationFrame(() => applyTableFormPolish());
