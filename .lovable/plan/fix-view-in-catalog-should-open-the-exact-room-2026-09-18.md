# Fix: "View in catalog" should open the exact room

## What happens today

On a partner school page (KAPITO, F+U), each housing option has a "View in catalog" button. That button does not point at the room itself — it only opens the catalog filtered by school + room type + meals. Two things go wrong:

- The filter often matches nothing. Example: F+U "Residence category B — single" is stored in the catalog as a combined "single/double" room, so filtering by "single" hides it and the team sees an empty page.
- Even when it matches, the team lands on a list and still has to hunt for the right row.

There is currently no link at all between a school's housing option and the matching catalog record — the connection is guessed from room type and meals.

## The fix

1. Give every school housing option a real, stored link to the catalog record(s) it corresponds to.
2. Fill in those links for F+U (Heidelberg) and KAPITO (Münster) from their names, one by one, no guessing:
   - F+U residence categories A, B, B+, C, D, E map to the matching catalog entries (Category A is four separate buildings, so that option links to all four).
   - F+U host-family options have no catalog entry at all — they keep today's honest note: "Not in the DARB catalog — the school arranges this option directly."
   - Any option we cannot match with certainty keeps the same note rather than a wrong link.
3. Change the button behaviour:
   - One matching room → the catalog opens with that room's detail popup already open (photos, price, all fields).
   - Several matching rooms (e.g. Category A) → the catalog opens showing exactly those rooms, nothing else, with a short line saying which school option they belong to.
   - No match → no button, just the existing note.
4. Remove the old room-type/meals guessing so a mismatch can never again produce an empty catalog page.

## Technical notes

- Migration: add `catalog_accommodation_ids uuid[]` (nullable, default null) to `school_accommodations`; backfill for the F+U and KAPITO price versions by `code`. No RLS change (table already readable by team/admin).
- `src/lib/partnerSchools.ts`: `partnerSchoolCatalogUrl` takes the id list instead of `roomType`/`meals` and builds `/team/catalog?school=<catalogSchoolId>&tab=accommodations&ids=<id,id>`; returns `null` when the list is empty. Retire `CATALOG_MEALS`; update `partnerSchools.test.ts` (single id, multiple ids, empty list).
- `src/hooks/usePartnerSchools.ts` + `SchoolAccommodation` type: select/expose `catalog_accommodation_ids`.
- `src/pages/team/TeamCatalogPage.tsx`: read `ids`; when present, restrict `schoolAccommodations` to those ids (ignore the room-type filter), and when exactly one id, set `selected` so `AccommodationDetail` opens on load. Drop the `meals` param handling.
- `src/pages/team/TeamPartnerSchoolPage.tsx`: pass the id list; keep the `notInCatalog` fallback.
- New i18n keys (en + ar) for the "showing the rooms behind this option" line; parity guard must stay green.
- Verify in the browser as a team user: F+U Category B single opens the combined single/double record, Category A shows the four buildings, a host-family option shows the note.
