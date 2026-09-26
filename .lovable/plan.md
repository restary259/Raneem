# Always show a hero on desktop public pages (fix the apply page)

## What the code shows
- The site's top navigation bar is fixed on desktop, so it sits over the top of the page.
- 20 of the 21 public pages that use it handle this already. Most open with a full hero section (FAQ, Services, Contact and others). The AI Advisor and exam pages instead add top space equal to the bar's height.
- The **apply page** is the only one with neither. After the page's own hero and title were removed earlier, its subtext and progress bar started directly under the bar. That is exactly what your screenshot shows.

## Change
- Add the standard DARB page hero to the apply page on desktop, using the same component as the FAQ and Services pages. It gets a short compact title ("قدّم طلبك" / "Apply" / Hebrew), the existing subtext "سجّل معلوماتك الأساسية، وسيرافقك فريق درب في كل خطوة حتى وصولك إلى ألمانيا.", and the existing students photo.
- Remove the duplicated subtext from inside the form on the public apply page, so the sentence appears only once (in the hero). The form inside partner dashboards is unchanged.
- The phone layout stays as it is now (simple logo bar, no hero). The phone bar isn't fixed, so nothing gets hidden there.
- The success screen and the booking step also sit below the hero, so none of the steps get covered either.

## Technical notes
- `src/pages/ApplyPage.tsx`: render `DarbPageHero` (`compact`, image `DARB_PUBLIC_HERO_IMAGES.programs`) wrapped in `hidden md:block`.
- `src/components/apply/ApplyForm.tsx`: hide the intro subtext when not `embedded` on desktop, to avoid repeating it.
- Add the apply hero title key to the en/ar landing files (both `src/locales` and `public/locales`) and to the Hebrew `public/locales` file, so all languages match.
- Verify with Playwright at 1353px and 390px, in Arabic and English, that the progress bar starts below the navigation bar. Then check the build log.
