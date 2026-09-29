import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.resolve(__dirname, "..", "CaseDetailPage.tsx");
const FINANCE = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "components",
  "cases",
  "CaseFinance.tsx",
);

/**
 * The sticky action bar and the Finance invite block render long action labels
 * (`finance.invite.action` et al). The shared Button base is `whitespace-nowrap`
 * + `min-h-11`, so a long Arabic/Hebrew label made the row wider than the card
 * and the page scrolled horizontally on mobile.
 *
 * The fix wraps the label on small screens and lets the action row wrap. This
 * guard fails if an edit reintroduces a nowrap-only action button or drops the
 * row's `flex-wrap`.
 */
describe("case action overflow guard", () => {
  const page = fs.readFileSync(PAGE, "utf8");
  const finance = fs.readFileSync(FINANCE, "utf8");
  const wrapSafe = /whitespace-normal/;

  it("lets the sticky action-bar row wrap", () => {
    expect(page).toMatch(
      /className="flex flex-wrap items-center justify-between gap-3"/,
    );
  });

  it("keeps the mobile view Select from shrinking instead of wrapping the row", () => {
    expect(page).toMatch(/className="sm:hidden flex-1 shrink-0"/);
  });

  it("gives every sticky-bar action button a wrap-safe label class", () => {
    // All three action buttons (complete profile, submit to admin, confirm &
    // save) share the same wrap-safe class string; the definitions of the
    // handlers also appear above, so count the class string itself.
    const wrapSafeClass =
      "h-auto min-w-0 shrink gap-1.5 whitespace-normal py-2 text-center leading-snug sm:whitespace-nowrap";
    const count = page.split(wrapSafeClass).length - 1;
    expect(count).toBe(3);
  });

  it("gives the in-Finance invite button a wrap-safe label class", () => {
    const button = finance.match(
      /<Button[\s\S]*?finance\.invite\.action[\s\S]*?<\/Button>/,
    );
    expect(button, "invite button not found").not.toBeNull();
    expect(button![0]).toMatch(wrapSafe);
  });
});
