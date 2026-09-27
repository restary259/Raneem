# Set up offices in the database without breaking /office-visit

## What I found in the live database
- None of the office tables exist yet.
- /office-visit books through a 3-step booking action. The office setup replaces it with an office-aware version. That version refuses to book ("Choose an office") unless the case has an office, and that office has booking turned on and a primary team member.
- The "start a booking" action that /office-visit calls first (`create_public_booking_session`) **does not exist** in the live database. New visitors probably can't start a booking today. I'll confirm this before changing anything.

## Steps
1. **Before:** run the /office-visit flow and record what happens now.
2. **Apply the four office setup files, in their original order.** This adds offices, members, working hours, booking settings, routing rules, and the save and team-list actions. It also creates the Tamra office, with booking turned off.
3. **Add the missing permissions** so signed-in staff can reach the new office tables. What each role can actually see or change stays limited by the existing rules: only admins can change anything, and team members see only active offices and their own memberships.
4. **Keep booking working:** until an office is ready, a booking for a case without an office falls back to the Tamra office. Tamra needs a primary team member and booking turned on. I'll ask you which team member to make primary; nothing is picked automatically.
5. **Add the missing "start a booking" action** if step 1 confirms it's missing.
6. **After:** check that Admin → Offices lists Tamra, that saving an office works, and that /office-visit can book a time and blocks a double booking.
7. Move the Offices page text into the Arabic, English and Hebrew translation files.

## Technical notes
- Migrations: `20260927141500`, `20260927160000`, `20260927180000`, `20260927180001` applied verbatim, then a new migration with `GRANT SELECT, INSERT, UPDATE, DELETE` on `offices`, `office_members`, `office_hours`, `office_breaks`, `office_blackouts`, `office_booking_settings`, `office_routing_rules` to `authenticated` and `ALL` to `service_role`. No anon access.
- `publicBooking.functions.ts` passes `p_office_id` (Tamra's id, looked up server-side) when the case has none.
- The existing `public_appointment_office_no_overlap` constraint is dropped and recreated by the first file. I'll check for overlapping rows first so the recreate can't fail.
