
const CACHE_NAME = 'darb-education-v1.0.2'; // Increment version for updates
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
  '/student-auth'
];

// Runtime cache patterns
const RUNTIME_CACHE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /\.(?:js|css)$/,
  /\.(?:woff|woff2|eot|ttf|otf)$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Install event - Version 1.0.2');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      self.skipWaiting() // Force activation of new service worker
    ])
  );
});

// Activate event - cleanup old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activate event - New version ready');
  
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim() // Take control of all clients immediately
    ])
  );
  
  // Notify all clients about the update with enhanced messaging
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        message: 'تم تحديث التطبيق بنجاح! إصدار جديد متاح.',
        version: '1.0.2'
      });
    });
  });
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Check for updates every 15 minutes (reduced from 30)
setInterval(() => {
  self.registration.update();
}, 15 * 60 * 1000);

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) return;

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then(response => {
              // Clone the response before caching
              const responseClone = response.clone();
              
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              
              return response;
            })
            .catch(() => {
              // Return offline page for navigation requests
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (RUNTIME_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then(response => {
              // Don't cache if not a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              
              return response;
            })
            .catch(() => {
              // Return a placeholder for failed image requests
              if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
                return new Response(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#999">صورة غير متاحة</text></svg>',
                  { headers: { 'Content-Type': 'image/svg+xml' } }
                );
              }
              return new Response('المحتوى غير متاح حالياً', { 
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
        })
    );
    return;
  }

  // Default: network first for other requests
  event.respondWith(
    fetch(request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'contact-form-sync') {
    event.waitUntil(syncContactForms());
  }
});

// Function to sync contact forms when back online
async function syncContactForms() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const formRequests = requests.filter(req => 
      req.url.includes('/api/contact') && req.method === 'POST'
    );
    
    for (const request of formRequests) {
      try {
        await fetch(request);
        await cache.delete(request);
      } catch (error) {
        console.log('[SW] Failed to sync form:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Background sync failed:', error);
  }
}

// Enhanced push notification handler
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'تحديث جديد متاح في تطبيق درب',
    icon: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
    badge: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
    vibrate: [100, 50, 100],
    tag: 'app-update',
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 1,
      url: data.url || '/'
    },
    actions: [
      {
        action: 'update',
        title: 'تحديث الآن',
        icon: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png'
      },
      {
        action: 'later',
        title: 'لاحقاً',
        icon: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'درب - تحديث التطبيق', options)
  );
});

// Enhanced notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'update') {
    event.waitUntil(
      clients.openWindow('/').then(client => {
        if (client) {
          client.postMessage({ type: 'FORCE_RELOAD' });
        }
      })
    );
  } else if (event.action === 'later') {
    // Do nothing, just close
  } else {
    // Default click action
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});
