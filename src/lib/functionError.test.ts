import { describe, it, expect } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { readFunctionError } from "./functionError";

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
