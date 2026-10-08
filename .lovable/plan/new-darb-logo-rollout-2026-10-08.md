# New DARB Logo Rollout

## Goal
Use the new DARB wordmark (dark + white versions) as the website logo everywhere. Use the circular headset icon only for the browser tab icon and the phone "Add to Home Screen" app icon — nowhere on the pages themselves.

## The three uploaded files
1. **Dark wordmark** — navy "DARB" with colored dots, for light backgrounds (public site, headers).
2. **White wordmark** — white "DARB" with colored dots, for dark backgrounds (dashboard dark mode, dark footers).
3. **Circle icon** — headset/chat bubble in a colored ring, used only as favicon + app icons.

## Steps

### 1. Store the images
- Upload all three as CDN assets (`lovable-assets`) so the repo stays light:
  - `src/assets/darb-wordmark-dark.png.asset.json`
  - `src/assets/darb-wordmark-white.png.asset.json`
  - `src/assets/darb-circle-icon.png.asset.json`

### 2. Replace the wordmark on the website
Swap the current `darb-logo-2026` / `darb-mark-2026` references with the new wordmark in:
- Public site header + mobile menu + footer
- Dashboard headers (dark variant where the background is dark)
- Apply / book-appointment / onboarding screens
- Chat screens (thread list, message list header, voice call screen)
- Invoice and registration PDFs
- Email templates theme
- Social share image (`og:image`) — regenerate the share card with the new wordmark

### 3. Circle icon for browser + app icons only
- Resize the circle icon into real files in `public/` (never CDN pointers for these):
  - `public/favicon-v2.png` (64px)
  - `public/apple-touch-icon-v2.png` (180px)
  - `public/icons/icon-192-v2.png`, `icon-512-v2.png`, `maskable-192-v2.png`, `maskable-512-v2.png`
- File names stay the same, so `src/routes/__root.tsx` and `public/manifest.json` need no changes.
- Old icon files are left in place (still referenced by older installs); nothing is deleted.

### 4. Verify
- Typecheck + build pass.
- Browser check: public home page header, a dashboard header, and the browser tab icon all show the new artwork.

## Notes
- No text, colors, or layout changes — only the artwork is swapped.
- Old logo assets stay in the repo unused; they can be cleaned up later if you want.
