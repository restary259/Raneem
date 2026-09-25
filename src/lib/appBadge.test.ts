import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateAppBadge, clearAppBadge } from "./appBadge";

describe("appBadge", () => {
  let calls: number[];

  beforeEach(() => {
    calls = [];
    document.title = "DARB";
    Object.assign(navigator, {
      setAppBadge: (n?: number) => {
        calls.push(n ?? -1);
        return Promise.resolve();
      },
      clearAppBadge: () => {
        calls.push(0);
        return Promise.resolve();
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null as never);
  });

  it("sets the OS badge and prefixes the tab title", () => {
    updateAppBadge(3);
    expect(calls).toEqual([3]);
    expect(document.title).toBe("(3) DARB");
  });

  it("caps the display at 99+", () => {
    updateAppBadge(140);
    expect(document.title).toBe("(99+) DARB");
  });

  it("clears the badge and restores the title", () => {
    updateAppBadge(2);
    clearAppBadge();
    expect(calls).toEqual([2, 0]);
    expect(document.title).toBe("DARB");
  });

  it("never stacks prefixes across updates", () => {
    updateAppBadge(1);
    updateAppBadge(5);
    expect(document.title).toBe("(5) DARB");
  });
});
