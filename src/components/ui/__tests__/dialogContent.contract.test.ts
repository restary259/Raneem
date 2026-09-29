import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DIALOG = path.resolve(__dirname, "..", "dialog.tsx");
const source = fs.readFileSync(DIALOG, "utf8");

/**
 * Guards for `DialogContent`, the dialog primitive most admin pages and the
 * Admin Submissions case dialog depend on.
 *
 * Two independent failures motivated this file, both of which shipped silently:
 *
 * 1. `DialogContent` was dropped from the export list. The component stayed
 *    defined above it, so the file looked correct — but every importer received
 *    `undefined`, which broke the production build and 20 unit tests. Vite
 *    transforms that module, so `tsc` did not catch it. Hence an explicit
 *    assertion that every declared component is actually exported.
 *
 * 2. A wide child (a `w-max` tab strip) inflated the dialog's single implicit
 *    `grid` track beyond the dialog's content box, where `overflow-x-hidden`
 *    then CLIPPED it instead of letting it scroll. The fix is
 *    `[&>*]:max-sm:min-w-0`, scoped to `max-sm` so tablet/desktop keep their
 *    existing content-driven widths.
 */

const REQUIRED_EXPORTS = [
  "Dialog",
  "DialogPortal",
  "DialogOverlay",
  "DialogClose",
  "DialogTrigger",
  "DialogContent",
  "DialogHeader",
  "DialogFooter",
  "DialogTitle",
  "DialogDescription",
];

const GRID_ITEM_FIX = "[&>*]:max-sm:min-w-0";

function declaredForwardRefs(): string[] {
  return [...source.matchAll(/^const (\w+) = React\.forwardRef</gm)].map(
    (m) => m[1],
  );
}

/**
 * The base class list of `DialogPrimitive.Content`, read from the literal
 * rather than the whole file. Asserting against the whole file would be
 * vacuous here: the explanatory comment above the class list also names
 * `[&>*]:max-sm:min-w-0`, so a file-wide `toContain` would keep passing even
 * after the real utility is removed.
 */
function baseClasses(): string {
  const m = source.match(/"(fixed left-\[50%\][^"]*)"/);
  return m ? m[1] : "";
}

function exportedNames(): string[] {
  const block = source.match(/export \{([^}]*)\};/);
  if (!block) return [];
  return block[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("DialogContent export contract", () => {
  it("keeps the whole public surface importable", () => {
    expect(exportedNames()).toEqual(expect.arrayContaining(REQUIRED_EXPORTS));
  });

  it("exports every component it declares as a forwardRef", () => {
    // This is the invariant the missing `DialogContent` broke.
    const declared = declaredForwardRefs();
    expect(declared.length).toBeGreaterThan(0);
    const missing = declared.filter((n) => !exportedNames().includes(n));
    expect(missing).toEqual([]);
  });

  it("resolves the export list (guards against a broken regex matching nothing)", () => {
    // Keeps the two assertions above from passing vacuously.
    expect(exportedNames().length).toBeGreaterThanOrEqual(
      REQUIRED_EXPORTS.length,
    );
  });
});

describe("Dialog displayName contract", () => {
  /**
   * `f03c73d` also wrote `DialogDescription.displayName =
   * DialogDescription.displayName` — an assignment of a binding to itself.
   * Being a live binding, the reference read happens BEFORE the write, so it
   * throws a TypeError at module evaluation. Neither `tsc` (the type is
   * non-undefined) nor the test suite catches it, because the suite mocks every
   * dialog-consuming module. `eslint` DOES flag it (`no-self-assign`), but the
   * repo's lint step is `continue-on-error: true`, so nothing blocks it.
   *
   * Asserting `displayName` is wired to the RADIX primitive (not to itself) is
   * the cheap structural fence for this whole error class.
   */
  it("never assigns a displayName to itself", () => {
    const selfAssigns = [
      ...source.matchAll(/^(\w+)\.displayName = \1\.displayName;$/gm),
    ].map((m) => m[1]);
    expect(selfAssigns).toEqual([]);
  });

  it("syncs DialogDescription.displayName from the Radix primitive", () => {
    expect(source).toContain(
      "DialogDescription.displayName = DialogPrimitive.Description.displayName;",
    );
  });

  it("syncs each forwarded component's displayName from its primitive", () => {
    for (const name of [
      "DialogOverlay",
      "DialogContent",
      "DialogTitle",
      "DialogDescription",
    ]) {
      expect(source).toContain(`${name}.displayName = DialogPrimitive.`);
    }
    for (const name of ["DialogHeader", "DialogFooter"]) {
      expect(source).toContain(`${name}.displayName = "${name}";`);
    }
  });
});

describe("DialogContent mobile width contract", () => {
  it("keeps the mobile viewport clamp on max-width", () => {
    expect(baseClasses()).toContain("max-w-[calc(100vw-1rem)]");
  });

  it("zeroes grid-item min-width on mobile so wide children scroll instead of clipping", () => {
    expect(baseClasses()).toContain(GRID_ITEM_FIX);
  });

  it("scopes the grid-item fix to mobile so desktop sizing is untouched", () => {
    // An unscoped `[&>*]:min-w-0` narrows content-driven dialogs (e.g. a
    // `max-w-2xl` dialog) at tablet and desktop widths. The `max-sm:` scope is
    // the entire point of the fix, so assert the unscoped form is absent.
    expect(baseClasses()).not.toMatch(/\[&>\*\]:min-w-0\s/);
  });

  it("reads a real base-class list (guards against a regex matching nothing)", () => {
    expect(baseClasses().length).toBeGreaterThan(100);
  });
});
