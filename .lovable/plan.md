# Catalog: finish the two fixes, then a focused audit

Both fixes are already implemented in the working tree; what remains is verification and a scoped audit. This plan covers the remaining work only.

## Current state (verified by reading the code)

Issue 1 — Admin cannot delete Schools / Programs
- Root cause confirmed earlier: there was no delete action for schools at all, and program/accommodation deletes went through a raw table delete that failed on `NO ACTION` foreign keys (`case_submissions`, `service_catalog`, `important_contacts`, `profiles`) with a raw Postgres message and no confirmation.
- Already in place: admin-only `SECURITY DEFINER` RPCs `catalog_dependency_report` and `delete_catalog_entity` (role re-checked and dependencies re-checked inside the transaction, audit-logged), `CatalogDeleteDialog`, a Delete button on `SchoolInfoCard`, and delete wiring for school/program/accommodation in `AdminProgramsPage`.

Issue 2 — Team accommodation photos cannot scroll
- Root cause confirmed: `AccommodationDetail` kept its Radix modal open while rendering `PhotoLightbox` into `document.body`; the modal sets `pointer-events: none` on the body, so prev/next, thumbnails and swipe received no events (arrow keys still worked).
- Already in place: the detail dialog is now driven by `open && lightboxAt === null` so only one modal layer owns pointer events, and `PhotoLightbox` sets explicit `pointer-events: auto` plus propagation stops.

## Remaining work

1. Verify Issue 1 end to end
   - Query the database for a school/program with zero dependents and one with dependents; confirm `catalog_dependency_report` returns the expected counts and `can_delete` flags.
   - Confirm a non-admin (team_member) call to `delete_catalog_entity` is rejected by the role check inside the RPC.
   - Confirm a deleted record disappears from Admin after refetch and is absent from the Team catalog (`useTeamCatalog` `is_active` filter unaffected).
   - Confirm deactivate/reactivate still works and the blocked path offers "Deactivate instead".

2. Verify Issue 2 in the browser
   - Playwright on `/team/catalog`: open an accommodation, click a photo, then use next/prev, a thumbnail, and Escape. Screenshot at desktop and at 393px width.

3. Focused Catalog audit (Admin → Team only)
   - Admin: create / edit / deactivate / reactivate / delete for schools, programs, accommodations; search, filter, sort; photo entry points; loading, empty and error states.
   - Team: drill-down, filters, accommodation detail, price tiers, photo gallery, mobile layout.
   - Report only bugs actually observed, each with reproduction and root cause. Fix only clear Catalog defects found; anything larger is reported, not silently redesigned.

4. Verification discipline
   - Only the smallest relevant checks: targeted SQL reads, the two Playwright passes, `npx vitest run src/lib/catalogDisplay.test.ts`, and one `npm run build`. No full suite loops.

## Scope

Catalog only: `src/pages/admin/AdminProgramsPage.tsx`, `src/components/admin/programs/*`, `src/components/catalog/*`, `src/pages/team/TeamCatalogPage.tsx`, `src/hooks/useTeamCatalog.ts`, `catalog.*` / `admin.programs.*` i18n keys in en + ar. No changes to Finance, Commissions, Auth, or unrelated dashboards.

## Final output

A concise report: Issue 1 and Issue 2 each as Reproduced → Root cause → Fix → Verification, plus verified additional Catalog bugs, the exact files/DB objects changed, and which focused checks passed.
