// PWA utility functions
export const registerServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      // Check for updates immediately
      registration.update();

      // Check for updates every 30 minutes
      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available - show update notification
              showUpdateNotification();
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('[PWA] Service Worker updated:', event.data.message);
          // You can show a toast notification here if desired
        }
      });

      console.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }
  return false;
};

const showUpdateNotification = () => {
  // Create a subtle update notification
  const updateBanner = document.createElement('div');
  updateBanner.innerHTML = `
    <div style="
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: #F28C28;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: 'Noto Sans Arabic', sans-serif;
      direction: rtl;
      cursor: pointer;
      transition: opacity 0.3s ease;
    " onclick="window.location.reload()">
      🔄 تحديث جديد متاح - اضغط للتحديث
    </div>
  `;
  
  document.body.appendChild(updateBanner);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    updateBanner.style.opacity = '0';
    setTimeout(() => {
      if (updateBanner.parentNode) {
        updateBanner.parentNode.removeChild(updateBanner);
      }
    }, 300);
  }, 5000);
};

export const checkForUpdates = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      registration.update();
    }
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      ...options
    });
  }
};

export const addToHomeScreen = () => {
  // This will be handled by the PWAInstaller component
  console.log('Add to home screen prompt will be shown');
};

export const getInstallationState = (): 'installed' | 'installable' | 'not-supported' => {
  // Check if app is running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebApp = (window.navigator as any).standalone === true;
  
  if (isStandalone || isInWebApp) {
    return 'installed';
  }
  
  // Check if installation is supported
  if ('serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window) {
    return 'installable';
  }
  
  return 'not-supported';
};

export const cacheResources = async (resources: string[]): Promise<void> => {
  if ('caches' in window) {
    const cache = await caches.open('darb-education-v1.0.0');
    await cache.addAll(resources);
  }
};

export const clearAppCache = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  }
};
