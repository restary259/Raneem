import { describe, it, expect } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { readFunctionError, readFunctionErrorBody } from "./functionError";

function httpError(body: string, status = 403): FunctionsHttpError {
  return new FunctionsHttpError(new Response(body, { status }));
}

describe("readFunctionError", () => {
  it("prefers the server's own message from the response body", async () => {
    const message = await readFunctionError(httpError(JSON.stringify({ error: "This case is not assigned to you" })));
    expect(message).toBe("This case is not assigned to you");
  });

  it("falls back to the body's message field", async () => {
    const message = await readFunctionError(httpError(JSON.stringify({ message: "Case is locked" })));
    expect(message).toBe("Case is locked");
  });

  it("returns a non-JSON body verbatim", async () => {
    const message = await readFunctionError(httpError("upstream timeout"));
    expect(message).toBe("upstream timeout");
  });

  it("truncates a long non-JSON body", async () => {
    const message = await readFunctionError(httpError("x".repeat(500)));
    expect(message).toHaveLength(300);
  });

  it("appends the status when the body carries no message", async () => {
    const message = await readFunctionError(httpError(JSON.stringify({ detail: "nope" }), 409));
    expect(message).toContain("(409)");
  });

  it("passes through plain errors and unknown values", async () => {
    expect(await readFunctionError(new Error("boom"))).toBe("boom");
    expect(await readFunctionError("just a string")).toBe("just a string");
    expect(await readFunctionError(null)).toBe("null");
  });
});

describe("readFunctionErrorBody", () => {
  it("returns the parsed body so callers can route on structured codes", async () => {
    const body = await readFunctionErrorBody(
      httpError(
        JSON.stringify({
          error: "This email already belongs to another account.",
          code: "identity_conflict",
          existing_role: "social_media_partner",
          deactivated: false,
        }),
        409,
      ),
    );
    expect(body?.code).toBe("identity_conflict");
    expect(body?.existing_role).toBe("social_media_partner");
    expect(body?.deactivated).toBe(false);
  });

  it("returns null for a non-JSON body", async () => {
    expect(await readFunctionErrorBody(httpError("upstream timeout"))).toBeNull();
  });

  it("returns null for a non-http error", async () => {
    expect(await readFunctionErrorBody(new Error("boom"))).toBeNull();
    expect(await readFunctionErrorBody(null)).toBeNull();
  });
});
