import { DEMO_DATA } from './demo-data.js';
import { createDemoStore } from './demo-store.js';

const store = createDemoStore(DEMO_DATA, globalThis.localStorage);
let setupWasVisible = false;

function syncVisibleCompany() {
  const company = store.getState().company;
  const box = document.querySelector('.demo-company');
  if (!box) return;
  const title = box.querySelector('span');
  const subtitle = box.querySelector('small');
  if (title) title.textContent = company.name;
  if (subtitle) subtitle.textContent = `${company.industry} · ${company.location}`;
}

function initResetSync() {
  const reset = document.getElementById('demoReset');
  if (!reset) return;

  reset.addEventListener('click', () => {
    setupWasVisible = Boolean(document.querySelector('.admin-setup-header'));
  }, { capture: true });

  reset.addEventListener('click', () => {
    queueMicrotask(() => {
      syncVisibleCompany();

      // A confirmed reset replaces the setup workspace with the regular
      // admin dashboard. A cancelled confirmation leaves it mounted.
      if (setupWasVisible && !document.querySelector('.admin-setup-header')) {
        document.querySelector('#demoNav [data-view="dashboard"]')?.click();
      }
      setupWasVisible = false;
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResetSync, { once: true });
  } else {
    initResetSync();
  }
}

export { syncVisibleCompany };
