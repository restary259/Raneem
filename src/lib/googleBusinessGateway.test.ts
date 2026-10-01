import { describe, expect, it, vi } from "vitest";
import { GbpError, gbpGet, mapGbpError } from "./googleBusinessGateway";

const creds = { lovableKey: "l", connectionKey: "c" };
const noSleep = () => Promise.resolve();
const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

describe("mapGbpError", () => {
  it("maps statuses and extracts Google message", () => {
    const e = mapGbpError(403, JSON.stringify({ error: { message: "API not enabled" } }));
    expect(e.code).toBe("forbidden");
    expect(e.message).toBe("API not enabled");
    expect(mapGbpError(401, "x").code).toBe("unauthorized");
    expect(mapGbpError(429, "x").code).toBe("rate_limited");
    expect(mapGbpError(500, "x").code).toBe("upstream");
  });
});

describe("gbpGet", () => {
  it("sends both gateway headers", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: 1 }));
    await gbpGet("/a", creds, f, noSleep);
    expect(f.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer l", "X-Connection-Api-Key": "c" });
  });
  it("does not retry 4xx", async () => {
    const f = vi.fn().mockResolvedValue(res(403, "no"));
    await expect(gbpGet("/a", creds, f, noSleep)).rejects.toBeInstanceOf(GbpError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries 429/5xx at most 3 times", async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(res(503, "busy")));
    await expect(gbpGet("/a", creds, f, noSleep)).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("recovers after a 429 with Retry-After", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const f = vi.fn().mockResolvedValueOnce(res(429, "slow", { "retry-after": "2" })).mockResolvedValueOnce(res(200, { v: 1 }));
    await expect(gbpGet("/a", creds, f, sleep)).resolves.toEqual({ v: 1 });
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
