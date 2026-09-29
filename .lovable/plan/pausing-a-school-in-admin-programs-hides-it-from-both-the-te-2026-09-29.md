# Pausing a school in admin Programs hides it from both the Team Partner Schools page and the Team Catalog page

## What changes
Every Partner School is already linked to a school in the admin Programs page. The Team Partner Schools pages will now also check that linked school:

- If the school is **paused** in admin Programs, it disappears from the Team school list, is removed from the country's school count, and opening its page directly shows "School not found".
- Resuming it in admin brings it back straight away (next page load).
- A Partner School with no linked school keeps its current behaviour.

## Heads-up (current data)
Right now only **F+U Academy** is active in admin Programs. **KAPITO, Alpha Aktiv and GoAcademy Düsseldorf are paused there**, so once this ships they will vanish from the Team dashboard until you resume them in Programs.

## Technical details
- `src/hooks/usePartnerSchools.ts`:
  - `usePartnerCountries`: select `partner_schools` with the linked `schools(is_active)` via `catalog_school_id`, and drop rows where the linked school exists and is inactive.
  - `usePartnerSchoolDetail`: same check after loading the school; treat an inactive linked school as not found.
- No database changes; team already has read access to `schools`.
- Add a small unit test for the filter rule.
