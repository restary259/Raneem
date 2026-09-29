# Fix the majors page filter sheet (opens in the wrong place)

## What's wrong
On the majors page, tapping Filter opens the category list squeezed under the site header. It sits over the cards, gets cut off at the bottom, and the dark background behind it doesn't cover the page. The floating chat and download buttons and the bottom menu also stay on top of it.

## Cause
The filter panel lives inside the sticky search bar, and that bar has a blur effect. In browsers, a blur like that traps "fixed" pop-ups inside the bar instead of the whole screen. So the panel is positioned against the small search bar, not the phone screen.

## Fix
- Render the filter panel and its dark background at the top level of the page (a React portal to `document.body`), so it's positioned against the whole screen.
- On mobile it opens as a proper bottom sheet: bottom of the screen, max 80% of the screen height, rounded top, list scrolls inside, safe-area space for the iPhone home bar. On desktop it's a centered window.
- Raise it above the header, the bottom menu and the floating chat/download buttons.
- Close with Escape, keep the tap-outside-to-close behaviour, and keep background scroll locked.
- Use theme colours for the drag handle instead of a hardcoded grey, and place it correctly (the handle currently sits inside the header row).

## Check
- Test at phone width (402px) in Arabic, English and Hebrew, and on desktop, with a screenshot of the open sheet.
- Add a small test that the sheet renders at the top level of the page and closes on Escape and outside tap.

## Technical notes
- File: `src/components/educational/SearchAndFilter.tsx` only.
- `createPortal(..., document.body)` guarded for SSR (render only once mounted).
- `backdrop-blur-md` on the sticky `<section>` is what creates the containing block; it stays for the bar itself.
