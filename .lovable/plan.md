# Partner Schools country page: remove the country title and fix the top spacing

## What changes
On the country page (for example Germany) that opens from Partner Schools:
- Remove the "DE ألمانيا" title from the top of the page.
- Keep the Back button, aligned to the same side as now.
- Add room at the top so the Back button and the school cards don't sit right under the top bar. Use the same top spacing as the main Partner Schools page.
- Remove the divider line under the header and tighten the gap above the cards so the page looks clean.

The school cards, links and data stay as they are.

## Technical details
- File: `src/pages/team/TeamPartnerSchoolsCountryPage.tsx`.
- Add `pt-4` to the page wrapper, matching `TeamPartnerSchoolsPage`.
- Drop the `title` prop from `PageHeader`. Its className changes from `mb-6 border-b border-border/50 pb-4` to `mb-4`.
- Keep the `country` lookup, because the schools filter still needs it.
- Check the page with a Playwright screenshot in Arabic at desktop and mobile widths, then run the typecheck.
