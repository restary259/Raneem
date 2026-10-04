import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `error-capture` has import-time side effects: it wraps `console.error` and
 * registers global error listeners. Each test re-imports a fresh instance and
 * swaps `console.error` for a spy so the wrapper has a quiet inner target.
 */
const realConsoleError = console.error.bind(console);

describe("error-capture", () => {
  let mod: typeof import("./error-capture");
  let inner: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    inner = vi.fn();
    console.error = inner as unknown as typeof console.error;
    mod = await import("./error-capture");
  });

  afterAll(() => {
    console.error = realConsoleError;
  });

  describe("describeError", () => {
    it("keeps the message and stack of a real Error", () => {
      const out = mod.describeError(new Error("boom"));
      expect(out).toContain("boom");
    });

    it("appends a numeric status when present", () => {
      const withStatus = Object.assign(new Error("nope"), { status: 503 });
      expect(mod.describeError(withStatus)).toContain("(status 503)");

      const withStatusCode = Object.assign(new Error("nope"), {
        statusCode: 404,
      });
      expect(mod.describeError(withStatusCode)).toContain("(status 404)");
    });

    it("walks the cause chain with a depth limit", () => {
      const root = new Error("root");
      let current: Error = root;
      for (let i = 1; i <= 6; i++) {
        const next = new Error(`level ${i}`);
        (current as Error & { cause?: unknown }).cause = next;
        current = next;
      }
      const out = mod.describeError(root);
      expect(out).toContain("root");
      // Five levels total => four "caused by:" labels, never the sixth.
      expect(out.match(/caused by:/g) ?? []).toHaveLength(4);
      expect(out).not.toContain("level 6");
    });

    it("handles non-Error values and circular objects", () => {
      expect(mod.describeError("plain text")).toBe("plain text");
      expect(mod.describeError({ code: "23505" })).toBe('{"code":"23505"}');
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(mod.describeError(circular)).toBe("[object Object]");
      expect(mod.describeError(null)).toBe("");
    });

    it("truncates very long descriptions", () => {
      const big = new Error("x".repeat(9000));
      const out = mod.describeError(big);
      expect(out.length).toBe(8000);
    });
  });

  describe("console.error interception", () => {
    it("expands Error args and records the original", () => {
      const err = new Error("captured");
      console.error(err);

      const forwarded = inner.mock.calls[0][0];
      expect(typeof forwarded).toBe("string");
      expect(forwarded).toContain("captured");
      expect(mod.consumeLastCapturedError()).toBe(err);
    });

    it("passes non-Error args through untouched and records nothing", () => {
      console.error("plain", 42);
      expect(inner).toHaveBeenCalledWith("plain", 42);
      expect(mod.consumeLastCapturedError()).toBeUndefined();
    });

    it("consumes the captured error only once", () => {
      const err = new Error("once");
      console.error(err);
      expect(mod.consumeLastCapturedError()).toBe(err);
      expect(mod.consumeLastCapturedError()).toBeUndefined();
    });

    it("expires a captured error after the 5s TTL", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      console.error(new Error("stale"));

      vi.setSystemTime(new Date("2026-01-01T00:00:06.000Z"));
      expect(mod.consumeLastCapturedError()).toBeUndefined();
      vi.useRealTimers();
    });

    it("records errors from a global error event", () => {
      const err = new Error("window error");
      const event = new Event("error") as Event & { error?: unknown };
      event.error = err;
      globalThis.dispatchEvent(event);
      expect(mod.consumeLastCapturedError()).toBe(err);
    });

    it("records the reason from an unhandled rejection event", () => {
      const reason = new Error("rejected");
      const event = new Event("unhandledrejection") as Event & {
        reason?: unknown;
      };
      event.reason = reason;
      globalThis.dispatchEvent(event);
      expect(mod.consumeLastCapturedError()).toBe(reason);
    });
  });
});
