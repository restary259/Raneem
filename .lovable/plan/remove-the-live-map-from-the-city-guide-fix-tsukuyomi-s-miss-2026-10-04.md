# Remove the live map from the City Guide + fix Tsukuyomi's missing invoice

## 1. City Guide without the live map
- Remove the live map from the City Guide.
- Remove the background lookup of extra place details (photos, ratings, live hours). Today that lookup goes through the Google Maps service on every visit.
- Keep the place cards: name, category, short Darb team tip, address.
- Each card gets an "Open in Google Maps" button that opens the place in Google Maps in a new tab. No Google key or paid usage is needed for this.
- Search, category filters and the Darb tips stay as they are.

## 2. Why Tsukuyomi can't see his invoice
Checked against the live data:
- His invoice exists: **DRB-INV-2026-000153**, issued today, linked to his case.
- The access rule already allows the student on the case to read it.
- **The cause:** the live database is missing the read permission on the invoices list for signed-in users. That permission exists in the project's migration files but was never applied live.
- So the Fees page's invoice lookup is refused, and the page silently shows "No invoice has been issued yet."

Fix:
- **Manual SQL for you to run** (you deploy migrations yourself). It restores only the read permission. The existing rule still limits each person to invoices on their own cases (the student, the assigned team member, or admins). No data changes.
- **App change:** the Fees page will show a "couldn't load your invoice — retry" message when the lookup fails, instead of pretending there is no invoice.

## Technical details
- `src/components/student/StudentCityGuide.tsx`:
  - Drop `CityGuideMap`, `useServerFn(getCityGuidePlaces)`, the `places`/`selectedId` state and the map column.
  - The card button uses the existing `mapsSearchUrl(location)`.
  - Desktop layout becomes a single responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `min-w-0`).
- Delete `src/components/student/CityGuideMap.tsx` and `src/lib/cityGuidePlaces.functions.ts`.
- Leave the `city_guide_place_cache` table untouched. It will no longer be used.
- Update `StudentCityGuide.test.tsx` mocks. Remove the "Popular near you" dependency if it came from live places.
- `src/pages/student/StudentFeesPage.tsx`: check the `case_invoices` read error and render a destructive retry state. Never treat a failed read as "no invoice".
- Manual migration `supabase/migrations/<new timestamp>_restore_case_invoices_select_grant.sql`:
  ```sql
  GRANT SELECT ON public.case_invoices TO authenticated;
  ```
  RLS stays enabled with the existing policies "Case members read invoices" and "Admins read invoices".
- Verify after you run it:
  - the grant query shows `authenticated: SELECT`;
  - signed in as Tsukuyomi, `/student/fees` shows "View invoice" and `/invoice/<token>` opens.
- Run typecheck and tests.
