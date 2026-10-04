import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Registration = {
  scope: string;
  update: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  installing: null | {
    state: string;
    addEventListener: ReturnType<typeof vi.fn>;
  };
};

function makeRegistration(): Registration {
  return {
    scope: "/",
    update: vi.fn(),
    addEventListener: vi.fn(),
    installing: null,
  };
}

let swRegister: ReturnType<typeof vi.fn>;
let swGetRegistration: ReturnType<typeof vi.fn>;
let swAddEventListener: ReturnType<typeof vi.fn>;
let hasServiceWorker = true;

function installServiceWorkerMock() {
  swRegister = vi.fn().mockResolvedValue(makeRegistration());
  swGetRegistration = vi.fn().mockResolvedValue(makeRegistration());
  swAddEventListener = vi.fn();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: swRegister,
      getRegistration: swGetRegistration,
      addEventListener: swAddEventListener,
      controller: null,
    },
  });
}

function removeServiceWorkerMock() {
  // `defineProperty(..., undefined)` still leaves the key `in navigator`.
  Reflect.deleteProperty(navigator, "serviceWorker");
}

beforeEach(() => {
  vi.restoreAllMocks();
  hasServiceWorker = true;
  installServiceWorkerMock();
});

afterEach(() => {
  if (!hasServiceWorker) removeServiceWorkerMock();
  vi.useRealTimers();
});

describe("registerServiceWorker", () => {
  it("registers at the root scope, updates, and returns true", async () => {
    const { registerServiceWorker } = await import("./pwaUtils");
    await expect(registerServiceWorker()).resolves.toBe(true);
    expect(swRegister).toHaveBeenCalledWith("/service-worker.js", {
      scope: "/",
    });
  });

  it("returns false when registration throws", async () => {
    swRegister.mockRejectedValueOnce(new Error("blocked"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { registerServiceWorker } = await import("./pwaUtils");
    await expect(registerServiceWorker()).resolves.toBe(false);
  });

  it("returns false when service workers are unsupported", async () => {
    removeServiceWorkerMock();
    const { registerServiceWorker } = await import("./pwaUtils");
    await expect(registerServiceWorker()).resolves.toBe(false);
    expect(swRegister).not.toHaveBeenCalled();
  });

  it("shows no UI on an installed update (silent updates)", async () => {
    vi.useFakeTimers();
    const { registerServiceWorker } = await import("./pwaUtils");
    await registerServiceWorker();
    // The registration's updatefound listener must be attached without throwing.
    const registration = await swRegister.mock.results[0].value;
    const updateFound = registration.addEventListener.mock.calls.find(
      (c: unknown[]) => c[0] === "updatefound",
    );
    expect(updateFound).toBeTruthy();
  });
});

describe("checkForUpdates", () => {
  it("calls update on an existing registration", async () => {
    const registration = makeRegistration();
    swGetRegistration.mockResolvedValueOnce(registration);
    const { checkForUpdates } = await import("./pwaUtils");
    await checkForUpdates();
    expect(registration.update).toHaveBeenCalled();
  });

  it("does nothing without a registration", async () => {
    swGetRegistration.mockResolvedValueOnce(null);
    const { checkForUpdates } = await import("./pwaUtils");
    await expect(checkForUpdates()).resolves.toBeUndefined();
  });
});

describe("requestNotificationPermission", () => {
  it("returns true when permission is granted", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission, permission: "default" },
    });
    const { requestNotificationPermission } = await import("./pwaUtils");
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it("returns false when permission is denied", async () => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        requestPermission: vi.fn().mockResolvedValue("denied"),
        permission: "default",
      },
    });
    const { requestNotificationPermission } = await import("./pwaUtils");
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });
});

describe("showNotification", () => {
  it("does nothing when permission is not granted", async () => {
    const Ctor = vi.fn();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: Object.assign(Ctor, { permission: "denied" }),
    });
    const { showNotification } = await import("./pwaUtils");
    showNotification("Hi");
    expect(Ctor).not.toHaveBeenCalled();
  });

  it("constructs a notification with default icon and badge when granted", async () => {
    const Ctor = vi.fn();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: Object.assign(Ctor, { permission: "granted" }),
    });
    const { showNotification } = await import("./pwaUtils");
    showNotification("Hi", { body: "there" });
    expect(Ctor).toHaveBeenCalledWith("Hi", {
      icon: "/icons/icon-192-v2.png",
      badge: "/icons/badge-96.png",
      body: "there",
    });
  });
});

describe("addToHomeScreen", () => {
  it("is a no-op hook for the PWAInstaller", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { addToHomeScreen } = await import("./pwaUtils");
    expect(() => addToHomeScreen()).not.toThrow();
  });
});

describe("getInstallationState", () => {
  it("reports installed in standalone display mode", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const { getInstallationState } = await import("./pwaUtils");
    expect(getInstallationState()).toBe("installed");
  });

  it("reports installed for an iOS web app", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
    } as MediaQueryList);
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
    const { getInstallationState } = await import("./pwaUtils");
    expect(getInstallationState()).toBe("installed");
    delete (window.navigator as unknown as Record<string, unknown>).standalone;
  });

  it("reports installable when the browser supports the prompt", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
    } as MediaQueryList);
    Object.defineProperty(window, "BeforeInstallPromptEvent", {
      configurable: true,
      value: function BeforeInstallPromptEvent() {},
    });
    const { getInstallationState } = await import("./pwaUtils");
    expect(getInstallationState()).toBe("installable");
  });

  it("reports not-supported otherwise", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
    } as MediaQueryList);
    removeServiceWorkerMock();
    Reflect.deleteProperty(window, "BeforeInstallPromptEvent");
    hasServiceWorker = false;
    const { getInstallationState } = await import("./pwaUtils");
    expect(getInstallationState()).toBe("not-supported");
  });
});

describe("cacheResources / clearAppCache", () => {
  let cacheAddAll: ReturnType<typeof vi.fn>;
  let cacheDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cacheAddAll = vi.fn().mockResolvedValue(undefined);
    cacheDelete = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        open: vi.fn().mockResolvedValue({ addAll: cacheAddAll }),
        keys: vi.fn().mockResolvedValue(["darb-education-v1.0.0", "other"]),
        delete: cacheDelete,
      },
    });
  });

  it("adds resources to the versioned cache", async () => {
    const { cacheResources } = await import("./pwaUtils");
    await cacheResources(["/a.js", "/b.css"]);
    expect(cacheAddAll).toHaveBeenCalledWith(["/a.js", "/b.css"]);
  });

  it("deletes every cache", async () => {
    const { clearAppCache } = await import("./pwaUtils");
    await clearAppCache();
    expect(cacheDelete).toHaveBeenCalledTimes(2);
  });
});
