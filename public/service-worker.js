
const CACHE_VERSION = '4.2.0';
const STATIC_CACHE = `darb-static-v${CACHE_VERSION}`;
const AI_CACHE = 'darb-ai-cache';
const DOCS_CACHE = 'darb-docs-cache';
const FONT_CACHE = 'darb-fonts-cache';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately — only real files, NOT SPA routes (they 404 on cache.addAll)
const STATIC_CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// Install event
self.addEventListener('install', event => {
  console.log('[SW] Install - v' + CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_CACHE_URLS)),
      self.skipWaiting()
    ])
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate - v' + CACHE_VERSION);
  const keepCaches = [STATIC_CACHE, AI_CACHE, DOCS_CACHE, FONT_CACHE];
  event.waitUntil(
    Promise.all([
      caches.keys().then(names =>
        Promise.all(names.filter(n => !keepCaches.includes(n)).map(n => caches.delete(n)))
      ),
      self.clients.claim()
    ])
  );
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', message: 'تم تحديث التطبيق', version: CACHE_VERSION }));
  });
});

// Message handler
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Clear all caches on logout (security)
  if (event.data?.type === 'CLEAR_CACHES_ON_LOGOUT') {
    caches.keys().then(names =>
      Promise.all(names.map(n => caches.delete(n)))
    ).then(() => {
      console.log('[SW] All caches cleared on logout');
    });
    return;
  }
  // Cache AI conversation
  if (event.data?.type === 'CACHE_AI_RESPONSE') {
    caches.open(AI_CACHE).then(cache => {
      const resp = new Response(JSON.stringify(event.data.conversation));
      cache.put('latest-conversation', resp);
    });
  }
  // Cache document for offline
  if (event.data?.type === 'CACHE_DOCUMENT') {
    caches.open(DOCS_CACHE).then(cache => {
      fetch(event.data.url).then(resp => {
        if (resp.ok) cache.put(event.data.url, resp);
      }).catch(() => {});
    });
  }
});

// Stale-while-revalidate helper
function staleWhileRevalidate(event, cacheName) {
  event.respondWith(
    caches.open(cacheName).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(networkResp => {
          if (networkResp.ok) cache.put(event.request, networkResp.clone());
          return networkResp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
}

// Fetch handler
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // NEVER cache Supabase API requests (auth, database, storage API)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return; // Let browser handle directly
  }

  // Google Fonts -> font cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(resp => {
            cache.put(request, resp.clone());
            return resp;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Skip non-origin requests (except fonts handled above)
  if (!url.origin.includes(self.location.origin)) return;

  // Document files from storage -> docs cache with stale-while-revalidate
  if (url.pathname.includes('/storage/') || url.pathname.includes('/student-documents/')) {
    staleWhileRevalidate(event, DOCS_CACHE);
    return;
  }

  // Navigation requests — NETWORK ONLY (never cache HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets (images, JS, CSS, fonts) -> cache-first
  if (/\.(png|jpg|jpeg|svg|gif|webp|js|css|woff2?|eot|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return resp;
        }).catch(() => {
          if (/\.(png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname)) {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#999">غير متاح</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('غير متاح', { status: 503 });
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request).then(resp => {
      const clone = resp.clone();
      caches.open(STATIC_CACHE).then(c => c.put(request, clone));
      return resp;
    }).catch(() => caches.match(request))
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'contact-form-sync') {
    event.waitUntil(syncContactForms());
  }
});

async function syncContactForms() {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const reqs = await cache.keys();
    for (const req of reqs.filter(r => r.url.includes('/api/contact') && r.method === 'POST')) {
      try { await fetch(req); await cache.delete(req); } catch {}
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------
const NOTIFICATION_ICON = '/icons/icon-192.png';
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

    // Let any open tab refresh its bell/badge without waiting for realtime.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
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

