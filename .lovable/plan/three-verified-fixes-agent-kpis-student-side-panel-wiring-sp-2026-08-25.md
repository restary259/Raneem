# Three verified fixes: agent KPIs, student side panel wiring, spreadsheet email column

All three issues were reproduced against the live database — none are assumptions.

## Issue 1 — Agent "Direct Enrolled" and "Network Enrolled" always show 0

**Verified cause:** the members directory only computes enrolled cases from cases *assigned to* a person (the team-member metric). An agent is never the assigned team member, so both agent tiles read the same empty number. For the agent in question the real figures are: 4 recruits, **5 direct enrolled**, **7 network enrolled**, ₪3,500 override — the override number proves enrolled network cases exist.

**Fix**
- Extend the members directory function with two real agent metrics: direct enrolled (cases the agent referred personally) and network enrolled (cases referred by the partners/ambassadors they recruited).
- Point the two agent tiles at their own metric instead of both reading the team-member field.
- Team-member and partner/ambassador tiles stay exactly as they are.

## Issue 2 — Student side panel: program, assigned team member and visa show "—"

**Verified cause:** the case row for DRB-2026-000096 does have an assigned team member and a program, but the admin student panel passes a hand-built case object that omits the assigned member, and passes no submission record at all, so the panel has nothing to resolve. The visa tab is empty because the dynamic visa field catalog is completely empty (0 fields configured), and the admin panel only renders the visa block when that catalog has entries — so the profile-level immigration answers the student already filled (arrival date, eye colour, passport expiry, legal questions) are never shown.

**Fix**
- Pass the full case record (including assigned team member) and load the case submission for the selected student so program and team member resolve.
- When no dynamic visa fields are configured, fall back to the shared read-only visa view that renders the profile-level immigration answers, instead of the "no visa information" message.
- Keep the existing admin visa edit flow (with password confirmation) untouched for when fields do exist.

## Issue 3 — Students spreadsheet has no Email column

**Verified:** the students rows already carry an email value and the "Email" label already exists in both languages — the on-screen sheet simply omits the column (the full export includes it).

**Fix**
- Add an Email column next to Phone in the students sheet definition.

## Technical notes

- New database migration extending `get_members_directory` with `direct_enrolled_cases` / `network_enrolled_cases`, derived from `cases.partner_id` (self) and `cases.partner_id IN (recruits of the agent)`, excluding deleted cases. Admin-gated and security posture unchanged.
- `MemberDetailDrawer` agent tiles bind to the two new fields; `AdminMembersPage` member type extended.
- `AdminStudentsPage`: pass `assigned_to` (plus the rest of the case row) into `StudentOverview`, fetch the matching `case_submissions` row for `program_id`, and fall back to `VisaReadOnly` when `visaFields.length === 0`.
- `SpreadsheetHub`: add `{ key: 'email', label: c('email') }` to the students columns.
- Verification: re-query the agent metrics after the migration, reload the student panel, and confirm the sheet renders the email column.
