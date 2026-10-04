/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Sub = {
  endpoint: string;
  toJSON: () => Record<string, unknown>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

let registration: any;
let existingSubscription: Sub | null;
let subscribeResult: Sub;
let requestPermission: ReturnType<typeof vi.fn>;
let invokeResult: { data: unknown; error: { message: string } | null };
let invokeCalls: Array<{ name: string; options: any }>;
let pushRow: Record<string, unknown> | null;

function makeSub(endpoint = "https://push.example/abc"): Sub {
  return {
    endpoint,
    toJSON: () => ({ endpoint }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function installPushEnvironment() {
  subscribeResult = makeSub();
  registration = {
    scope: "/",
    active: { state: "activated" },
    pushManager: {
      getSubscription: () => Promise.resolve(existingSubscription),
      subscribe: vi.fn().mockResolvedValue(subscribeResult),
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: () => Promise.resolve(registration),
      get ready() {
        return Promise.resolve(registration);
      },
    },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { requestPermission, permission: "granted" },
  });
}

/** `Object.defineProperty(x, k, undefined)` still leaves `k in x` true. */
const disablePushManager = () => {
  Reflect.deleteProperty(window, "PushManager");
};

const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const setUserAgent = (ua: string) => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (name: string, options: any) => {
        invokeCalls.push({ name, options });
        return Promise.resolve(invokeResult);
      },
    },
    from: (table: string) => {
      if (table !== "push_subscriptions")
        throw new Error(`unexpected from(${table})`);
      const result = { data: pushRow, error: null };
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  },
}));

import {
  getPushCapability,
  getPushDiagnostics,
  getPushStatus,
  isStandalone,
  refreshPushSubscription,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  VAPID_PUBLIC_KEY,
} from "./webPush";

beforeEach(() => {
  existingSubscription = null;
  requestPermission = vi.fn().mockResolvedValue("granted");
  invokeResult = { data: null, error: null };
  invokeCalls = [];
  pushRow = null;
  installPushEnvironment();
  setUserAgent(DESKTOP_UA);
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: false,
  } as MediaQueryList);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VAPID_PUBLIC_KEY", () => {
  it("is a non-empty base64url key", () => {
    expect(VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  });
});

describe("isStandalone", () => {
  it("is true in standalone display mode", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    expect(isStandalone()).toBe(true);
  });

  it("is true for an iOS home-screen web app", () => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    expect(isStandalone()).toBe(true);
    delete (navigator as unknown as Record<string, unknown>).standalone;
  });
});

describe("getPushCapability", () => {
  it("is supported when the API surface is present", () => {
    expect(getPushCapability()).toBe("supported");
  });

  it("requires install on iOS in a browser tab", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari",
    });
    disablePushManager();
    expect(getPushCapability()).toBe("requires_install");
  });

  it("is unsupported on non-iOS without the API", () => {
    disablePushManager();
    expect(getPushCapability()).toBe("unsupported");
  });
});

describe("getPushStatus", () => {
  it("reports unsupported without querying the registration", async () => {
    disablePushManager();
    await expect(getPushStatus()).resolves.toEqual({
      capability: "unsupported",
      permission: "unsupported",
      subscribed: false,
    });
  });

  it("reports the permission and whether a subscription exists", async () => {
    existingSubscription = makeSub();
    await expect(getPushStatus()).resolves.toEqual({
      capability: "supported",
      permission: "granted",
      subscribed: true,
    });
  });

  it("reports not subscribed when there is no subscription", async () => {
    await expect(getPushStatus()).resolves.toMatchObject({ subscribed: false });
  });
});

describe("subscribeToPush", () => {
  it("creates a subscription and registers it with the server", async () => {
    const result = await subscribeToPush("u1");
    expect(result).toEqual({ ok: true });
    expect(invokeCalls[0].name).toBe("push-notify");
    expect(invokeCalls[0].options.body).toMatchObject({
      action: "subscribe",
      user_id: "u1",
      platform: "Desktop",
      browser: "Chrome",
    });
    const subscribe = registration.pushManager.subscribe;
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(subscribe.mock.calls[0][0].applicationServerKey).toBeInstanceOf(
      Uint8Array,
    );
  });

  it("reuses an existing subscription instead of creating one", async () => {
    existingSubscription = makeSub();
    await expect(subscribeToPush("u1")).resolves.toEqual({ ok: true });
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("fails with requires_install on an uninstalled iPhone", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari",
    });
    disablePushManager();
    await expect(subscribeToPush("u1")).resolves.toEqual({
      ok: false,
      reason: "requires_install",
    });
  });

  it("fails when the user denies permission", async () => {
    requestPermission.mockResolvedValueOnce("denied");
    await expect(subscribeToPush("u1")).resolves.toEqual({
      ok: false,
      reason: "denied",
    });
    expect(invokeCalls).toHaveLength(0);
  });

  it("fails when there is no service-worker registration", async () => {
    registration = null;
    await expect(subscribeToPush("u1")).resolves.toEqual({
      ok: false,
      reason: "no_registration",
    });
  });

  it("fails with the error message when the server rejects the registration", async () => {
    invokeResult = { data: null, error: { message: "server exploded" } };
    await expect(subscribeToPush("u1")).resolves.toEqual({
      ok: false,
      reason: "failed",
      error: "server exploded",
    });
  });
});

describe("unsubscribeFromPush", () => {
  it("returns true when there is no subscription to remove", async () => {
    await expect(unsubscribeFromPush("u1")).resolves.toBe(true);
    expect(invokeCalls).toHaveLength(0);
  });

  it("notifies the server and unsubscribes locally", async () => {
    existingSubscription = makeSub();
    await expect(unsubscribeFromPush("u1")).resolves.toBe(true);
    expect(invokeCalls[0].options.body).toMatchObject({
      action: "unsubscribe",
      user_id: "u1",
    });
    expect(existingSubscription.unsubscribe).toHaveBeenCalled();
  });

  it("returns false when an error is thrown", async () => {
    existingSubscription = makeSub();
    existingSubscription.unsubscribe.mockRejectedValueOnce(new Error("nope"));
    await expect(unsubscribeFromPush("u1")).resolves.toBe(false);
  });
});

describe("sendTestPush", () => {
  it("returns the success flag from the function response", async () => {
    invokeResult = { data: { success: true, sent: 2 }, error: null };
    await expect(sendTestPush()).resolves.toEqual({
      ok: true,
      message: undefined,
    });
    expect(invokeCalls[0].options.body).toEqual({
      action: "test",
      url: "/notifications",
    });
  });

  it("returns the reason when the push could not be sent", async () => {
    invokeResult = {
      data: { success: false, reason: "no_devices" },
      error: null,
    };
    await expect(sendTestPush()).resolves.toEqual({
      ok: false,
      message: "no_devices",
    });
  });

  it("returns the invoke error message", async () => {
    invokeResult = { data: null, error: { message: "boom" } };
    await expect(sendTestPush()).resolves.toEqual({
      ok: false,
      message: "boom",
    });
  });
});

describe("getPushDiagnostics", () => {
  it("collects service-worker and subscription details", async () => {
    existingSubscription = makeSub("https://push.example/xyz");
    pushRow = {
      active: true,
      last_success_at: "2026-01-01T00:00:00Z",
      last_error_status: null,
    };
    const d = await getPushDiagnostics();
    expect(d).toMatchObject({
      capability: "supported",
      permission: "granted",
      standalone: false,
      swScope: "/",
      swState: "activated",
      endpointHost: "push.example",
      platform: "Desktop",
      browser: "Chrome",
      storedActive: true,
      lastSuccessAt: "2026-01-01T00:00:00Z",
      lastErrorStatus: null,
    });
  });

  it("returns the base diagnostics when there is no subscription", async () => {
    const d = await getPushDiagnostics();
    expect(d.endpointHost).toBeNull();
    expect(d.storedActive).toBeNull();
  });

  it("returns unsupported diagnostics when push is unavailable", async () => {
    disablePushManager();
    const d = await getPushDiagnostics();
    expect(d.capability).toBe("unsupported");
    expect(d.permission).toBe("unsupported");
  });
});

describe("refreshPushSubscription", () => {
  it("re-registers a granted, existing subscription without prompting", async () => {
    existingSubscription = makeSub();
    await refreshPushSubscription("u1");
    expect(invokeCalls[0].options.body).toMatchObject({
      action: "subscribe",
      user_id: "u1",
    });
  });

  it("does nothing when permission is not granted", async () => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission, permission: "denied" },
    });
    await refreshPushSubscription("u1");
    expect(invokeCalls).toHaveLength(0);
  });

  it("does nothing when there is no subscription", async () => {
    await refreshPushSubscription("u1");
    expect(invokeCalls).toHaveLength(0);
  });
});
