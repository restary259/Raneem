import { describe, expect, it, vi } from "vitest";
import { assertGoogleWriteAllowed } from "./googleBusinessWriteGate";

/**
 * Phase 10 regression: every Google write path calls this BEFORE any gateway
 * mutation. If the authorizer (or a future refactor) silently stops enforcing,
 * the write pre-flight must fail closed rather than let Google be mutated
 * behind a VIEW-only read.
 */

const OFFICE = "aaaaaaaa-0000-0000-0000-000000000001";
const USER = "22222222-2222-2222-2222-222222222222";

function ctxReturning(
  data: unknown,
  error: { message?: string } | null = null,
) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { ctx: { supabase: { rpc }, userId: USER }, rpc };
}

describe("assertGoogleWriteAllowed", () => {
  it("asks the authorizer for the exact office, actor and action", async () => {
    const { ctx, rpc } = ctxReturning(true);
    await assertGoogleWriteAllowed(ctx, OFFICE, "GOOGLE_REPLY_REVIEW");
    expect(rpc).toHaveBeenCalledWith("authorize_google_office_action", {
      p_user_id: USER,
      p_office_id: OFFICE,
      p_action: "GOOGLE_REPLY_REVIEW",
    });
  });

  it("resolves when the authorizer returns true", async () => {
    const { ctx } = ctxReturning(true);
    await expect(
      assertGoogleWriteAllowed(ctx, OFFICE, "GOOGLE_MANAGE_MEDIA"),
    ).resolves.toBeUndefined();
  });

  it("fails closed when the authorizer returns false", async () => {
    const { ctx } = ctxReturning(false);
    await expect(
      assertGoogleWriteAllowed(ctx, OFFICE, "GOOGLE_MANAGE_POSTS"),
    ).rejects.toThrow("Forbidden");
  });

  it("fails closed on a null result", async () => {
    const { ctx } = ctxReturning(null);
    await expect(
      assertGoogleWriteAllowed(ctx, OFFICE, "GOOGLE_UPDATE_PROFILE"),
    ).rejects.toThrow("Forbidden");
  });

  it("surfaces the RPC error rather than swallowing it", async () => {
    const { ctx } = ctxReturning(null, { message: "permission denied" });
    await expect(
      assertGoogleWriteAllowed(ctx, OFFICE, "GOOGLE_MANAGE_MEDIA"),
    ).rejects.toThrow("permission denied");
  });
});
