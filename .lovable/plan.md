# Fix: transparent sidebars on mobile

## Cause (verified)

The sidebar uses the Tailwind color `bg-sidebar`, which maps to `hsl(var(--sidebar-background))` in `tailwind.config.ts`. That CSS variable is **not defined** in `src/index.css` — the only stylesheet imported by `src/main.tsx`. The `--sidebar-*` tokens exist only in `src/styles/base.css`, which is never imported.

Result: `hsl(var(--sidebar-background))` is invalid, the background falls back to transparent, and the mobile drawer (rendered as a Sheet with `bg-sidebar`) shows the page content behind it — exactly what the screenshot shows.

## Fix

1. Add the missing `--sidebar-*` tokens to the `:root` block in `src/index.css`, using values that match the existing light-mode palette (surface white/near-white, foreground and border from current tokens) rather than the stock shadcn greys, so the drawer matches the app.
2. Verify no other component relies on tokens defined only in `src/styles/base.css`; if others are missing too, add them in the same block.
3. Confirm the mobile drawer is fully opaque and readable on the admin, team, student and partner dashboards, in both LTR and RTL.

Light mode only — no dark variants added.

## Files

- `src/index.css` (add sidebar design tokens)
