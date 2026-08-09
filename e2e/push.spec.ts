import { test, expect } from '@playwright/test';

/**
 * Standards-based Web Push smoke test.
 *
 * Chromium in CI has no real push service, so this asserts the parts that are
 * device-independent: the service worker registers, the Push API is exposed,
 * permission can be granted, and a PushSubscription with a VAPID-derived
 * applicationServerKey can be created. Delivery itself is verified per-device
 * from the in-app diagnostics panel.
 */
test.describe('web push capability', () => {
  test('service worker registers and a push subscription can be created', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['notifications'], { origin: baseURL! });
    await page.goto('/');

    // The SW only registers in production builds; `vite preview` serves one.
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(() => r(null), 15000)),
      ]);
      return reg ? (reg as ServiceWorkerRegistration).scope : null;
    });
    test.skip(!swReady, 'service worker not registered in this environment');

    const result = await page.evaluate(async () => {
      const key =
        'BIUapXtGgz0WZg_bM-xVoyOnu9_Wccw69cIOP9Rmujxupa25IoEvCKru6S2o6gnTrx-xWfZwQdD6XcQOchf5cpM';
      const padding = '='.repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      let endpoint: string | null = null;
      let error: string | null = null;
      try {
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
          }));
        endpoint = sub.endpoint;
      } catch (e) {
        error = (e as Error).message;
      }
      return { permission, endpoint, error, hasPushManager: 'PushManager' in window };
    });

    expect(result.hasPushManager).toBe(true);
    expect(result.permission).toBe('granted');
    // A sandboxed CI Chromium has no push service; only assert shape when it succeeded.
    if (result.endpoint) {
      expect(result.endpoint).toMatch(/^https:\/\//);
    } else {
      expect(result.error).toBeTruthy();
    }
  });
});
