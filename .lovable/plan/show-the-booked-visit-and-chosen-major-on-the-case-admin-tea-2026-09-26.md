# Show the booked visit and chosen major on the case (admin + team)

## What already works (confirmed in code)
- An office visit booked from the apply page is already saved against the student's case.
- The chosen major is saved on the case at submission.
- When admin assigns the case, the visit is moved to that team member automatically. Pending visits appear under "Visit requests". Confirmed visits appear in their normal appointments list.

## What is missing
- The admin pipeline side panel doesn't show the chosen major or the booked visit.
- The team member's case page doesn't clearly show the chosen major. Visit requests created before the assignment trigger existed may never have been assigned to anyone.

## Changes
1. **Admin case side panel** (opens when a case is clicked in the pipeline): add a compact "Application" block with
   - Chosen major (name from DARB's major list, falling back to the typed interest)
   - Office visit: date/time (Israel time), status (Pending confirmation / Confirmed / Cancelled), or "No visit booked"
2. **Team case page overview**: add the same two rows so an assigned team member sees them immediately.
3. **Appointments page**: keep the current logic. Also make sure a pending visit on an assigned case shows up even if its team member was never set. The page already finds requests through the case's assignee.
4. **One-time data repair** (safe, idempotent): assign existing pending/confirmed office visits to their case's current assignee where missing.
5. Layout: short rows, truncation for long major names, and RTL/LTR checks at phone and desktop widths. Arabic/English/Hebrew labels.

## Verification
- Submit a test application with a major and a booked slot, then open it in the admin pipeline and confirm both show.
- Assign it to a team member, then confirm the case page shows both and the visit appears in that member's appointments page.
- Confirm the visit, then check that it moves to the normal list. Archive the test case afterward.

## Technical notes
- Reads: `cases.preferred_major_id` / `degree_interest`, latest `appointments` row where `public_booking = true` for the case.
- Files: `src/pages/admin/AdminPipelinePage.tsx` (side sheet), `src/components/cases/CaseOverviewPanel.tsx`, locale files (en/ar/he, both `src/locales` and `public/locales` if landing keys).
- Migration: `UPDATE appointments a SET team_member_id = c.assigned_to FROM cases c WHERE a.case_id = c.id AND a.public_booking AND a.team_member_id IS NULL AND c.assigned_to IS NOT NULL AND a.outcome IS NULL`.
