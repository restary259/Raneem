import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * `supabase.functions.invoke` collapses every non-2xx response into the opaque
 * message "Edge Function returned a non-2xx status code". The real reason lives
 * in the response body, which is only reachable through `error.context`.
 *
 * This reads that body and returns the server's own message so the user sees
 * "This case is not assigned to you" instead of a meaningless function error.
 */
export async function readFunctionError(error: unknown): Promise<string> {
  const body = await readErrorBody(error);
  if (body) {
    const message = body.parsed?.error ?? body.parsed?.message;
    if (message) return message;
    // Non-JSON body: surface it verbatim (truncated) so the user sees the
    // raw upstream text rather than a meaningless function-error string.
    if (!body.parsed) return String(body.raw).slice(0, 300);
  }
  if (error instanceof FunctionsHttpError) {
    return `${error.message} (${error.context?.status ?? "?"})`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Reads and parses the JSON body of a function error. Returns the parsed
 * object (including structured fields like `code` / `existing_role`) so callers
 * can route on conflict codes, or null when the body is absent or not JSON.
 */
export async function readFunctionErrorBody(
  error: unknown,
): Promise<Record<string, unknown> | null> {
  const body = await readErrorBody(error);
  return body?.parsed ?? null;
}

async function readErrorBody(
  error: unknown,
): Promise<{ raw: string; parsed: Record<string, unknown> | null } | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const raw = await error.context.text();
    if (!raw) return null;
    try {
      return { raw, parsed: JSON.parse(raw) as Record<string, unknown> };
    } catch {
      return { raw, parsed: null };
    }
  } catch {
    return null;
  }
}
