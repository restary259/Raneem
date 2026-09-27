# Appointments: fix cramped layout + office-based reassignment

## 1. Layout fixes (Team Appointments page)
- **Top toolbar:** on phones, the arrows, "Today", Day/Week/Month and the + button squeeze into each other and "Today" overlaps "Day". Split it into two rows on small screens: row 1 = prev / date label / next / Today, row 2 = Day·Week·Month + the + button. Add spacing so no pill touches another.
- **New Appointment form:**
  - The Time box is taller and wider than the Date box and runs off the right edge. Make Time the same height, rounded shape and width as Date, kept inside the form.
  - Put "(8 am – 8 pm)" under the label in small text so the Date/Time labels line up.
  - Student row: keep the "Manual" button the same height as the case picker.
- **Office field:** hide it when the team member belongs to only one office (auto-selected, shown as a small read-only line "Office: Tamra"). Show the dropdown only when they belong to 2+ offices. Move its hardcoded Arabic/English/Hebrew text into the translation files.
- Check Arabic (RTL) and English at phone width.

## 2. Who can assign what
- **Assign a team member to an office: admin only.** This is already enforced in the database (only admins can add/remove office members). The Offices admin page stays the only place to do it; no team screen will offer it.
- **Reassign an appointment to another team member: only team members with a new "Can reassign office appointments" switch on**, and only to members of the **same office** as the appointment.
  - Admin turns the switch on/off per team member in Admin → Members (same style as the existing chat/call switches). Default off.
  - In the appointment details, members with the switch on see "Assign to…" listing active members of that appointment's office. Others don't see it.
  - Admins can always reassign.

## Technical details
- `src/pages/team/TeamAppointmentsPage.tsx`: toolbar `flex-wrap`/two-row layout on `max-sm`; time input to match date button (`h-11 rounded-full w-full`); hint under label; office select conditional on `myOffices.length > 1`; add i18n keys under `team.appointments.*` (en/ar/he).
- Migration: `profiles.can_reassign_office_appointments boolean not null default false`; extend `restrict_profiles_write` guard so only admins can change it (verbatim re-create of the current definition + one check).
- New SECURITY DEFINER RPC `reassign_office_appointment(p_appointment_id, p_new_member_id)`: caller is admin OR (flag on AND active member of the appointment's office); target must be an active member of the same office; updates `appointments` assignee (and case `assigned_to` only if it matched the old assignee — to confirm before building), logs `case_events`. Granted to `authenticated` only.
- RPC `list_office_members(p_office_id)` (id + name) for the picker, same access rule.
- `MemberDetailDrawer`: new toggle via existing `ProfileFeatureToggle`.
- Verify: typecheck, i18n parity test, phone-width screenshots of toolbar + form.
