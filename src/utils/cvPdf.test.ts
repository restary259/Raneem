import { describe, it, expect, vi, afterEach } from "vitest";
import { shiftStraddlingEntries } from "./cvPdf";
import { A4_H_PX } from "@/components/lebenslauf/cvLayout";

/**
 * DOM-level test for the page-break spacer pass. jsdom returns zero rects, so
 * getBoundingClientRect is mocked with real box values per element — this
 * exercises the actual measure → compute → spacer-insert → restore code path
 * (not the pure function, which cvLayout.test.ts covers).
 */
function mockRect(el: Element, top: number, height: number) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top, bottom: top + height, height, left: 0, right: 794, width: 794, x: 0, y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

function spacerCount(root: HTMLElement): number {
  return root.querySelectorAll("div[aria-hidden='true']").length;
}

afterEach(() => vi.restoreAllMocks());

describe("shiftStraddlingEntries (DOM pass)", () => {
  it("inserts a spacer before an entry straddling a page boundary and restores it", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="cv-main-flow">
      <div class="cv-entry" id="a"></div>
      <div class="cv-entry" id="b"></div>
    </div>`;
    const [a, b] = [root.querySelector("#a")!, root.querySelector("#b")!];
    mockRect(root, 0, 2000);
    mockRect(a, 100, 50);                    // fully inside page 1
    mockRect(b, A4_H_PX - 10, 50);           // straddles page 1 boundary

    const restore = shiftStraddlingEntries(root);
    const spacer = root.querySelector("div[aria-hidden='true']") as HTMLElement;
    expect(spacer).toBeTruthy();
    expect(spacer.style.height).toBe("10px");
    // Spacer is inserted immediately before the straddling entry.
    expect(spacer.nextElementSibling).toBe(b);

    restore();
    expect(spacerCount(root)).toBe(0);
    // Entry order/content untouched after restore.
    expect(root.querySelectorAll(".cv-entry")).toHaveLength(2);
  });

  it("inserts the spacer before the h2 heading so it is not orphaned", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="cv-main-flow">
      <section><h2 id="h">Experience</h2><div class="cv-entry" id="e"></div></section>
    </div>`;
    const [h, e] = [root.querySelector("#h")!, root.querySelector("#e")!];
    mockRect(root, 0, 2000);
    mockRect(e, A4_H_PX - 10, 50);

    shiftStraddlingEntries(root);
    const spacer = root.querySelector("div[aria-hidden='true']") as HTMLElement;
    // Heading precedes the entry → spacer goes before the heading.
    expect(spacer.nextElementSibling).toBe(h);
  });

  it("scopes entry selection to .cv-main-flow, ignoring rail/sidebar entries", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div>
      <aside><div class="cv-entry" id="rail"></div></aside>
      <div class="cv-main-flow"><div class="cv-entry" id="main"></div></div>
    </div>`;
    const [rail, main] = [root.querySelector("#rail")!, root.querySelector("#main")!];
    mockRect(root, 0, 2000);
    // Rail entry straddles a boundary but must be ignored (parallel flow).
    mockRect(rail, A4_H_PX - 10, 50);
    mockRect(main, 100, 50);

    shiftStraddlingEntries(root);
    expect(spacerCount(root)).toBe(0);
  });

  it("falls back to the whole root when no .cv-main-flow is present", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="cv-entry" id="e"></div>`;
    const e = root.querySelector("#e")!;
    mockRect(root, 0, 2000);
    mockRect(e, A4_H_PX - 10, 50);

    shiftStraddlingEntries(root);
    expect(spacerCount(root)).toBe(1);
  });
});
