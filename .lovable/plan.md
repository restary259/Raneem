# Batch 3 — Team Account, Invitation, Assignment & Team Dashboard E2E

Scope: Team role only. No Batch 4 work. Every step reported as
`STEP N DONE — files changed: [...] — how to verify: [...]` or `STEP N BLOCKED — ...`.

## What the pre-plan audit already confirmed

- Team UI exists and is not duplicated: `/team` routes in `src/App.tsx` (work, cases, case detail, appointments, students, student profile, analytics, spreadsheet, bagrut, submit-new-student), all behind `ProtectedRoute allowedRoles={["team_member"]}` with `DashboardLayout role="team_member"`.
- Team invitations are already role-aware: `supabase/functions/invite-account/index.ts` maps `team_member -> { type: "team", template: "team-invite" }`, separate from partner/ambassador.
- Admin account management already has both paths (invite / create manually) in `src/pages/admin/AdminTeamPage.tsx`, hardened in Batch 1–2 (one identity = one role, deactivation dialog, identity-conflict messages).
- `cases` RLS today: admins manage all; team members manage only rows where `assigned_to = auth.uid()`. So unassigned-case leakage is blocked at the database, not just the UI.
- `darbsocial27@gmail.com` currently has no account and no role, so the demo Team invite will not collide with the admin identity (`ranimdwahde3@gmail.com`).

Unverified so far, and therefore treated as investigation work rather than stated fact: assignment notifications, case chat scoping, WhatsApp action correctness, the single-character focus-loss bug, and team access to non-`cases` tables (case_submissions, documents, appointments, payments, messages).

## Steps

1. **Audit the Team system (read-only).** Enumerate role definition, both creation paths, invitation records, auth/redirect logic, all `/team` pages, permissions, case access, pipeline actions, notifications, chat, finance visibility, every Team-touching RLS policy and RPC, the `team-invite` email template, and Team routes/tables. Classify each as works / broken / legacy / duplicated / missing / insecure / frontend-only.
2. **Verify both creation options** in the existing admin account-management page — role select, email validation, resulting `profiles` + `user_roles` + `user_invitations` rows, invitation state. Extend, never fork, that page.
3. **Create the demo Team account** `team` / `darbsocial27@gmail.com` via the invitation flow, and verify the actual queued email row is the Team template with DARB branding, correct link and correct role — not partner, student, reset or generic.
4. **Complete the invitation** end to end with password `Ranim123@123` using a real browser: activation page, password set, session created, lands on Team dashboard (not partner/student/admin), refresh persists, logout, log back in.
5. **Team role security.** Attempt admin/partner/student routes and direct-ID reads against the database as the Team session; confirm backend/RLS refuses, not just route guards. Fix real gaps.
6. **Team dashboard UI/UX pass** on desktop: dead buttons, wrong role wording, broken modals, tables, empty/loading/error/success states, overflow. Targeted fixes only, no redesign.
7. **Case access model.** Confirm how assignment is stored (`cases.assigned_to`), who can set it, whether history/timestamps exist, and that admin→team assignment exposes exactly one case. Fix the access layer only.
8. **Create one demo case through the real Apply flow** (browser), then verify the stored row: reference number, student data, source/referral, nothing silently dropped.
9. **Assign that case to `team` from the Admin dashboard**, verify the database row, both dashboards, and that refresh keeps the assignment.
10. **Team case experience.** As the Team user, open the case and check every field the role should see; document (not fix) anything Apply captured but the case view omits.
11. **Editable fields.** Type continuously into each authorized field, save, refresh, re-check the backend. If the one-character focus-loss bug appears, fix the root cause (component identity / remount / uncontrolled-controlled churn), not the debounce.
12. **Case reference number.** Verify it is backend-generated, unique, stable across edits, visible where needed, and usable by exports. Only if genuinely broken, add the smallest tracked migration.
13. **Assignment notification** to the assigned Team member: recipient, case, reference, deep link, no duplicates, no fan-out to other Team members. Fix only assignment-notification issues.
14. **Case chat context**: correct thread, participants, case binding, send/receive, empty/error states, and no path from case chat into unrelated private threads.
15. **WhatsApp action**: present where intended, uses that student's phone, correct link format, safe/disabled when the number is missing or invalid.
16. **Mobile pass** (390px) through login → dashboard → cases → case → edit → notifications → chat → WhatsApp → logout; fix real overflow/input/modal issues.
17. **Data consistency**: Team edits visible to Admin, assignment and reference unchanged, no duplicate case or student rows, database is source of truth after refresh on both sides.
18. **Post-assignment security matrix**: team-assigned OK, team-unassigned denied, admin OK, partner and student denied Team-only data — tested with direct IDs. Fix real vulnerabilities.
19. **Cleanup of confirmed legacy Team code only**, each removal justified by proof it is unused and by passing tests; anything uncertain stays and gets documented.
20. **Final Team E2E run** of the full chain from invite through re-login with the case still available.
21. **Batch 3 report** in the exact requested structure.

## Technical notes

- Verification uses Playwright against the running app plus direct database reads; no step is marked done on "the function returned 200".
- Any schema change goes through the migration tool, with GRANTs, and only where a real defect is proven.
- Fixes stay inside the existing auth/invitation/case architecture — shared bugs get fixed in the shared layer, never worked around per-role.
- Expected touch points if defects are found: `src/pages/team/*`, `src/components/team/*`, `src/pages/admin/AdminTeamPage.tsx`, `src/pages/admin` case assignment surface, `supabase/functions/invite-account`, notification triggers.
