# Darb — Master Partner (network override) — design plan

Planning only. No code written yet. Everything below is additive to the existing
partner architecture; nothing in `COMMISSION_RULES.md` changes.

## What I verified in the codebase first

- **The "upgrade" pattern already exists and is a boolean, not a role.** Team Member → Manager
  is `profiles.is_manager boolean not null default false`, flipped by a switch in
  `AdminTeamPage.tsx` (a plain `profiles` update), and read by `get_staff_directory()` /
  the direct-message guard. There is no `manager` value in the `app_role` enum.
  Master Partner should follow exactly this shape.
- **Commission is written by `record_case_commission(case_id, total_payment)`**, called once
  by `auto_split_payment` when a case reaches `enrollment_paid`, guarded by
  `cases.commission_split_done`. It pays the team member (`cases.assigned_to`) and the one
  referring partner (`cases.partner_id`), then sets
  `platform_revenue_ils = total − team − partner`.
- **`rewards` has no type column** (`user_id, referral_id, amount, currency, status,
  payout_requested_at, paid_at, admin_notes, created_at, case_id`). Today the only way to
  tell a team commission from a partner commission is the free-text `admin_notes` — which
  `COMMISSION_RULES.md` §6 explicitly says must never be used for lookups. A network
  override reward would be indistinguishable from a base referral reward. This is the main
  schema gap the feature has to close.
- **Referral link infra exists and is reusable**: `partner_links(partner_id, code, label,
  target_path, active)` + `resolve_partner_link(code)` + `partner_clicks`, and
  `leads.partner_link_id` / `cases.partner_link_id` carry attribution through
  `/apply`. `target_path` is per-link, which is exactly the hook a recruit-a-partner link
  needs (it points at the partnership signup instead of `/apply`).
- **Payout plumbing is user-scoped, not reward-type-scoped**: `get_my_payout_preview()` and
  `list_partner_directory()` aggregate `rewards` by `user_id`, so override rewards flow
  through the existing 20-day hold and `admin_respond_payout_request()` with no changes —
  as long as they are rows in `rewards`.
- Rates live in `platform_settings` (`partner_commission_rate`, `team_member_commission_rate`,
  `ambassador_commission_rate`), so a configurable override amount belongs there.

## 1. Data model

**Role flag (no new `app_role`)**

```
profiles.is_master_partner   boolean not null default false
profiles.master_partner_id   uuid null references profiles(id) on delete set null
```

- `is_master_partner` mirrors `is_manager`. The user keeps `user_roles.role =
  'social_media_partner'`, so **every existing row keeps pointing at the same account**:
  rewards, payout_requests, partner_links, referral_code, cases.partner_id, chat threads.
  The upgrade is a single boolean flip — there is no new user, no re-issued code, nothing
  to migrate, and it is reversible.
- `master_partner_id` is set on the *recruited* partner and is the only network edge.
  Guard rails: a master partner may not have a `master_partner_id` (no multi-level / MLM
  depth), self-reference rejected, and the value is immutable to the partner (admin-only
  write via RLS + a `restrict_profiles_write` addition).

**Override amount (configurable)**

```
platform_settings.master_partner_override_rate  integer not null default 200
```

Optional per-person override, reusing the existing pattern:
`partner_commission_overrides` already exists per partner; add a nullable
`master_override_amount` there rather than inventing a second overrides table. Resolution
order stays "per-person override wins, else global default", identical to
`COMMISSION_RULES.md` §3.

**Distinguishing the override reward (required)**

```
rewards.reward_type      text not null default 'referral'
        -- 'referral' | 'team' | 'master_override'
rewards.source_user_id   uuid null references profiles(id)
        -- for 'master_override': which recruited partner generated it
```

Backfill: `reward_type` derived once from `admin_notes` in the migration, then
`admin_notes` returns to being a label only. `source_user_id` is what makes
"₪X earned from partner Y" possible on the master dashboard without parsing text.

**Where the override is calculated**

Inside `record_case_commission`, after the existing partner block, in the same
idempotent transaction:

```
if v_case.partner_id is not null then
  v_master := (select master_partner_id from profiles where id = v_case.partner_id);
  if v_master is not null and v_master <> v_case.partner_id then
    v_override := coalesce(per-person override, platform_settings.master_partner_override_rate, 0);
    if v_override > 0 then
      insert into rewards (user_id, amount, status, case_id, reward_type, source_user_id)
      values (v_master, v_override, 'pending', p_case_id, 'master_override', v_case.partner_id);
    end if;
  end if;
end if;

platform_revenue_ils = greatest(0, total − team − partner − override);
```

Network scoping is structural: the override only fires when the case's own
`partner_id` has `master_partner_id = v_master`. No company-wide leakage is possible.
`commission_split_done` still guards double-pay.

Worked example at current rates: 4000 − 1500 team − 1000 partner − 200 override = **1300**
to Darb. No partner or team amount is touched.

**Snapshotting**: the override amount is resolved at split time and stored on the reward
row, so later changes to the setting never rewrite history.

## 2. Invite-link self-service signup

Reuse `partner_links`, do not build a parallel system.

1. A master partner gets (or creates) a link row with
   `target_path = '/partnership?ref=<code>'` and a `label` marking it as a recruitment
   link. Add `partner_links.purpose text not null default 'student'` with
   `'student' | 'recruit'` so a recruit link is never mistaken for a student referral link
   and never attributes a student to the master directly.
2. `/partnership` reads the code, calls the existing `resolve_partner_link(code)`
   (extended to return `purpose` + `is_master_partner`), shows "You were invited by
   {name}", and stores the code the same way `ApplyPage` stores its ref.
3. The partnership application is submitted with the recruiter code attached
   (`contact_submissions` / partnership inbox row gains `recruiter_partner_id`).
4. Admin approves the application in the existing Inbox and creates the partner through
   `create-influencer`; the function accepts `recruiter_partner_id` and writes
   `master_partner_id` on the new profile. **Admin approval stays mandatory** — a master
   partner must not be able to mint accounts, per the ownership principle.
5. Until approval the recruit shows as **pending** in the master's network list, sourced
   from the partnership submission; after approval it becomes **active**, sourced from
   `profiles.master_partner_id`.
6. Clicks on recruit links keep landing in `partner_clicks`, giving the master a
   funnel (clicks → applications → active partners).

## 3. Master Partner dashboard

Same shell as today (`PartnerDashboardLayout` → `DashboardLayout`), with extra nav items
rendered only when `is_master_partner`. The existing partner pages stay untouched, because
a master is still a normal partner for his own referrals.

```text
/partner  (existing)            Overview · My students · Earnings · Messages
/partner/network   (new)        Network      — recruited partners: name, joined,
                                               status (pending/active), students referred,
                                               cases paid, override earned from them
/partner/network/:id (new)      Partner detail (read-only) — that recruit's cases at
                                               reference/stage level only, no student PII
/partner/performance (new)      Performance  — funnel: recruit-link clicks → applications
                                               → active partners → paid cases; trend by month
/partner/earnings  (extended)   Earnings     — two clearly separated blocks:
                                               "My referrals" (reward_type='referral')
                                               "Network override" (reward_type='master_override',
                                                grouped by source_user_id)
                                               One combined payout balance + one request flow
/partner/network/invite (new)   Management   — recruit link + QR/copy, click count,
                                               announce-to-network composer
```

- **Read-only everywhere** except: creating/deactivating his own recruit link, and sending
  an announcement. No case editing, no student data, no payment records — Darb owns those.
- **Announcements** reuse `direct_threads` / `send_direct_message`: a "notify my network"
  action fans a message out to each active recruit. The direct-message guard currently
  requires an admin or manager in the thread — it needs one more allowance: a master
  partner may be a party to a thread with his own recruits. Recruits still cannot message
  each other.
- **Earnings never mix**: separate KPI cards and separate lists, one payout request. The
  20-day hold, `get_my_payout_preview()` and `request_payout_via_chat()` need no change
  once override rows exist in `rewards` — the preview should just surface `reward_type` so
  the request dialog can label each line.

## 4. Interaction with the Phase 1 Partner directory work

- `list_partner_directory()` gains `is_master_partner`, `master_partner_name`,
  `recruited_count`, and splits `total_earned` into `earned_referral` /
  `earned_override`. It already filters to `social_media_partner`, so masters appear
  automatically — no ambassador change.
- `PartnersDirectory.tsx`: a "Master" badge on the row, a **Masters** quick-filter next to
  the existing All / Pending requests / Has balance / Settled filters, and an optional
  "recruited by" column so admin can see network shape from the list.
- `PartnerProfilePanel.tsx`: for a master, a **Network** block listing recruited partners
  with each one's contribution, and the earnings KPIs split referral vs override. For a
  recruited partner, a "Recruited by {master}" line linking to that master's profile.
- **The upgrade control lives here** — a "Master Partner" switch on the profile panel,
  exactly like the manager switch in `AdminTeamPage`, plus admin-only reassignment of
  `master_partner_id` (audit-logged in `admin_audit_log`).
- Payout review is unchanged: everything still goes through
  `admin_respond_payout_request()`; override rewards are just more rewards.

## 5. COMMISSION_RULES.md

Base rates are untouched: team ₪1500, partner ₪1000, per-person override beats global
default, one partner per case, `commission_split_done` idempotency, 20-day lock. The
document needs one **added** section — "§8 Master Partner network override" — describing
the new layer and restating the revenue formula as
`platform_revenue = max(0, service_fee − team − partner − master_override)`.
No existing line is edited or removed.

## Risks / decisions to confirm

1. **Single level only** — a master cannot be recruited by another master. Assumed; say so
   if you want depth later, because it changes the schema (edge table instead of a column).
2. **Retroactivity** — the override applies only to cases split *after* the recruit is
   attached. Existing paid cases are not back-paid. Assumed.
3. **Downgrade** — flipping `is_master_partner` off stops future overrides and hides the
   network UI; already-earned override rewards remain payable, and recruits keep their
   `master_partner_id` unless admin clears it.
4. **What a master sees of a recruit's cases** — planned as reference + stage + amount only,
   no student name, phone or documents. Tell me if he should see student first names.

## Build order (once approved)

1. Migration: profile columns, `platform_settings` rate, `rewards.reward_type` +
   `source_user_id` + backfill, `partner_links.purpose`, RLS/write guards.
2. `record_case_commission` override layer + tests for the 4000/1500/1000/200/1300 case.
3. Admin: directory + profile panel upgrade switch, network block, split earnings.
4. Recruit link → partnership signup → `create-influencer` attachment.
5. Master dashboard pages (Network, Performance, split Earnings, Announce).
6. `COMMISSION_RULES.md` §8, AR/EN translations, E2E: upgrade preserves all history.
