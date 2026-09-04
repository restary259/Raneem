# Homepage consistency and restoration fix

## Goal
Address the three regressions in the redesigned public homepage without changing its content, links, forms, or any dashboard behavior.

## Changes
1. **Restore the mobile button navigation**
   - Put the original five-item bottom navigation back on the homepage: Home, Majors, Advisor, Apply, and Account.
   - Keep the existing destinations, active state, icons, translations, safe-area spacing, and mobile-only behavior.
   - Remove the homepage-only two-button replacement so navigation is consistent across the public website.

2. **Match the website’s established typography and numbers**
   - Remove the homepage-only editorial/English font treatment and use the same sans-serif font family already used throughout the public website.
   - Apply that same typography to headings, statistics, step numbers, captions, and the header wordmark.
   - Keep displayed numbers in Western digits (`16+`, `6+`, `01–04`) in Arabic and English, matching the project-wide number rule.
   - Preserve the approved colors, section structure, and bilingual RTL/LTR layout.

3. **Restore every student photo**
   - Render the complete translated student gallery rather than limiting it with a six-item slice and hiding later photos on mobile.
   - Keep every student visible in the swipeable mobile row and in the desktop grid, using the existing names, destinations, image focus values, lazy loading, and accessible descriptions.
   - Retain stable photo dimensions so loading does not shift the page.

## Verification
- Check the homepage at the current mobile width and at desktop width in Arabic and English.
- Confirm all five bottom-navigation buttons are visible and open the correct pages.
- Confirm the full student photo count matches the existing gallery data in both languages.
- Confirm typography matches the rest of the public site, digits stay Western, and there is no clipping, overlap, or horizontal page overflow.
- Confirm the latest build completes without errors.

## Scope boundary
Homepage presentation and the shared public bottom-navigation homepage branch only. No changes to application forms, routes, backend, dashboards, or business logic.
