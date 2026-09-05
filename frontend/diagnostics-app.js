(() => {
  const $ = id => document.getElementById(id);
  const API_BASE_URL = String(window.UM_API_BASE_URL || '').replace(/\/$/, '');
  const DEVICE_STORAGE_KEY = 'diagnosticsPushDeviceId';
  const state = { me: null, events: [], devices: [], installPrompt: null, registration: null };

  function apiUrl(path) {
    const cleanPath = String(path || '').startsWith('/') ? path : `/${path}`;
    return API_BASE_URL ? `${API_BASE_URL}/api${cleanPath}` : `/api${cleanPath}`;
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const response = await fetch(apiUrl(path), { ...options, headers, credentials: 'include', mode: 'cors', cache: 'no-store' });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = null; }
    }
    if (!response.ok) {
      const err = new Error(payload?.error || text || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return payload ?? {};
  }

  function esc(value = '') {
    return String(value ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }

  function isSystemAdmin() {
    return !!state.me?.roles?.includes('system_admin');
  }

  function hasDiagnosticAccess() {
    return isSystemAdmin() || !!state.me?.permissions?.includes('diagnostics.view');
  }

  function setMessage(text, kind = 'info') {
    const el = $('diagAccessMessage');
    if (!el) return;
    el.className = `message ${kind}`;
    el.textContent = text;
    el.hidden = !text;
  }

  function setPushMessage(text, kind = 'info') {
    const el = $('diagPushStatus');
    if (!el) return;
    el.className = `message ${kind}`;
    el.textContent = text;
    el.hidden = !text;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('de-DE');
  }

  function severityLabel(value) {
    return ({ critical:'Kritisch', warning:'Warnung', info:'Information' })[value] || value || '—';
  }

  function currentDeviceId() {
    try { return localStorage.getItem(DEVICE_STORAGE_KEY) || ''; } catch { return ''; }
  }

  function rememberDeviceId(value) {
    try {
      if (value) localStorage.setItem(DEVICE_STORAGE_KEY, String(value));
      else localStorage.removeItem(DEVICE_STORAGE_KEY);
    } catch {
      // Push funktioniert auch ohne lokalen Gerätenamen-Marker weiter.
    }
  }

  function detectDeviceLabel() {
    const ua = String(navigator.userAgent || '');
    const os = /Android/i.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone / iPad'
      : /Windows/i.test(ua) ? 'Windows'
      : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
      : /Linux/i.test(ua) ? 'Linux'
      : 'Unbekanntes Gerät';
    const browser = /EdgA|EdgiOS|Edg\//i.test(ua) ? 'Edge'
      : /CriOS|Chrome/i.test(ua) ? 'Chrome'
      : /FxiOS|Firefox/i.test(ua) ? 'Firefox'
      : /Safari/i.test(ua) ? 'Safari'
      : 'Browser';
    return `${os} · ${browser}`;
  }

  function queryString({ includeSearch = true } = {}) {
    const params = new URLSearchParams();
    const companyId = $('diagCompany')?.value || '';
    const severity = $('diagSeverity')?.value || '';
    const search = $('diagSearch')?.value.trim() || '';
    if (companyId && isSystemAdmin()) params.set('companyId', companyId);
    if (severity) params.set('severity', severity);
    if (includeSearch && search) params.set('search', search);
    return params.toString();
  }

  async function loadCompanies() {
    if (!isSystemAdmin()) return;
    const wrap = $('diagCompanyWrap');
    if (wrap) wrap.hidden = false;
    try {
      const companies = await api('/system/companies');
      const select = $('diagCompany');
      if (!select) return;
      const current = select.value;
      select.innerHTML = '<option value="">Alle Firmen</option>' + (Array.isArray(companies) ? companies : [])
        .filter(company => company && company.active !== false)
        .map(company => `<option value="${esc(company.id)}">${esc(company.name || company.id)}</option>`)
        .join('');
      if ([...select.options].some(option => option.value === current)) select.value = current;
    } catch {
      // Die Diagnose selbst bleibt nutzbar, auch wenn die Firmenliste vorübergehend nicht geladen werden kann.
    }
  }

  function renderStatus(status) {
    $('statusApi').textContent = String(status?.api || '—').toUpperCase();
    $('statusDatabase').textContent = String(status?.database || '—').toUpperCase();
    $('statusEmail').textContent = status?.alerts?.email?.configured ? 'BEREIT' : 'NICHT BEREIT';
    $('statusPush').textContent = status?.alerts?.push?.configured ? 'BEREIT' : 'NICHT BEREIT';
    $('countCritical').textContent = String(status?.counts?.critical ?? 0);
    $('countWarning').textContent = String(status?.counts?.warning ?? 0);
    $('countInfo').textContent = String(status?.counts?.info ?? 0);
  }

  function renderEvents(events) {
    state.events = Array.isArray(events) ? events : [];
    const tbody = $('diagEvents');
    if (!tbody) return;
    if (!state.events.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">Keine Diagnoseereignisse für diesen Filter.</td></tr>';
      $('diagEventCount').textContent = '0 Ereignisse';
      $('diagDetails').className = 'details-empty';
      $('diagDetails').textContent = 'Keine Ereignisse vorhanden.';
      return;
    }
    tbody.innerHTML = state.events.map(event => `
      <tr data-event-id="${esc(event.id)}">
        <td>${esc(formatDate(event.createdAt))}</td>
        <td><span class="severity ${esc(event.severity)}">${esc(severityLabel(event.severity))}</span></td>
        <td><strong>${esc(event.companyName || event.companyId || 'Systemweit')}</strong></td>
        <td><strong>${esc(event.area || '—')}</strong><br><span class="muted">${esc(event.action || '—')}</span></td>
        <td>${esc(event.errorMessage || '—')}<br><span class="muted">${esc(event.errorCode || '')}</span></td>
        <td>${esc(event.httpMethod || '')} ${esc(event.apiPath || '—')}<br><span class="muted">HTTP ${esc(event.httpStatus || '—')}</span></td>
        <td>${esc(event.actorName || event.actorEmail || event.actorUserId || '—')}</td>
      </tr>`).join('');
    $('diagEventCount').textContent = `${state.events.length} Ereignisse angezeigt`;
    tbody.querySelectorAll('[data-event-id]').forEach(row => row.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(item => item.classList.remove('selected'));
      row.classList.add('selected');
      const event = state.events.find(item => String(item.id) === String(row.dataset.eventId));
      if (event) renderDetails(event);
    }));
  }

  function detail(label, value, wide = false) {
    return `<div class="detail${wide ? ' wide' : ''}"><label>${esc(label)}</label><div>${esc(value || '—')}</div></div>`;
  }

  function renderDetails(event) {
    const el = $('diagDetails');
    el.className = 'details-grid';
    el.innerHTML = [
      detail('Zeit', formatDate(event.createdAt)),
      detail('Schweregrad', severityLabel(event.severity)),
      detail('Firma', event.companyName || event.companyId || 'Systemweit'),
      detail('Benutzer', event.actorName || event.actorEmail || event.actorUserId || '—'),
      detail('Bereich', event.area),
      detail('Aktion', event.action),
      detail('Fehlercode', event.errorCode),
      detail('HTTP', event.httpStatus ? `${event.httpMethod || ''} ${event.httpStatus}`.trim() : '—'),
      detail('App-Version', event.appVersion),
      detail('API-Aufruf', event.apiPath, true),
      detail('Fehlermeldung', event.errorMessage, true),
      detail('Browser / Gerät', event.userAgent, true)
    ].join('');
  }

  async function loadDiagnostics() {
    const refresh = $('diagRefresh');
    if (refresh) refresh.disabled = true;
    try {
      const eventQuery = queryString();
      const statusQuery = queryString({ includeSearch: false });
      const [status, events] = await Promise.all([
        api(`/diagnostics/status${statusQuery ? `?${statusQuery}` : ''}`),
        api(`/diagnostics/events${eventQuery ? `?${eventQuery}` : ''}`)
      ]);
      renderStatus(status);
      renderEvents(events.events || []);
      setMessage('');
    } catch (err) {
      setMessage(`Diagnosedaten konnten nicht geladen werden: ${err.message || err}`, 'error');
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  async function downloadExport() {
    const button = $('diagExport');
    if (button) button.disabled = true;
    try {
      const query = queryString();
      const response = await fetch(apiUrl(`/diagnostics/export${query ? `?${query}` : ''}`), {
        credentials: 'include', mode: 'cors', cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Export fehlgeschlagen (HTTP ${response.status}).`);
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = match?.[1] || `unterweisungsmanager-diagnose-${new Date().toISOString().slice(0,10)}.json`;
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (err) {
      setMessage(err.message || String(err), 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    if (state.registration) return state.registration;
    state.registration = await navigator.serviceWorker.register('/diagnostics-sw.js');
    return state.registration;
  }

  async function registerPushDevice(subscription) {
    const result = await api('/diagnostics/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint: subscription.endpoint, deviceLabel: detectDeviceLabel() })
    });
    if (result.deviceId) rememberDeviceId(result.deviceId);
    return result;
  }

  function renderPushDevices(devices) {
    state.devices = Array.isArray(devices) ? devices : [];
    const tbody = $('diagDevices');
    if (!tbody) return;
    if (!state.devices.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Noch kein Gerät für Pushmeldungen registriert.</td></tr>';
      return;
    }
    const localDeviceId = currentDeviceId();
    tbody.innerHTML = state.devices.map(device => {
      const current = String(device.id) === String(localDeviceId);
      const name = device.deviceName || device.deviceLabel || 'Unbekanntes Gerät';
      const status = device.lastError
        ? `Fehler: ${device.lastError}`
        : device.lastSuccessAt ? 'Push aktiv' : 'Registriert, noch keine Zustellung';
      return `<tr data-device-id="${esc(device.id)}">
        <td><strong>${esc(name)}</strong>${current ? '<br><span class="muted">dieses Gerät</span>' : ''}${device.deviceName && device.deviceLabel ? `<br><span class="muted">${esc(device.deviceLabel)}</span>` : ''}</td>
        <td>${esc(formatDate(device.createdAt))}</td>
        <td>${esc(formatDate(device.lastSuccessAt))}</td>
        <td>${esc(status)}</td>
        <td>
          <button type="button" class="button secondary" data-device-rename="${esc(device.id)}">Gerät umbenennen</button>
          <button type="button" class="button secondary" data-device-remove="${esc(device.id)}">Gerät entfernen</button>
        </td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-device-rename]').forEach(button => button.addEventListener('click', () => renamePushDevice(button.dataset.deviceRename)));
    tbody.querySelectorAll('[data-device-remove]').forEach(button => button.addEventListener('click', () => removePushDevice(button.dataset.deviceRemove)));
  }

  async function loadPushDevices() {
    if (!isSystemAdmin()) return;
    if ($('diagDevicesPanel')) $('diagDevicesPanel').hidden = false;
    try {
      const result = await api('/diagnostics/push/devices');
      renderPushDevices(result.devices || []);
    } catch (err) {
      const tbody = $('diagDevices');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Geräte konnten nicht geladen werden: ${esc(err.message || err)}</td></tr>`;
    }
  }

  async function renamePushDevice(id) {
    const device = state.devices.find(item => String(item.id) === String(id));
    if (!device) return;
    const value = window.prompt('Gerät umbenennen', device.deviceName || device.deviceLabel || '');
    if (value === null) return;
    try {
      await api(`/diagnostics/push/devices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ deviceName: value.trim() })
      });
      await loadPushDevices();
    } catch (err) {
      setPushMessage(`Gerät konnte nicht umbenannt werden: ${err.message || err}`, 'error');
    }
  }

  async function removePushDevice(id) {
    const device = state.devices.find(item => String(item.id) === String(id));
    if (!device) return;
    if (!window.confirm(`Gerät „${device.deviceName || device.deviceLabel || 'Unbekanntes Gerät'}“ wirklich entfernen?`)) return;
    try {
      const isCurrent = String(id) === String(currentDeviceId());
      if (isCurrent) {
        const registration = await registerServiceWorker().catch(() => null);
        const subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null;
        if (subscription) await subscription.unsubscribe().catch(() => false);
        rememberDeviceId('');
      }
      await api(`/diagnostics/push/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (isCurrent && $('diagPushEnable')) $('diagPushEnable').textContent = 'Handy-Benachrichtigungen aktivieren';
      setPushMessage('Gerät wurde aus den Push-Benachrichtigungen entfernt.', 'success');
      await loadPushDevices();
    } catch (err) {
      setPushMessage(`Gerät konnte nicht entfernt werden: ${err.message || err}`, 'error');
    }
  }

  async function enablePush() {
    if (!isSystemAdmin()) return;
    const button = $('diagPushEnable');
    if (button) button.disabled = true;
    try {
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
        throw new Error('Dieses Gerät unterstützt Web-Push nicht vollständig.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushMessage('Benachrichtigungen wurden nicht freigegeben. Du kannst sie später in den Browser-/Android-Einstellungen erlauben.', 'warning');
        return;
      }
      const registration = await registerServiceWorker();
      const config = await api('/diagnostics/push/config');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey)
        });
      }
      await registerPushDevice(subscription);
      setPushMessage('Handy-Benachrichtigungen sind auf diesem Gerät aktiviert. Kritische Fehler werden zusätzlich per E-Mail gemeldet.', 'success');
      if (button) button.textContent = 'Handy-Benachrichtigungen aktiv';
      await loadPushDevices();
    } catch (err) {
      setPushMessage(`Push-Aktivierung fehlgeschlagen: ${err.message || err}`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function updatePushState() {
    if (!isSystemAdmin()) return;
    const button = $('diagPushEnable');
    button.hidden = false;
    if ($('diagDevicesPanel')) $('diagDevicesPanel').hidden = false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      button.disabled = true;
      setPushMessage('Web-Push wird von diesem Browser nicht unterstützt.', 'warning');
      await loadPushDevices();
      return;
    }
    try {
      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        await registerPushDevice(subscription);
        button.textContent = 'Handy-Benachrichtigungen aktiv';
        setPushMessage('Dieses Gerät ist bereits für kritische Pushmeldungen registriert.', 'success');
      }
      await loadPushDevices();
    } catch (err) {
      setPushMessage(`Service Worker konnte nicht vorbereitet werden: ${err.message || err}`, 'warning');
      await loadPushDevices();
    }
  }

  function bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.installPrompt = event;
      $('diagInstall').hidden = false;
    });
    $('diagInstall')?.addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      await state.installPrompt.userChoice.catch(() => null);
      state.installPrompt = null;
      $('diagInstall').hidden = true;
    });
    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      if ($('diagInstall')) $('diagInstall').hidden = true;
    });
  }

  async function initialize() {
    bindInstallPrompt();
    try {
      state.me = await api('/me');
      $('diagUser').textContent = `${state.me.displayName || state.me.email || 'Benutzer'} · ${(state.me.roles || []).includes('system_admin') ? 'System Admin' : 'Diagnosezugriff'}`;
      if (!hasDiagnosticAccess()) {
        setMessage('Für dieses Benutzerkonto ist die Fehlerdiagnose nicht freigegeben.', 'error');
        return;
      }
      $('diagWorkspace').hidden = false;
      setMessage('');
      await loadCompanies();
      await Promise.all([loadDiagnostics(), updatePushState()]);
    } catch (err) {
      $('diagUser').textContent = 'Nicht angemeldet';
      const text = Number(err?.status) === 401
        ? 'Bitte zuerst im Unterweisungsmanager anmelden und die Fehlerdiagnose danach erneut öffnen.'
        : `Fehlerdiagnose konnte nicht gestartet werden: ${err.message || err}`;
      setMessage(text, 'error');
    }
  }

  $('diagRefresh')?.addEventListener('click', loadDiagnostics);
  $('diagExport')?.addEventListener('click', downloadExport);
  $('diagPushEnable')?.addEventListener('click', enablePush);
  $('diagDevicesRefresh')?.addEventListener('click', loadPushDevices);
  $('diagCompany')?.addEventListener('change', loadDiagnostics);
  $('diagSeverity')?.addEventListener('change', loadDiagnostics);
  let searchTimer = null;
  $('diagSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadDiagnostics, 350);
  });

  initialize();
})();
