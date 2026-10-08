# Use the new white DARB wordmark in footers

## Goal
Use the newly uploaded white DARB wordmark (white letters, colored dots, transparent background) as the logo shown in footer areas, which sit on dark backgrounds.

## Changes

1. **Upload the image as a CDN asset**
   - Create `src/assets/darb-wordmark-footer.png.asset.json` via `lovable-assets create` from the uploaded file. No binary copied into the repo.

2. **Website footer** (`src/components/landing/Footer.tsx`)
   - Replace the circular icon image at the top of the footer with the new white wordmark.
   - Size it to keep its real proportions (wide wordmark, not squashed), roughly 140–160 px wide, height auto.
   - The circle icon stays only where it belongs: browser tab icon, app icon, and small round badges (e.g. chat).

3. **Email footers** (`supabase/functions/_shared/email-ui/theme.ts` + `components.tsx`)
   - Add a `FOOTER_LOGO_URL` pointing at the new white wordmark CDN URL.
   - Use it in the email footer block (dark/colored footer strip); the header keeps the existing dark wordmark on light background.
   - Redeploy the shared email theme so all templates pick it up.

4. **Invoice web page / PDF**
   - Check the invoice footer: if it renders a logo on a dark strip, switch it to the white wordmark; if it's on white, leave the dark wordmark as-is.

## Verification
- Build + typecheck pass.
- Email template tests pass.
- Visually check the website footer and one email preview for correct size and shape.

## Notes
- Old logo files stay in place, unused, in case you want them back.
- No database or content changes.
