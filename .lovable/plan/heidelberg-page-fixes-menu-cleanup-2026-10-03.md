# Heidelberg page fixes + menu cleanup

## What changes
1. **The gold progress line becomes vertical.** The thin horizontal gold bar under the section menu goes away. Instead, a vertical gold line runs down the side of the page and fills as you scroll, like a journey line. Each section number sits on the line as a dot, and the dot turns gold when you reach that section. On phones the line sits at the edge of the screen so it doesn't take space from the text. The section menu (chips) stays at the top.
2. **Same fonts as the rest of the site.** Section headings and the big numbers will use the site's heading font, the same one the Destinations page uses for city names. The body text keeps the normal site font for each language (Arabic, Hebrew, English). I'll also remove the forced left-to-right setting on German names, which switched them to a different font in Arabic.
3. **New title for students: "Get to know Heidelberg".**
   - Arabic: page title "تعرّف على هايدلبرغ", with a short student-focused subtitle: "كل ما تحتاج معرفته كطالب: الجامعة، السكن، المواصلات والحياة اليومية."
   - English: "Get to know Heidelberg". Hebrew: "הכירו את היידלברג".
   - The same name is used in the menu and in the browser tab title.
4. **Menu clean-up (desktop and phone).** I checked every menu item:
   - **Duplicate found:** "Educational Destinations" now shows only Heidelberg, so it repeats the new Heidelberg page. I'll remove it from the "Study in Germany" menu and make "Get to know Heidelberg" the first item. The Destinations page itself stays live, so old links keep working.
   - All other items appear only once: Majors, Quiz, AI Advisor, Services, FAQ, Broadcast, Blog, About, Locations, Partnership and Contact. The Apply and Student login buttons are also not repeated, so they stay as they are.
   - The phone menu will match the desktop menu item for item.

## Technical details
- `HeidelbergPage.tsx`:
  - Remove the horizontal `h-0.5` progress bar.
  - Add an absolutely positioned vertical rail on the section column's start side, using `start-*` so it is RTL-safe. It has a `bg-border` track and a `bg-highlight` fill whose height comes from the existing scroll progress.
  - Section numbers become dots on the rail, highlighted by the existing IntersectionObserver `active` state.
  - Headings use `font-editorial`.
  - Drop the inline `dir="ltr"` and `textAlign` on item names and fact values; use `<bdi>` for the Latin names instead.
- `src/data/heidelberg.ts`: update `heroTitle`, `heroSubtitle` and `HEIDELBERG_SEO.title` ("تعرّف على هايدلبرغ | درب").
- `nav.heidelberg` / `nav.heidelbergDesc` get new values in en, ar and he, in both `src/locales` and `public/locales`.
- `DesktopNav.tsx` / `MobileNav.tsx`: remove the `/educational-destinations` entry. The route and page stay, and the home page still links to it.
- Verify:
  - Typecheck and the i18n test pass.
  - Playwright at 393px Arabic and 1280px: the vertical line is visible and fills on scroll, nothing scrolls sideways, and the menu has no duplicate items.
