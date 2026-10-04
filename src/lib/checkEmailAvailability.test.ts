/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let invokeResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let session: { access_token?: string } | null = { access_token: "token-1" };
let lastInvoke: { name: string; options: any } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
    },
    functions: {
      invoke: (name: string, options: unknown) => {
        lastInvoke = { name, options };
        return Promise.resolve(invokeResult);
      },
    },
  },
}));

import { checkEmailAvailability } from "./checkEmailAvailability";

beforeEach(() => {
  invokeResult = { data: null, error: null };
  session = { access_token: "token-1" };
  lastInvoke = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkEmailAvailability", () => {
  it("short-circuits half-typed addresses without calling the function", async () => {
    for (const bad of ["", "a", "a@b", "a@b.c", "  ", "no-at-sign.com"]) {
      await expect(checkEmailAvailability(bad)).resolves.toEqual({
        available: true,
        existing_role: null,
        deactivated: false,
      });
    }
    expect(lastInvoke).toBeNull();
  });

  it("rejects addresses longer than 255 characters without a call", async () => {
    const long = `${"a".repeat(250)}@example.com`;
    await expect(checkEmailAvailability(long)).resolves.toEqual({
      available: true,
      existing_role: null,
      deactivated: false,
    });
    expect(lastInvoke).toBeNull();
  });

  it("normalizes the email and forwards the session token", async () => {
    invokeResult = {
      data: { available: false, existing_role: "admin", deactivated: true },
      error: null,
    };
    const result = await checkEmailAvailability("  ADMIN@Example.COM ");

    expect(result).toEqual({
      available: false,
      existing_role: "admin",
      deactivated: true,
    });
    expect(lastInvoke?.name).toBe("check-email-availability");
    expect(lastInvoke?.options.body).toEqual({ email: "admin@example.com" });
    expect(lastInvoke?.options.headers.Authorization).toBe("Bearer token-1");
  });

  it("coerces a partial payload into the documented shape", async () => {
    invokeResult = { data: { available: 1 }, error: null };
    await expect(checkEmailAvailability("a@b.co")).resolves.toEqual({
      available: true,
      existing_role: null,
      deactivated: false,
    });
  });

  it("throws the function error so callers can fall back permissively", async () => {
    invokeResult = { data: null, error: { message: "forbidden" } };
    await expect(checkEmailAvailability("a@b.co")).rejects.toEqual({
      message: "forbidden",
    });
  });

  it("throws a generic error when the function returns no data and no error", async () => {
    invokeResult = { data: null, error: null };
    await expect(checkEmailAvailability("a@b.co")).rejects.toThrow(
      "email-availability check failed",
    );
  });

  it("sends an undefined bearer when there is no session", async () => {
    session = null;
    invokeResult = { data: { available: true }, error: null };
    await checkEmailAvailability("a@b.co");
    expect(lastInvoke?.options.headers.Authorization).toBe("Bearer undefined");
  });
});
