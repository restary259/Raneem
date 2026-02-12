
const CACHE_VERSION = '3.0.0';
const STATIC_CACHE = `darb-static-v${CACHE_VERSION}`;
const AI_CACHE = 'darb-ai-cache';
const DOCS_CACHE = 'darb-docs-cache';
const FONT_CACHE = 'darb-fonts-cache';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately
const STATIC_CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/about',
  '/services',
  '/educational-destinations',
  '/educational-programs',
  '/contact',
  '/partnership',
  '/quiz',
  '/resources',
  '/student-auth',
  '/ai-advisor'
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

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'درب', {
      body: data.body || 'تحديث جديد',
      icon: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
      badge: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'darb-notification',
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'فتح' },
        { action: 'dismiss', title: 'تجاهل' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action !== 'dismiss') {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
  }
});
