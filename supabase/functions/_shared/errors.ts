/**
 * Shared error helpers for edge functions.
 *
 * M1 (raw DB error leakage): catch blocks used to return `err.message` directly
 * to the client, which can expose internal schema/column names and SQL text.
 * These helpers log the full error server-side (for debugging) and return a
 * generic message to the caller.
 */

/** Log the real error server-side and return a generic client-safe message. */
export function serverError(err: unknown, fallback = "Server error"): string {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error("[edge-function] error:", msg, err);
  return fallback;
}

/** Build a 500 Response with a generic error body. */
export function serverErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
  fallback = "Server error",
): Response {
  return new Response(JSON.stringify({ error: serverError(err, fallback) }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
