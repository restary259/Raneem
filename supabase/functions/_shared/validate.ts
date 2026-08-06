import { z } from "https://esm.sh/zod@3.23.8";

export { z };

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Parses and validates a JSON request body against a schema.
 * Rejects malformed JSON and any payload that does not match the schema
 * before the handler touches the database.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join(".") ?? "body";
    return { ok: false, error: `${path}: ${first?.message ?? "invalid value"}` };
  }
  return { ok: true, data: parsed.data };
}

// Common field shapes reused across functions.
export const uuid = z.string().uuid();
export const email = z.string().trim().email().max(255);
export const personName = z.string().trim().min(2).max(100);
export const phone = z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/);
export const shortText = z.string().trim().max(200);
export const longText = z.string().trim().max(2000);
