import React, { useRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { useScrollRestoration } from "../useScrollRestoration";

/**
 * Contract: forward navigation starts a page at the top, while moving back
 * through history restores the offset the user left that entry at. Before this,
 * DashboardLayout unconditionally scrolled to top on every pathname change, so
 * returning from a case wiped the list's scroll position.
 *
 * The location is driven directly (rather than through a real history) so the
 * push / replace / back transitions are exact and deterministic.
 */
const loc = vi.hoisted(() => ({
  current: { pathname: "/a", key: "k0", search: "", state: { __TSR_index: 0 } },
}));

vi.mock("@/lib/router-compat", () => ({
  useLocation: () => loc.current,
}));

function Harness() {
  const ref = useRef<HTMLElement>(null);
  useScrollRestoration(ref);
  return <main ref={ref} data-testid="main" />;
}

// jsdom has no layout, so scrollTop/scrollTo are inert. Give the container a
// real backing store so the hook's record/restore round-trip is observable.
const store = new WeakMap<Element, number>();

beforeEach(() => {
  loc.current = {
    pathname: "/a",
    key: "k0",
    search: "",
    state: { __TSR_index: 0 },
  };
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get(this: HTMLElement) {
      return store.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      store.set(this, value);
    },
  });
  (
    Element.prototype as unknown as { scrollTo: (o: { top?: number }) => void }
  ).scrollTo = function scrollTo(this: Element, o: { top?: number }) {
    store.set(this, o?.top ?? 0);
  };
});

afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe("useScrollRestoration", () => {
  it("resets to the top on forward navigation and restores on Back", async () => {
    const { getByTestId, rerender } = render(<Harness />);
    const main = getByTestId("main");

    // Scroll down and record the position the way the scroll listener does.
    main.scrollTop = 250;
    fireEvent.scroll(main);
    await flush();

    // Forward navigation to a new page starts at the top.
    loc.current = {
      pathname: "/b",
      key: "k1",
      search: "",
      state: { __TSR_index: 1 },
    };
    rerender(<Harness />);
    await waitFor(() => expect(main.scrollTop).toBe(0));

    // Browser Back returns to the previous entry at its recorded offset.
    loc.current = {
      pathname: "/a",
      key: "k0",
      search: "",
      state: { __TSR_index: 0 },
    };
    rerender(<Harness />);
    await waitFor(() => expect(main.scrollTop).toBe(250));
  });

  it("does not jump on a same-entry URL update (replace)", async () => {
    const { getByTestId, rerender } = render(<Harness />);
    const main = getByTestId("main");
    main.scrollTop = 400;

    // A REPLACE keeps the history index but mints a new key (e.g. the search
    // box syncing ?q=); the offset must stay put.
    loc.current = {
      pathname: "/a",
      key: "k0b",
      search: "?q=x",
      state: { __TSR_index: 0 },
    };
    rerender(<Harness />);
    await flush();
    expect(main.scrollTop).toBe(400);
  });
});
