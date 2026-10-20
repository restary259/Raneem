import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const UI = path.resolve(SRC_ROOT, "components", "ui");
const STYLES = path.resolve(SRC_ROOT, "styles.css");

const read = (file: string) => fs.readFileSync(file, "utf8");

/**
 * Every double-quoted string literal in a component file, split into class
 * tokens. Guards assert on token membership so a stray mention in a comment
 * cannot satisfy them.
 */
function classLists(file: string): string[][] {
  return [...read(file).matchAll(/"([^"\n]*)"/g)].map((m) =>
    m[1].split(/\s+/).filter(Boolean),
  );
}

function withAll(file: string, ...tokens: string[]): string[][] {
  return classLists(file).filter((list) => tokens.every((t) => list.includes(t)));
}

describe("P1-1 overlays scale from their anchor, not the centre", () => {
  const overlays: Array<[string, string]> = [
    ["dropdown-menu", "dropdown-menu"],
    ["context-menu", "context-menu"],
    ["hover-card", "hover-card"],
    ["select", "select"],
    ["popover", "popover"],
    ["tooltip", "tooltip"],
  ];

  it.each(overlays)("%s content sets a Radix transform origin", (file, name) => {
    const lists = classLists(path.resolve(UI, `${file}.tsx`));
    const origin = `origin-(--radix-${name}-content-transform-origin)`;
    const animating = lists.filter((l) => l.includes("data-[state=closed]:zoom-out-95"));
    expect(animating.length, "popup content with zoom animation").toBeGreaterThan(0);
    for (const list of animating) {
      expect(list, `${file} content classes`).toContain(origin);
    }
  });
});

describe("P1-7 transitions name their properties", () => {
  it("no UI primitive animates transition-all", () => {
    const offenders: string[] = [];
    for (const f of fs.readdirSync(UI)) {
      if (!f.endsWith(".tsx")) continue;
      if (classLists(path.resolve(UI, f)).some((l) => l.includes("transition-all"))) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the progress bar animates width, not everything", () => {
    const lists = withAll(path.resolve(UI, "progress.tsx"), "bg-primary");
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.some((l) => l.includes("transition-[width]"))).toBe(true);
  });
});

describe("P1-4 large display type is tracked as a set", () => {
  const styles = read(STYLES);

  it("display title classes carry slight negative tracking", () => {
    const idx = styles.indexOf("letter-spacing: -0.02em;");
    expect(idx, "negative display tracking present").toBeGreaterThan(-1);
    const open = styles.lastIndexOf("{", idx);
    const selector = styles.slice(styles.lastIndexOf("}", open) + 1, open);
    for (const sel of [
      ".darb-page-hero-title",
      ".darb-home-hero-title",
      ".darb-home-hero-destination",
    ]) {
      expect(selector, "tracking rule selectors").toContain(sel);
    }
  });
});

describe("P1-3 the toast chime is reserved for failures and flagged commits", () => {
  it("does not beep on every toast", () => {
    const src = read(path.resolve(UI, "toaster.tsx"));
    expect(src).toContain('playNotificationSound("error")');
    expect(src).toContain("newest.sound");
    // The old blanket call keyed only off the variant must be gone.
    expect(src).not.toContain("playNotificationSound(newest.variant");
  });
});

describe("P1-2/P1-3 one toast system", () => {
  it("sonner is gone from source and manifest", () => {
    const pkg = read(path.resolve(SRC_ROOT, "..", "package.json"));
    expect(pkg).not.toContain('"sonner"');
    expect(fs.existsSync(path.resolve(UI, "sonner.tsx"))).toBe(false);
    expect(read(path.resolve(SRC_ROOT, "components", "AppShell.tsx"))).not.toContain("sonner");
  });
});

describe("P1-9 icon controls meet the 44px tap-target floor", () => {
  it("no icon Button overrides its size below 44px", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.resolve(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".tsx")) {
          const src = read(full);
          for (const m of src.matchAll(/<Button\b[^>]*?>/gs)) {
            const tag = m[0];
            if (/\bh-[6789]\b/.test(tag) && /\bw-[6789]\b/.test(tag)) {
              offenders.push(`${full}:${src.slice(0, m.index).split("\n").length}`);
            }
          }
        }
      }
    };
    walk(SRC_ROOT);
    expect(offenders).toEqual([]);
  });
});
