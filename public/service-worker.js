
const CACHE_NAME = 'darb-education-v1.0.3'; // Increment version for security update
const OFFLINE_URL = '/offline.html';

// Enhanced security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// Secure cache patterns - exclude sensitive routes
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
  '/resources'
  // Explicitly exclude /student-auth and /student-dashboard for security
];

// Sensitive routes that should never be cached
const NEVER_CACHE_PATTERNS = [
  /\/student-auth/,
  /\/student-dashboard/,
  /\/api\//,
  /\/auth\//,
  /\/admin/,
  /\.env/,
  /\/config/
];

// Runtime cache patterns with security considerations
const RUNTIME_CACHE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /\.(?:js|css)$/,
  /\.(?:woff|woff2|eot|ttf|otf)$/
];

// Install event - cache static assets securely
self.addEventListener('install', event => {
  console.log('[SW] Secure install event - Version 1.0.3');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching static assets securely');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event - Secure version ready');
  
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
      self.clients.claim()
    ])
  );
  
  // Notify clients about security update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        message: 'تم تحديث الأمان! إصدار محسن مع حماية إضافية.',
        version: '1.0.3'
      });
    });
  });
});

// Enhanced fetch handler with security
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for security
  if (request.method !== 'GET') return;

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) return;

  // Never cache sensitive routes
  if (NEVER_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }

  // Handle navigation requests with security headers
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return addSecurityHeaders(cachedResponse);
          }
          
          return fetch(request)
            .then(response => {
              // Don't cache responses with sensitive headers
              if (response.headers.get('Set-Cookie') || 
                  response.headers.get('Authorization')) {
                return addSecurityHeaders(response);
              }
              
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              
              return addSecurityHeaders(response);
            })
            .catch(() => {
              return caches.match(OFFLINE_URL).then(offline => 
                offline ? addSecurityHeaders(offline) : offline
              );
            });
        })
    );
    return;
  }

  // Handle static assets with enhanced security
  if (RUNTIME_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return addSecurityHeaders(cachedResponse);
          }
          
          return fetch(request)
            .then(response => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return addSecurityHeaders(response);
              }
              
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              
              return addSecurityHeaders(response);
            })
            .catch(() => {
              if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
                return new Response(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#999">صورة غير متاحة</text></svg>',
                  { 
                    headers: { 
                      'Content-Type': 'image/svg+xml',
                      ...SECURITY_HEADERS
                    } 
                  }
                );
              }
              return new Response('المحتوى غير متاح حالياً', { 
                status: 503,
                headers: { 
                  'Content-Type': 'text/plain; charset=utf-8',
                  ...SECURITY_HEADERS
                }
              });
            });
        })
    );
    return;
  }

  // Default: network first with security headers
  event.respondWith(
    fetch(request)
      .then(response => {
        // Don't cache authenticated responses
        if (!response.headers.get('Set-Cookie') && 
            !response.headers.get('Authorization')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return addSecurityHeaders(response);
      })
      .catch(() => {
        return caches.match(request).then(cached => 
          cached ? addSecurityHeaders(cached) : cached
        );
      })
  );
});

// Add security headers to responses
function addSecurityHeaders(response) {
  if (!response || response.type === 'opaque') {
    return response;
  }
  
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      ...SECURITY_HEADERS
    }
  });
  
  return newResponse;
}

// Enhanced background sync with security
self.addEventListener('sync', event => {
  if (event.tag === 'contact-form-sync') {
    event.waitUntil(syncContactForms());
  }
});

// Secure form sync function
async function syncContactForms() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const formRequests = requests.filter(req => 
      req.url.includes('/api/contact') && 
      req.method === 'POST' &&
      !req.url.includes('sensitive') // Additional security check
    );
    
    for (const request of formRequests) {
      try {
        await fetch(request);
        await cache.delete(request);
      } catch (error) {
        console.log('[SW] Failed to sync form securely:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Secure background sync failed:', error);
  }
}

// Enhanced push notification handler with validation
self.addEventListener('push', event => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    // Validate notification data for security
    if (!data.title || typeof data.title !== 'string' || data.title.length > 100) {
      console.warn('[SW] Invalid notification title');
      return;
    }
    
    const options = {
      body: (data.body && typeof data.body === 'string' && data.body.length <= 200) 
        ? data.body 
        : 'تحديث جديد متاح في تطبيق درب',
      icon: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
      badge: '/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png',
      vibrate: [100, 50, 100],
      tag: 'app-update',
      data: {
        dateOfArrival: Date.now(),
        primaryKey: (data.primaryKey && typeof data.primaryKey === 'number') ? data.primaryKey : 1,
        url: (data.url && typeof data.url === 'string' && data.url.startsWith('/')) ? data.url : '/'
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
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('[SW] Secure notification error:', error);
  }
});

// Secure notification click handler
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
    // Validate URL before opening
    const url = event.notification.data?.url || '/';
    if (typeof url === 'string' && (url.startsWith('/') || url.startsWith(self.location.origin))) {
      event.waitUntil(clients.openWindow(url));
    }
  }
});

// Security check on service worker installation
self.addEventListener('securitypolicyviolation', event => {
  console.warn('[SW] Security policy violation:', event.violatedDirective);
});
