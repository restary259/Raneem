# Verify recent GitHub merges + fix member drawer gap and duplicate Visa tabs

## What the scan found
- 38 commits landed today. All synced, except one problem: at 15:27 UTC a **revert ("Reverted to commit 45f71182")** undid GitHub fix **#201 (duplicate Visa tabs)**. Its changes are gone from the current code: the extra button row is back in the Visa queue, and its two test files were deleted.
- **#200 (member drawer scrolling)** is still fully in place. But it causes the big empty space in your screenshot. On phones, the tab-switcher strip uses the same "stretch and scroll" style as the content, so it stretches and pushes the toggles down.
- **#198 (permissions in Members drawer)** and **#197 (unified export)** are intact.
- The same revert also removed my last round of changes (Google card collapse, hidden empty location group, team menu, office save fix, working-hours phone layout, collapsible recent activity).

## Checklist
- [ ] 1. Re-apply #201 so the Visa page shows **2 tabs** (Pending, Visa Applied) instead of 4: the two top tiles become the only switcher and show which one is selected. Remove the duplicate button row. Restore its tests.
- [ ] 2. Fix the drawer gap: the tab-switcher strip gets its own fixed-size style, and only the tab content stretches and scrolls. Toggles then start right under the tabs on phones.
- [ ] 3. Ask whether the reverted Google/office changes from the previous round should be re-applied. They are not included unless you confirm.
- [ ] 4. Verify: run the Visa, KpiRow and navigation tests plus a typecheck. Open the Members drawer at phone size in the browser and confirm there is no gap and it scrolls.

## Technical details
- Restore `c4560cf8` changes: `VisaQueue.tsx`, `KpiRow.tsx` (`active` flag), `AdminVisaPage.tsx`, `__tests__/VisaQueue.test.tsx`, `shell/__tests__/KpiRow.test.tsx` (via `git show c4560cf8:<path>`).
- `MemberDetailDrawer.tsx`: TabsList wrapper uses a non-flex padding class (`px-4 pt-4 shrink-0`) instead of `bodyClassName`. `bodyClassName` stays only inside each TabsContent.
- No database changes.
