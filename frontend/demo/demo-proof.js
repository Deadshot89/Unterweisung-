function esc(value='') {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function formatDate(value) {
  if (!value) return '—';
  const [y,m,d] = String(value).slice(0,10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : esc(value);
}

export function buildDemoProofHtml({ company, employee, instruction, completedAt, confirmedBy }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMO Nachweis</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#eef2f7;color:#172033}.sheet{position:relative;max-width:780px;margin:32px auto;background:white;padding:56px;box-shadow:0 14px 40px #0002;overflow:hidden}.watermark{position:absolute;inset:38% -10%;font-size:74px;font-weight:800;letter-spacing:.15em;color:#dbe1ea;transform:rotate(-18deg);text-align:center;pointer-events:none}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #172033;padding-bottom:20px}.badge{font-weight:800;border:2px solid #b42318;color:#b42318;padding:8px 12px;border-radius:999px}.row{display:grid;grid-template-columns:220px 1fr;gap:14px;padding:12px 0;border-bottom:1px solid #e5e7eb}.legal{margin-top:34px;padding:16px;background:#fff4e5;border-left:4px solid #f59e0b}.signature{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px}.line{border-top:1px solid #667085;padding-top:8px;color:#667085;font-size:12px}@media print{body{background:white}.sheet{box-shadow:none;margin:0;max-width:none}}
</style></head><body><main class="sheet"><div class="watermark">DEMO / MUSTER</div><div class="top"><div><div style="font-size:13px;color:#667085;text-transform:uppercase;letter-spacing:.08em">Unterweisungsnachweis</div><h1>${esc(company?.name)}</h1></div><div class="badge">DEMO / MUSTER</div></div>
<div class="row"><strong>Mitarbeiter</strong><span>${esc(employee?.name)}</span></div>
<div class="row"><strong>Unterweisung</strong><span>${esc(instruction?.name)}</span></div>
<div class="row"><strong>Abschlussdatum</strong><span>${formatDate(completedAt)}</span></div>
<div class="row"><strong>Durchführung</strong><span>${instruction?.deliveryMode === 'practical' ? 'Praktische Demo-Unterweisung' : 'Online-Demo-Unterweisung'}</span></div>
${confirmedBy ? `<div class="row"><strong>Bestätigt durch</strong><span>${esc(confirmedBy)}</span></div>` : ''}
<p class="legal"><strong>Hinweis:</strong> Dieser Nachweis ist ein fiktives Präsentationsmuster und besitzt keine rechtliche Gültigkeit.</p>
<div class="signature"><div class="line">Demo-Mitarbeiter</div><div class="line">Demo-Verantwortliche Person</div></div></main></body></html>`;
}
