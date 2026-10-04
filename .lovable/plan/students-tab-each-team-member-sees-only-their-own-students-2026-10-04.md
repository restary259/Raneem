# Students tab: each team member sees only their own students

## Rule
- **Team member:** sees students they created (by manual creation or by invite), plus students whose case is assigned to them.
- **Admin:** sees every student and can add notes.
- Nobody else's students ever appear for a team member.

## What I found
- Manual creation already records the creating team member. Invites don't yet; that's the trigger and backfill in the SQL file you still need to run.
- The Students tab filters only "has any creator" and relies on the database rules to narrow it. That works today but is fragile: if a rule is ever widened, a team member would suddenly see everyone's students.
- The manual-creation step lets the caller pass a different "created by" person. A team member could file a student under someone else.

## Changes
1. **Students tab:** for team members, ask explicitly for "created by me" or "case assigned to me". Admins get every student account (including self-registered ones). Move this into one shared function so the logic sits in one place.
2. **Manual creation:** only admins may set a different creator; for team members it is always themselves.
3. **Invites:** the pending SQL file records the inviter as creator and fixes Tsukuyomi. No new SQL beyond that.
4. **Notes:** add a project rule saying the Students tab must stay scoped this way, with the reason.

## Tests (so it can't regress)
- Team member query: only includes "created by me" and "assigned to me"; never an unscoped list.
- Admin query: returns all students.
- Merging removes duplicates and a failed read shows an error, not an empty list.
- Manual creation: a team member's "created by" override is ignored; an admin's is kept.
- Invite trigger: a checklist query added to the database diagnostics file, to confirm every accepted student invite has its creator set.

## Technical details
- New `src/services/teamStudentsScope.ts` with `listScopedStudents({ userId, isAdmin })` plus `teamStudentsScope.test.ts` (mocked chainable client).
- `create-student-standalone`: `created_by = isAdmin ? (created_by ?? callerId) : callerId`; small unit test on the extracted helper.
- `TeamStudentsPage.tsx` calls the service instead of its inline queries.
- Rule appended to `AGENTS.md`; audit query appended to `supabase/diagnostics/invitation_reconciliation_audit.sql`.
- Then: typecheck, tests, and a browser check as Kheir once you've run the SQL.
