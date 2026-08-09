# DARB — Account Isolation Incident (Emergency Batch)

## What actually happened

Verified from the code and the live database. This is not a cascade in the database — it is an application-level identity collision.

1. `tsukuyomidomain00@gmail.com` already existed as a Partner: one row in `auth.users`, one row in `profiles` (same id), one row in `user_roles` with `social_media_partner`.
2. The Team invitation was sent to the same email. `invite-account` only blocks re-inviting an email that already holds **the same** role — a different role passes through.
3. On activation, `accept-invitation` found the email already existed in auth, so it **reused the same auth user**, overwrote its password, and *added* `team_member` to `user_roles`. No second account was created. One identity now held two roles.
4. The admin list showed that identity as a Team member. Delete in `src/pages/admin/AdminTeamPage.tsx` runs:
   - `user_roles.delete().eq('user_id', id)` — no `.eq('role', ...)`, so it deletes **every** role that identity holds, including `social_media_partner`;
   - `profiles.update({ deleted_at: now }).eq('id', id)` — soft-deletes the single shared profile.

So deleting "the Team account" deleted the only profile and all roles of the Partner, because they were literally the same account.

## Architecture as it exists today

```text
auth.users (authoritative identity)
   └─ profiles (id = auth.users.id, 1:1, ON DELETE CASCADE)
        └─ user_roles (user_id, one row per role — many allowed)
             └─ business records keyed by user id
                (cases.partner_id / assigned_to / student_user_id,
                 partner_links, commission_transactions, payout_requests, documents…)
```

There are **no** role-specific account tables — no partner table, no team table. Role is a row in `user_roles`. Foreign keys to `auth.users` do cascade (`profiles`, `user_roles`, `documents`, `payments`, `partner_links`, `referrals`, `services`…), but nothing in this incident deleted an `auth.users` row, so those cascades were not involved.

Answer to Step 3: **Option C — the system mixes both.** The schema permits multiple roles per identity (Option A), while the UI, routing and delete logic assume one role per identity (Option B).

## Decisions taken

- **One identity = one role.** Enforced in the database, not just the UI.
- **Delete = deactivate the whole person.** Login blocked, profile hidden, all historical cases/financial/commission records preserved.

## Current data state (checked)

Four accounts only, no duplicate emails, no multi-role identities:

| Email | Role | Deleted |
|---|---|---|
| ranimdwahde3@gmail.com | admin | no |
| Kheir.adv@gmail.com | team_member | no |
| royan379@gmail.com | social_media_partner | no |
| tsukuyomidomain00@gmail.com | social_media_partner | no |

The demo Partner was already recovered in the previous batch (deleted_at cleared, partner role restored). No production data is currently corrupted; no migration of existing rows is needed.

## The fix

### 1. Database — make the bug structurally impossible
- Unique index on `user_roles(user_id)` so an identity can never hold two roles. Backfill check first (currently clean).
- `profiles.status` semantics: keep `deleted_at` as the deactivation marker, add `deactivated_by` and `deactivated_reason`.
- New security-definer RPC `admin_deactivate_account(target_id, reason)`:
  - admin-only;
  - refuses to touch the caller's own account and refuses the last remaining admin;
  - sets `deleted_at`, records the role it revoked into `deletion_logs`, deletes only that identity's single role row;
  - never touches `auth.users`, never deletes cases, payments, commissions or documents;
  - idempotent — a second call on an already-deactivated account is a no-op success (Step 29).
- New RPC `admin_reactivate_account(target_id, role)` so an accidental deactivation is reversible.
- New read-only RPC `check_identity_conflict(email)` returning `{ exists, user_id, role, deleted }` for the invite guards.

### 2. Invitation and creation guards (Steps 11–13, 19)
- `supabase/functions/invite-account/index.ts`: before creating any invitation, resolve the email. If it already belongs to an identity with **any** role, return `409` with a structured payload (`existing_role`, `deactivated`) instead of the current same-role-only check.
- `supabase/functions/accept-invitation/index.ts`: remove the silent "reuse the existing auth user and reset its password" path. If the email already maps to an identity holding a different role, abort with `identity_conflict` and leave the invitation pending. Password overwrite of an existing account from an invitation link is removed entirely.
- Same guard applied to the manual-creation path and to `create-student-*` / `create-influencer` / `create-team-member` functions.
- Admin UI shows the conflict clearly in Arabic and English: "هذا البريد مرتبط بالفعل بحساب شريك — لا يمكن إنشاء حساب فريق بنفس الهوية. استخدم بريدًا آخر أو عطّل الحساب الحالي أولًا." with an offer to reactivate/convert instead.

### 3. Admin UI — explicit destructive action (Steps 14, 27, 28)
- `AdminTeamPage.tsx` and `AdminStudentsPage.tsx` stop writing to `user_roles` / `profiles` directly; both call `admin_deactivate_account`.
- Confirmation dialog spells out, per account: name, email, current role, **what is removed** (login access, dashboard access, role) and **what is kept** (cases, payments, commissions, referral history, documents). Requires typing the account email to confirm.
- Delete button disables while in flight; the RPC is idempotent so a double click cannot half-delete.
- Every deactivation/reactivation writes to `admin_audit_log` and `deletion_logs`: admin id, target, role, action, timestamp, result. No secrets.

### 4. Master partner and student relationships (Steps 17, 18)
- `profiles.master_partner_id` is `ON DELETE SET NULL` and deactivation does not delete rows, so recruited partners survive; recruitment attribution is retained in `partner_recruit_applications`.
- Student deactivation leaves `cases`, `case_payments`, `commission_transactions` untouched per the retention rules.

## Testing

Automated (`e2e/` + vitest) covering the Step 30 matrix:
- deactivate Team → Partner login, dashboard, cases, commissions, referral link all intact;
- deactivate Partner → Team intact;
- deactivate Master Partner → recruited Partner intact and still attributed;
- deactivate Student → Partner/Team/Admin and all financial rows intact;
- collision matrix: Partner email + Team invite, Team email + Partner invite, Student email + Partner invite, Partner email + Student invite — each must return a blocked conflict, create nothing, and delete nothing;
- double-click delete; deactivated user login attempt; reactivation restores exactly one role;
- RLS regression suite re-run for all five roles;
- foreign-key/orphan sweep after the migration.

Tests run against freshly created demo identities only. No real account is deleted at any point.

## Technical notes

- Files touched: `supabase/functions/invite-account/index.ts`, `supabase/functions/accept-invitation/index.ts`, `supabase/functions/create-team-member/index.ts`, `supabase/functions/create-influencer/index.ts`, `supabase/functions/create-student-*/index.ts`, `src/pages/admin/AdminTeamPage.tsx`, `src/pages/admin/AdminStudentsPage.tsx`, new confirmation dialog component, locale files, one migration, new e2e spec.
- No `auth.users` row is ever deleted by admin actions after this change.
- Email stops being usable as an implicit account relationship: all linking is by `user_id`; email is only used for the conflict lookup, which blocks rather than links.

## Status

**BLOCKED — production release must stop** until this batch ships. Until then, an admin deleting a team member can still wipe every role and the profile of a colliding identity.
