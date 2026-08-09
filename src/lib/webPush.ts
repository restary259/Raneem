import { supabase } from "@/integrations/supabase/client";

/**
 * Browser-side Web Push integration.
 *
 * iOS only exposes the Push API when the site is installed to the home screen
 * (standalone display mode), so every entry point here reports *why* push is
 * unavailable instead of failing silently.
 */

// Public VAPID key — safe to ship to the browser by design.
export const VAPID_PUBLIC_KEY =
  "BIUapXtGgz0WZg_bM-xVoyOnu9_Wccw69cIOP9Rmujxupa25IoEvCKru6S2o6gnTrx-xWfZwQdD6XcQOchf5cpM";

export type PushCapability =
  | "supported"
  | "unsupported"
  | "requires_install"; // iOS Safari in a browser tab

export interface PushStatus {
  capability: PushCapability;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getPushCapability(): PushCapability {
  const hasApi =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApi) return "supported";
  // On iOS the APIs only appear once the PWA is installed.
  if (isIos() && !isStandalone()) return "requires_install";
  return "unsupported";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function describeDevice() {
  const ua = navigator.userAgent;
  const browser = /CriOS/.test(ua)
    ? "Chrome iOS"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Unknown";
  const platform = isIos() ? "iOS" : /Android/.test(ua) ? "Android" : "Desktop";
  return { platform, browser };
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
}

export async function getPushStatus(): Promise<PushStatus> {
  const capability = getPushCapability();
  if (capability !== "supported") {
    return { capability, permission: "unsupported", subscribed: false };
  }
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return {
    capability,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export interface SubscribeResult {
  ok: boolean;
  reason?: "unsupported" | "requires_install" | "denied" | "no_registration" | "failed";
  error?: string;
}

/** Ask for permission (must be called from a user gesture) and register the device. */
export async function subscribeToPush(userId: string): Promise<SubscribeResult> {
  const capability = getPushCapability();
  if (capability !== "supported") return { ok: false, reason: capability as SubscribeResult["reason"] };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const registration = await getRegistration();
  if (!registration) return { ok: false, reason: "no_registration" };

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const { error } = await supabase.functions.invoke("push-notify", {
      body: {
        action: "subscribe",
        user_id: userId,
        subscription: subscription.toJSON(),
        ...describeDevice(),
      },
    });
    if (error) throw error;

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "failed", error: (e as Error).message };
  }
}

/** Remove this device from the push list, both locally and on the server. */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;

    await supabase.functions.invoke("push-notify", {
      body: { action: "unsubscribe", user_id: userId, subscription: subscription.toJSON() },
    });
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/** Send a real push to the current user's own devices. */
export async function sendTestPush(): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke("push-notify", {
    body: { action: "test", url: "/notifications" },
  });
  if (error) return { ok: false, message: error.message };
  const result = data as { success?: boolean; sent?: number; reason?: string };
  return { ok: Boolean(result?.success), message: result?.reason };
}

/**
 * Re-register silently when the browser rotates an existing subscription.
 * Safe to call on every app load: it never prompts.
 */
export async function refreshPushSubscription(userId: string): Promise<void> {
  if (getPushCapability() !== "supported" || Notification.permission !== "granted") return;
  const registration = await getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.functions.invoke("push-notify", {
    body: {
      action: "subscribe",
      user_id: userId,
      subscription: subscription.toJSON(),
      ...describeDevice(),
    },
  });
}
