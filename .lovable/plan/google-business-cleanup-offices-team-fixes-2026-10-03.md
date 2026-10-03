# Google Business cleanup + Offices/Team fixes

## Request checklist
- [ ] 1. Keep only one connected Google Business account: **Tsukuyomi** (personal). Hide the "Darb office locations" group (LOCATION_GROUP, UNVERIFIED, Locations: 0) from the admin Google page.
- [ ] 2. Make the whole connected-account card collapsible, with a small status mark (connected check / account name) visible when collapsed.
- [ ] 3. Link the office (Tamra) to its Google Maps listing so data syncs to it.
- [ ] 4. Team dashboard: show only Google Business and its tabs (Overview, Profile, Reviews, Photos, Posts, Insights) — no extra office pages in the team Google area.
- [ ] 5. Fix mobile UI issues (screenshot: working-hours rows — day name, "Open" button and two time boxes squeezed; also bottom tab bar overlapping content).
- [ ] 6. Make "النشاط الأخير" (Recent activity) collapsible so it doesn't stretch its card (collapsed by default, show last ~5 items, "show more").
- [ ] 7. Unassigning a team member from an office: enable the "Save changes" button so the removal can be saved.
- [ ] 8. Verify each item at 393px (Arabic RTL) and desktop; typecheck + Google tests.

## How
1. The location group is a Google-side account under the connection; it cannot be deleted from Google by us. We filter it in the accounts list (hide groups with 0 locations / not the chosen account) and save Tsukuyomi as the only active account in Google settings. No data deleted.
2. Wrap account card in a Collapsible with a header row: logo, name, green check badge, chevron.
3. Use the existing "link location to office" action for Tamra, then run profile/reviews/photos/posts sync. Profile sync still depends on the pending admin-RPC fix in the Google profile functions — will apply it.
4. Trim team navigation under Google to the six tabs only.
5. Hours editor: stack on mobile (day + toggle on one row, open/close times side by side below), compact sizes; add bottom padding for the mobile tab bar.
6. Recent activity: Collapsible with max items + toggle, translated in ar/en/he (both locale trees).
7. Team assignment form: treat removed members as a change (dirty state) so Save enables, and save calls the existing office-members update.

## Technical details
- Files: `admin.google.tsx` + Google connection components, `admin.offices.$officeId.team.tsx` / team editor, office hours editor, activity list component, `team.google*.tsx` nav, `googleBusinessProfile.functions.ts`.
- No migrations, no production data deletion.
