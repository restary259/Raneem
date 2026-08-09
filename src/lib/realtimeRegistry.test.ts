import { describe, it, expect, vi, beforeEach } from "vitest";

const channels: any[] = [];
const removed: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (topic: string) => {
      const handlers: Array<() => void> = [];
      const ch: any = {
        topic,
        handlers,
        on: (_e: string, _f: unknown, cb: () => void) => {
          handlers.push(cb);
          return ch;
        },
        subscribe: () => ch,
      };
      channels.push(ch);
      return ch;
    },
    removeChannel: (ch: unknown) => {
      removed.push(ch);
    },
  },
}));

const { subscribeTables, openChannelCount } = await import("@/lib/realtimeRegistry");

describe("realtimeRegistry", () => {
  beforeEach(() => {
    channels.length = 0;
    removed.length = 0;
  });

  it("opens a single channel for multiple subscribers of the same topic", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeTables("leads-realtime", ["leads"], a);
    const offB = subscribeTables("leads-realtime", ["leads"], b);

    expect(channels).toHaveLength(1);

    channels[0].handlers[0]();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    offB();
  });

  it("keeps the channel alive until the last subscriber unsubscribes", () => {
    const offA = subscribeTables("cases-realtime", ["cases"], vi.fn());
    const offB = subscribeTables("cases-realtime", ["cases"], vi.fn());

    offA();
    expect(removed).toHaveLength(0);

    offB();
    expect(removed).toHaveLength(1);
    expect(openChannelCount()).toBe(0);
  });

  it("registers a handler per table on one shared channel", () => {
    const off = subscribeTables("inbox", ["case_messages", "direct_messages"], vi.fn());
    expect(channels).toHaveLength(1);
    expect(channels[0].handlers).toHaveLength(2);
    off();
  });

  it("does not let one failing listener break the others", () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const off1 = subscribeTables("mixed", ["leads"], bad);
    const off2 = subscribeTables("mixed", ["leads"], good);

    expect(() => channels[0].handlers[0]()).not.toThrow();
    expect(good).toHaveBeenCalled();

    off1();
    off2();
  });
});
