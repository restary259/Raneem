# Mobile: always-solid top header

## Problem
The fixed top header (`src/components/landing/Header.tsx`) is transparent until the user scrolls 24px (`scrolled` state). On mobile this makes the white logo/menu text sit directly over page content (e.g. /ai-advisor), and content shows through behind it. Desktop keeps the intentional transparent-over-hero look.

## Change (mobile view only)
In `src/components/landing/Header.tsx`:

- Track desktop via `window.matchMedia("(min-width: 1024px)")` with a change listener (the header's mobile area is `lg:hidden`, so 1024px is the right cutoff).
- Compute `solid = scrolled || !isDesktop`.
- Use `solid` everywhere `scrolled` currently drives styling:
  - header classes (`bg-background/95 shadow-surface backdrop-blur-md` + border vs transparent)
  - LanguageSwitcher text classes
  - `DesktopNav transparent={!scrolled}` and `MobileNav transparent={!scrolled}`
  - the (desktop-only) utility bar classes, for consistency

Result: on phones/tablets the header is always solid with a border and normal text colors; on desktop (≥1024px) nothing changes.

## Validation
- Playwright at 393px and 1280px: mobile header solid at top of page and after scroll; desktop still transparent at top, solid after scroll; check /ai-advisor and the homepage hero.
- RTL (Arabic) spot check.
- Typecheck + build pass.
