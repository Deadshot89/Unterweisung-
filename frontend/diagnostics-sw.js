const DIAGNOSTICS_URL = '/diagnostics.html';

async function latestCriticalEvent() {
  try {
    const response = await fetch('/api/diagnostics/latest-critical', {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.event || null;
  } catch {
    return null;
  }
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const diagnostic = await latestCriticalEvent();
    const company = diagnostic?.companyName || diagnostic?.companyId || 'Unterweisungsmanager';
    const area = diagnostic?.area || 'System';
    const status = diagnostic?.httpStatus ? `HTTP ${diagnostic.httpStatus}` : (diagnostic?.errorCode || 'kritisch');
    const body = diagnostic
      ? `${company} · ${area} · ${status}. Tippen für die Fehlerdiagnose.`
      : 'Ein kritischer Fehler wurde erkannt. Tippen für die Fehlerdiagnose.';

    await self.registration.showNotification('Unterweisungsmanager – Kritischer Fehler', {
      body,
      icon: '/diagnostics-icon.svg',
      badge: '/diagnostics-icon.svg',
      tag: 'unterweisungsmanager-critical-diagnostic',
      renotify: true,
      requireInteraction: true,
      data: { url: DIAGNOSTICS_URL }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = event.notification?.data?.url || DIAGNOSTICS_URL;
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          if ('navigate' in client) await client.navigate(target);
          return client.focus();
        }
      } catch {
        // Einen nicht lesbaren Client ignorieren und ein neues Fenster öffnen.
      }
    }
    return self.clients.openWindow(target);
  })());
});
