// DARB service worker — v5.0.2 (larger brand icon refresh)
//
// This worker replaces the old caching worker at the SAME URL so returning
// browsers pick it up automatically on their next online visit.
//
// What changed:
//   - ALL offline caching removed (no fetch handler). The app is online-only;
//     the old cached SPA shell can never be served against the new server-
//     rendered app.
//   - Every old cache is deleted on activate.
// What is preserved:
//   - Web Push: the push / notificationclick / pushsubscriptionchange handlers
//     are carried over verbatim, so existing push subscriptions keep working
//     without users re-granting permission.

const CACHE_VERSION = '5.3.0';

// Unread count painted on the OS app icon while the app is closed. The open app
// overwrites this with the authoritative total as soon as it is focused.
let badgeCount = 0;

async function setBadge(count) {
  badgeCount = Math.max(0, count);
  try {
    if (badgeCount > 0) await self.navigator.setAppBadge?.(badgeCount);
    else await self.navigator.clearAppBadge?.();
  } catch { /* unsupported browser */ }
}

function bumpBadge(delta) {
  return setBadge(badgeCount + delta);
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Drop every cache the old worker created (darb-static-v*, darb-ai-cache,
      // darb-docs-cache, darb-fonts-cache, and anything else on this origin
      // owned by the previous worker).
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))),
      self.clients.claim(),
    ])
  );
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', message: 'تم تحديث التطبيق', version: CACHE_VERSION }));
  });
});

// Message handler — kept for compatibility with app code that posts these.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHES_ON_LOGOUT') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
  // The open app owns the authoritative unread total; keep the worker aligned
  // so a later background push counts up from the right number.
  if (event.data?.type === 'SET_APP_BADGE') {
    badgeCount = 0;
    bumpBadge(Number(event.data.count) || 0);
  }
});

// NOTE: intentionally NO 'fetch' handler — no offline mode, no response caching.

// ---------------------------------------------------------------------------
// Web Push (preserved verbatim from the pre-migration worker)
// ---------------------------------------------------------------------------
const NOTIFICATION_ICON = '/icons/icon-192-v2.png';
// Android / Samsung Internet render `badge` as a monochrome mask, so it must be
// a white-on-transparent silhouette rather than the colour logo. iOS ignores it.
const NOTIFICATION_BADGE = '/icons/badge-96.png';

function parsePushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    // A push service ping without a JSON payload still deserves a notification;
    // iOS drops the subscription if we show nothing at all.
    return { body: event.data.text() };
  }
}

self.addEventListener('push', event => {
  const data = parsePushData(event);
  const title = data.title || 'درب';

  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || 'تحديث جديد',
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      lang: 'ar',
      dir: 'rtl',
      vibrate: [100, 50, 100],
      tag: data.tag || 'darb-notification',
      renotify: Boolean(data.tag),
      requireInteraction: data.priority === 'high',
      timestamp: Date.now(),
      data: {
        url: data.url || '/',
        notificationId: data.notificationId || null,
        category: data.category || 'system',
      },
    });

    // Red count on the installed app icon (home screen / dock / taskbar).
    // Prefer the server's authoritative unread count; fall back to +1.
    if (typeof data.badge === 'number') await setBadge(data.badge);
    else await bumpBadge(1);

    // Let any open tab refresh its bell/badge without waiting for realtime.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  bumpBadge(-1);
  if (event.action === 'dismiss') return;

  const target = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const scopeOrigin = self.location.origin;
    const absolute = new URL(target, scopeOrigin).href;

    // Reuse an existing app window (required on iOS standalone, where opening a
    // second window is not allowed) and navigate it client-side.
    for (const client of windows) {
      if (new URL(client.url).origin !== scopeOrigin) continue;
      await client.focus();
      client.postMessage({ type: 'NOTIFICATION_CLICK', url: target });
      if ('navigate' in client && client.url !== absolute) {
        try { await client.navigate(absolute); } catch { /* SPA handles it via postMessage */ }
      }
      return;
    }

    if (self.clients.openWindow) await self.clients.openWindow(absolute);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  // The browser rotated the subscription; tell the app to re-register on next load.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
  })());
});
