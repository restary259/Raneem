
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
          showUpdateAvailableToast();
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
  // Create a prominent update notification
  const updateBanner = document.createElement('div');
  updateBanner.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #F28C28 0%, #FF6B35 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10001;
      font-family: 'Noto Sans Arabic', sans-serif;
      direction: rtl;
      text-align: center;
      max-width: 320px;
      width: 90vw;
    ">
      <div style="font-size: 24px; margin-bottom: 10px;">🚀</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">تحديث جديد متاح!</div>
      <div style="font-size: 14px; margin-bottom: 20px; opacity: 0.9;">إصدار محسن مع ميزات جديدة</div>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #F28C28;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        margin-right: 8px;
        transition: all 0.3s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        تحديث الآن
      </button>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        لاحقاً
      </button>
    </div>
  `;
  
  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(updateBanner);
  
  // Auto-hide after 10 seconds if no action
  setTimeout(() => {
    if (updateBanner.parentNode) {
      updateBanner.style.opacity = '0';
      backdrop.style.opacity = '0';
      setTimeout(() => {
        if (updateBanner.parentNode) updateBanner.parentNode.removeChild(updateBanner);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, 300);
    }
  }, 10000);
};

const showUpdateAvailableToast = () => {
  // Create a smaller toast notification for subsequent updates
  const toast = document.createElement('div');
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #F28C28;
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: 'Noto Sans Arabic', sans-serif;
      direction: rtl;
      cursor: pointer;
      transition: all 0.3s ease;
      max-width: 280px;
      animation: slideIn 0.3s ease-out;
    " onclick="window.location.reload()">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">🔄</span>
        <div>
          <div style="font-weight: bold; font-size: 14px;">تحديث جاهز</div>
          <div style="font-size: 12px; opacity: 0.9;">اضغط للتحديث</div>
        </div>
      </div>
    </div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(toast);
  
  // Auto-hide after 7 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 7000);
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
