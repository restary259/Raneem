# Fix overflowing cards on the Admin dashboard + full rendering sweep

## What's wrong (confirmed in code)
On the Command Center, the action-queue cards (Attribution integrity, Authorization failures, Unassigned, Review) sit in a two-column grid. Grid columns grow to fit their widest content, so a long attribution line (e.g. "12 rows · split attribution" plus a long case id) pushes the card wider than the screen instead of being shortened with "…". The card header (icon + long title + count + "View all") also has no room to wrap, so on phones the title collides with the button.

## Fix on the Command Center
- Let each queue card shrink to its column so long lines are shortened with "…" (full text on hover).
- Card header: title can wrap to two lines, count badge and "View all" never get pushed off.
- Each row: text takes the free space, "Open" button stays fixed on the end.
- Same treatment for the Cash Collection rows, Recent Activity rows (long action text / type badge) and the page header (title vs Refresh button on phones).
- KPI tiles: long labels wrap instead of spilling.

## Full sweep of the Admin dashboard
1. Automated check of every admin page at phone (390px) and desktop (1280px), Arabic and English: Command Center, Pipeline, Cases, Submissions, Students, Members, Programs, Offices, Financials/Finance hub, Commission hub, Analytics, Activity, Inbox, Spreadsheet, Settings tabs, WhatsApp campaigns. It flags sideways page scroll, text spilling out of cards, and clipped buttons/badges, with a screenshot per issue.
2. Code sweep for the same risk patterns: grids of cards without shrink allowance, rows with long text next to buttons, headers with title + actions and no wrap, long names/emails/ids without shortening, wide tables without a scroll wrapper.
3. Fix every flagged spot in the same pass, then re-run the check until it is clean. A short list (page, problem, fix) is reported at the end.

Note: admin pages need the admin two-step login in the automated browser. If that blocks some pages, those are covered by the code sweep and listed as not visually confirmed.

## Rules while fixing
- No information removed; long text is shortened with "…" and shown in full on hover.
- Layout-only changes, no data or behaviour changes. Existing colours/theme tokens only.

## Technical notes
- `AdminCommandCenter.tsx`: add `min-w-0` to queue `Card`s and grid items; header `CardTitle` → `min-w-0 flex-wrap`, badge/button `shrink-0`; row text wrapper `min-w-0 flex-1`, button `shrink-0`; Recent Activity badge `max-w-[40%] truncate`; header row → `grid grid-cols-[minmax(0,1fr)_auto]`.
- Sweep: Playwright script in `/tmp/browser/admin-overflow`, `scrollWidth > clientWidth` on page + elements; session via `lovable auth-session`.
- Verify: typecheck/build log + i18n tests.
