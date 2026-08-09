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
  if (error instanceof FunctionsHttpError) {
    try {
      const raw = await error.context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { error?: string; message?: string };
          const message = parsed.error ?? parsed.message;
          if (message) return message;
        } catch {
          return raw.slice(0, 300);
        }
      }
    } catch {
      /* body already consumed or unreadable — fall through */
    }
    return `${error.message} (${error.context?.status ?? "?"})`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
