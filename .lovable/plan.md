# Finish the DARB quiet brand refresh

Complete everything still open from the brand refresh in one pass. Dashboards stay unchanged; no logic, routes, forms or data change.

## Remaining work
1. **Inner pages review** — About, Services, FAQ, Blog (list + article), Contact, Partnership, Resources, Destinations:
   - Big navy blocks become white/off-white sections with navy headlines (footer stays navy).
   - Cards become the quiet white card (thin border, 16px corners, soft shadow); remove card-inside-card and extra badges.
   - One main button per section; the main call to action becomes the yellow pill.
   - Colored-background cards become white cards with a small blue icon or colored detail.
2. **Calmer headings** — inner-page hero and section headings go one size smaller (big, not giant), especially Arabic; add a little more space between sections.
3. **Yellow "look here" accents** — highlight one key word in main page headlines and important numbers (e.g. 16+ students, 6+ partners) in yellow; nowhere else.
4. **Booking** — make the selected time button match the yellow selected date.
5. **Rainbow signature** — keep the thin muted strip only under heroes, on the apply success screen and in the footer; remove it from anywhere else on the public site.
6. **Check** — Arabic, English and Hebrew; phone (390px) and desktop; programs, homepage, apply/booking and each inner page; clean build.

## Technical details
- Reuse the tokens already added (`bg-highlight`, `bg-info-surface`, `bg-highlight-surface`, `shadow-quiet`, `bg-canvas`, `Button variant="cta"`).
- Add a small `HighlightWord` component (yellow underline/marker behind one word) used via existing translation text split, without changing translation keys where possible.
- Shared heroes (`DarbPageHero`, `PageHero`) get the smaller heading scale so all inner pages inherit it.
- Replace `bg-primary` full-width sections on public pages with `bg-background`/`bg-canvas` + `text-primary`; keep dashboards and footer untouched.
- Visual checks via Playwright screenshots at 1280px and 390px.
