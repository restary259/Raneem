# AI Advisor page layout fix (/ai-advisor)

User-visible goals (mobile-first, page-scoped only — no other page changes, no backend changes):

1. Page opens at the top automatically.
2. The AI advisor tool is the FIRST thing; contact info sits under it.
3. The compact advisor portrait + intro strip stays above the chat.
4. The navy footer is removed on this page only.

## Current state (verified)

- `src/pages/AIAdvisorPage.tsx` renders: header → portrait/intro card → contact card → chat → Footer.
- On mobile the contact card appears before the chat (DOM order = visual order).
- The page can open scrolled away from the top (no scroll-to-top on mount).
- Footer is the shared `Footer` component; removing it here must not touch other pages.

## Changes (single file: `src/pages/AIAdvisorPage.tsx`)

1. **Scroll to top on open**
   - Add a mount-only `useEffect` that runs `window.scrollTo(0, 0)` (instant, not smooth).

2. **Compact intro strip (kept, made compact)**
   - Shrink the portrait/intro card to a single horizontal row: small circular photo (≈56–64px) + eyebrow/title + one short intro line. No large card, no spectrum strip taking vertical space.
   - This stays at the very top of the page content.

3. **AI tool first, contact under it**
   - Move the `#ai-advisor-chat` chat section to render directly under the intro strip, full width.
   - Keep the existing chat internals unchanged (AI Elements conversation, composer, quick questions, clear-history, offline banner).
   - Below the chat, render the contact card: "support from a DARB person" heading + WhatsApp button, email button, and the "open contact form" link (all unchanged behavior/URLs).
   - Drop the two small "human support / AI advisor" label tiles and the `#ai-advisor-chat` anchor tile — the chat is now above, so the anchor is redundant.

4. **Remove the navy footer on this page only**
   - Delete `<Footer />` from this page's JSX (shared `Footer` component untouched for all other pages).
   - Keep the bottom padding (`pb-24 md:pb-0`) so content clears the mobile bottom nav.

## Preserved

- Chat behavior, AI backend, WhatsApp/email URLs, contact form link, metadata (`SEOHead` + route head), bilingual copy (existing `advisor.hub.*` keys reused; only reorder — new keys only if the compact strip needs one), RTL, and keyboard/reduced-motion behavior.
- All other pages (footer intact everywhere else).

## Expected results — [PASSED]/[FAILED] checklist

- [PASSED/FAILED] Opening /ai-advisor renders at the top of the page, every time.
- [PASSED/FAILED] First content after the compact intro strip is the AI chat, on mobile and desktop.
- [PASSED/FAILED] WhatsApp / email / contact-form options appear below the chat.
- [PASSED/FAILED] Compact portrait + intro strip present at top; no oversized card.
- [PASSED/FAILED] No navy footer on /ai-advisor; footer still present on /contact and other pages.
- [PASSED/FAILED] Typecheck + build pass; no new i18n parity gaps.
