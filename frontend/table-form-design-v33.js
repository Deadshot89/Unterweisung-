// v0.35.2: Professioneller Tabellen- und Formular-Layer.
// Performance-Hotfix: keine dauerhafte Body-Beobachtung, keine Render-Schleife.
// Keine Fachlogik, keine API-Aenderung: nur visuelle Klassifizierung dynamisch gerenderter Bereiche.

const TABLE_FORM_DESIGN_VERSION = 'v0.35.2';

let tableFormPolishScheduled = false;
let tableFormPolishRunning = false;

function applyTableFormPolish(root = document){
  if(tableFormPolishRunning) return;
  tableFormPolishRunning = true;
  try{
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

    document.body.dataset.tableFormDesign = TABLE_FORM_DESIGN_VERSION;
  } finally {
    tableFormPolishRunning = false;
  }
}

function scheduleTableFormPolish(){
  if(tableFormPolishScheduled) return;
  tableFormPolishScheduled = true;
  window.requestAnimationFrame(() => {
    tableFormPolishScheduled = false;
    applyTableFormPolish();
  });
}

if(typeof render === 'function'){
  const originalRenderForTableForm = render;
  render = function(id){
    const result = originalRenderForTableForm(id);
    scheduleTableFormPolish();
    return result;
  };
}

document.addEventListener('DOMContentLoaded', scheduleTableFormPolish);
window.addEventListener('load', scheduleTableFormPolish);

window.applyTableFormPolish = applyTableFormPolish;
window.scheduleTableFormPolish = scheduleTableFormPolish;
window.TABLE_FORM_DESIGN_VERSION = TABLE_FORM_DESIGN_VERSION;

scheduleTableFormPolish();
