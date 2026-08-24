# Catalog fixes: Admin deletion + Team photo gallery

## Issue 1 — Admin cannot delete schools (and program deletes fail cryptically)

Verified from the code and the live database:

- `AdminProgramsPage` has a `deleteRecord` helper, and it is wired to **programs, accommodations and insurances only**. Schools get an activate/deactivate toggle and edit — there is no delete action anywhere in `SchoolDirectory`, `SchoolInfoCard`, `SchoolProfilePanel`. So for schools, this is a missing UI action, not a backend block.
- Deletion is *not* blocked by permissions: the policy `Admins manage schools` / `Admins manage programs` / `Admins manage accommodations` is `FOR ALL` to authenticated admins. Team users have SELECT only. So the backend already enforces the correct boundary.
- Deletion *is* blocked by referential integrity when a record is in use. Every foreign key that points at these tables is `NO ACTION` (no cascade): `programs.school_id`, `accommodations.school_id`, `case_submissions.school_id / program_id / accommodation_id`, `service_catalog.school_id / program_id / accommodation_id`, `important_contacts.language_school_id`, `profiles.language_school_id`. The only cascade is `accommodation_photos → accommodations`.
- Today the delete buttons have **no confirmation dialog** and surface the raw Postgres message ("violates foreign key constraint …") in a toast, which reads as a mysterious failure.

### Chosen semantics (hybrid, matching the actual domain model)

- A catalog record with **no dependent rows** can be permanently deleted by an admin.
- A record that is referenced by student cases, submissions, service catalog entries, contacts or profiles **cannot** be deleted; the admin is told exactly what is blocking it and is offered deactivation instead. No new cascades are introduced — historical case/financial data must never be destroyed by a catalog edit.
- Deleting a school also requires its child programs and accommodations to be deletable (or already removed); the dialog reports those counts.

### Implementation

1. New SQL migration adding two admin-only `SECURITY DEFINER` RPCs (the backend, not the client, is the authority):
   - `catalog_dependency_report(p_kind text, p_id uuid)` → counts of blocking references per table, plus child program/accommodation counts for a school.
   - `delete_catalog_entity(p_kind text, p_id uuid)` → re-checks admin role via `has_role(auth.uid(),'admin')`, re-checks dependencies inside the transaction, deletes (school deletes its childless programs/accommodations in the same transaction), and writes an `admin_audit_log` row. Raises a typed, human-readable error when blocked. Granted to `authenticated` only; the role check inside is the trust boundary.
2. Admin UI: add a Delete action for schools (alongside the existing activate/deactivate) and route the existing program/accommodation/insurance delete buttons through one shared confirmation dialog component that:
   - names the exact record being deleted,
   - lists dependency counts fetched from the report RPC,
   - disables confirm and explains the blocker when deletion is unsafe, offering "Deactivate instead",
   - refetches the catalog on success so no stale row remains.
3. Keep deactivate/reactivate untouched.

## Issue 2 — Team accommodation gallery cannot be navigated

Reproduced by reading the component tree: `TeamCatalogPage` → `catalog/AccommodationDetail` renders a Radix `Dialog`, and renders `PhotoLightbox` as a sibling **while the dialog is still open**. `PhotoLightbox` portals to `document.body`. A modal Radix dialog sets `pointer-events: none` on `document.body` and scopes pointer events to its own content, so the lightbox paints on top (`z-[100]`) but its prev/next buttons, thumbnail strip and swipe handlers receive no pointer or touch events. Arrow keys still work (window-level listener), which is why the images appear but "cannot be scrolled" with mouse or touch. `Escape` is also intercepted by the dialog.

The photo data itself is fine: photos come from the `photos text[]` column via `allPhotos()`, and the whole array is passed to the lightbox.

### Fix (at the shared component, not a one-off)

- Close/suppress the detail dialog while the lightbox is open: drive `Dialog open` as `open && lightboxAt === null`, restoring the detail view when the lightbox closes, so only one modal layer owns pointer events at a time.
- Harden `PhotoLightbox` itself so it is safe under any parent modal: render into a container with explicit `pointer-events: auto`, stop propagation on its own pointer/touch handlers, and keep the existing keyboard/swipe/thumbnail navigation.
- Verify the same path in the Admin catalog (which uses the same lightbox) and the school/program photo entry points.

## Verification

- Admin: create/edit/deactivate/reactivate a school; delete an unused school, program and accommodation; attempt to delete a school and a program that are referenced by a case submission and confirm the block message; confirm deleted rows disappear after refetch and after a page reload; confirm a team_member session cannot call the delete RPC.
- Team: open an accommodation, click a photo, navigate with next/prev, thumbnails, swipe and arrow keys; close and reopen; check desktop and the 393px mobile viewport with Playwright screenshots.
- Cross-dashboard: change catalog data in Admin, reload Team catalog, confirm propagation; deactivated records stay hidden from Team (`is_active` filter in `useTeamCatalog`).
- `npm run build` and `npx vitest run` must be green.

## Scope

Only catalog files: `src/pages/admin/AdminProgramsPage.tsx`, `src/components/admin/programs/*`, `src/components/catalog/{PhotoLightbox,AccommodationDetail}.tsx`, `src/pages/team/TeamCatalogPage.tsx`, one new migration, and `catalog.*` i18n keys in en + ar. No changes to finance, commissions, auth or unrelated dashboards.

A full functional/visual catalog audit report (Admin → Team, critical → low) is delivered at the end, based on what the verification pass actually observes.
