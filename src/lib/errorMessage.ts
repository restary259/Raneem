/**
 * Extract a human-readable message from an unknown error caught in a
 * try/catch. Handles `Error`, Supabase/PostgrestError-shaped objects
 * (`{ message: string }`), and falls back to `String(err)` so a plain object
 * never renders as `"[object Object]"` in a toast.
 *
 * Mirrors the `errMsg` helper in `useDebouncedDocumentSave` — keep the two in
 * sync (or better, route everything through this one).
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

export default errorMessage;
