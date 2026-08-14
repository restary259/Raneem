import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  },
}));

import {
  SITE_URL,
  buildReferralUrl,
  captureReferralCode,
  clearReferralCode,
  getReferralCode,
  shouldKeepReferralCode,
  verifyReferralCode,
} from "./referral";

const STORAGE_KEY = "darb_ref";

/** Seed a stored code without going through the click-tracking path. */
function storeRef(code: string, savedAt = Date.now()): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt }));
}

beforeEach(() => {
  window.localStorage.clear();
  rpcCalls.length = 0;
  rpcResult = { data: null, error: null };
});

describe("captureReferralCode", () => {
  it("stores a code from the query string and records the click", async () => {
    expect(captureReferralCode("?ref=partner-42")).toBe("partner-42");
    expect(getReferralCode()).toBe("partner-42");

    await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0].fn).toBe("record_partner_click");
    expect(rpcCalls[0].args.p_code).toBe("partner-42");
  });

  it("keeps the previously stored code when the URL carries none", async () => {
    captureReferralCode("?ref=partner-42");
    expect(captureReferralCode("?utm_source=ig")).toBe("partner-42");
    // Flush the fire-and-forget click so it cannot leak into the next test.
    await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
  });

  it("ignores codes that are not plain alphanumeric tokens", () => {
    expect(captureReferralCode("?ref=<script>")).toBeNull();
    expect(captureReferralCode("?ref=ab")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reuses one session id across clicks so repeat visits de-duplicate", async () => {
    captureReferralCode("?ref=partner-42");
    await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
    captureReferralCode("?ref=partner-43");
    await vi.waitFor(() => expect(rpcCalls).toHaveLength(2));
    expect(rpcCalls[0].args.p_session_id).toBe(rpcCalls[1].args.p_session_id);
  });
});

describe("getReferralCode", () => {
  it("drops a code older than the 90 day window", () => {
    storeRef("partner-42", Date.now() - 91 * 86_400_000);
    expect(getReferralCode()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps a code inside the window", () => {
    storeRef("partner-42", Date.now() - 89 * 86_400_000);
    expect(getReferralCode()).toBe("partner-42");
  });

  it("returns null for absent or corrupt storage", () => {
    expect(getReferralCode()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, "not json");
    expect(getReferralCode()).toBeNull();
  });
});

describe("clearReferralCode", () => {
  it("removes the stored code", () => {
    storeRef("partner-42");
    clearReferralCode();
    expect(getReferralCode()).toBeNull();
  });
});

describe("verifyReferralCode", () => {
  it("returns the owner name for a healthy code", async () => {
    rpcResult = { data: [{ valid: true, owner_name: "Sami" }], error: null };
    expect(await verifyReferralCode("partner-42")).toEqual({ valid: true, ownerName: "Sami" });
  });

  it("forgets a code the server rejects", async () => {
    storeRef("partner-42");
    rpcResult = { data: { valid: false }, error: null };
    expect(await verifyReferralCode("partner-42")).toEqual({ valid: false, ownerName: null });
    expect(getReferralCode()).toBeNull();
  });

  it("keeps an unverified code when the lookup fails", async () => {
    storeRef("partner-42");
    rpcResult = { data: null, error: { message: "network down" } };
    const health = await verifyReferralCode("partner-42");
    expect(health.valid).toBe(false);
    expect(health.unverified).toBe(true);
    // The stored code MUST survive a network failure so the apply form can
    // still submit it (the server resolves it again).
    expect(getReferralCode()).toBe("partner-42");
  });

  it("does NOT mark a rejected code as unverified", async () => {
    storeRef("partner-42");
    rpcResult = { data: { valid: false }, error: null };
    const health = await verifyReferralCode("partner-42");
    expect(health.valid).toBe(false);
    expect(health.unverified).toBeUndefined();
    // A server-confirmed rejection deletes the stored code.
    expect(getReferralCode()).toBeNull();
  });

  it("short-circuits when there is no code", async () => {
    expect(await verifyReferralCode(null)).toEqual({ valid: false, ownerName: null });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("shouldKeepReferralCode", () => {
  // Regression guard: a transient lookup failure must never strip a partner's
  // attribution from the case. If the apply form drops the code on a network
  // blip, the case is created with partner_id = NULL — visible to Admin but
  // invisible to the partner dashboard / KPI (the reported bug).
  it("keeps a valid code", () => {
    expect(shouldKeepReferralCode({ valid: true, ownerName: "Sami" })).toBe(true);
  });

  it("keeps an unverified (network-error) code so the server can resolve it", () => {
    expect(shouldKeepReferralCode({ valid: false, ownerName: null, unverified: true })).toBe(true);
  });

  it("drops a server-confirmed rejection", () => {
    expect(shouldKeepReferralCode({ valid: false, ownerName: null })).toBe(false);
  });

  it("drops a null-code short-circuit result", () => {
    expect(shouldKeepReferralCode({ valid: false, ownerName: null })).toBe(false);
  });
});

describe("buildReferralUrl", () => {
  it("always builds from the canonical site address", () => {
    expect(buildReferralUrl("partner-42")).toBe(`${SITE_URL}/apply?ref=partner-42`);
    expect(buildReferralUrl("a b&c")).toBe(`${SITE_URL}/apply?ref=a%20b%26c`);
  });
});
