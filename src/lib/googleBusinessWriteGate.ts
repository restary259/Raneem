/**
 * Phase 10 — pre-flight kill-switch gate for every Google *write*.
 *
 * The lifecycle RPCs already enforce `authorize_google_office_action`, but the
 * internal resolver a write uses to locate its resource is gated only on
 * `GOOGLE_VIEW` (a cached read that must survive a pause). Calling Google first
 * and rejecting at the persistence RPC would let a paused integration still
 * mutate Google, leaving Google changed with no DARB cache/audit — and would
 * make the emergency write switch ineffective.
 *
 * Every write path asks the authorizer for its operation-specific WRITE action
 * BEFORE any gateway mutation, so a paused integration stops live writes with
 * zero Google mutations. The action is classified server-side
 * (`google_business_action_kind`), so it always maps to the WRITE switch.
 */

export type GoogleWriteGateCtx = {
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  userId: string;
};

export async function assertGoogleWriteAllowed(
  ctx: GoogleWriteGateCtx,
  officeId: string,
  action: string,
): Promise<void> {
  const { data, error } = await ctx.supabase.rpc(
    "authorize_google_office_action",
    { p_user_id: ctx.userId, p_office_id: officeId, p_action: action },
  );
  if (error) throw new Error(error.message || "Request failed");
  if (!data) throw new Error("Forbidden");
}
