# Darb — Full Audit Report & Remediation Plan (v2)

Read-only audit, updated after business-model discussion with the owner. Nothing has been changed in the live app or database as of this version. Two live probes were run in v1 to confirm findings (one wrote a throwaway row into the activity log — still needs deletion in step 1).

## Business model context (new)
Darb is moving to a hub model with three actor types, not two:
1. Broad community referral partners — no case/document access, submit a lead, see their own commission status only.
2. Two lawyers (translation/notarization only) — task-scoped access to documents needing translation/notarization, no financial visibility, minimal client PII (only what's legally required for the notarized document itself).
3. Admin/team (the owner) — full case ownership, on-the-ground fulfillment, financials.
Any dashboard work from here on should be designed against these three scopes, not the old two-role assumption.

## CRITICAL
### C1. Anonymous users can dump every case record (confirmed live)
get_forgotten_cases, record_case_commission, request_payout, log_activity/log_user_activity, get_influencer_lead_ids all anon-executable. Fix: REVOKE EXECUTE FROM anon, public on all SECURITY DEFINER functions except insert_lead_from_apply and validate_influencer_ref; re-GRANT to authenticated/service_role only.

### C2. Three edge functions accept unauthenticated writes
send_welcome_email, send-branded-email, send-event-email — no auth check. Fix: require JWT + role check or shared internal secret header.

### C3. admin-weekly-digest returns business KPIs to anyone
No Authorization handling. Fix: admin JWT check or cron-only invocation with secret.

## HIGH
### H1. verify_jwt = false for 23 of 24 edge functions
Re-enable for all non-genuinely-public endpoints.

### H2. Users can rewrite their own payout requests
payout_requests UPDATE policy has no column restriction; combined with rewards "restore own rewards on cancellation" policy, creates a double-payout path. Fix: dedicated cancel-only RPC, drop self-service reward status flip.

### H3. Team members can reassign any case to themselves
cases policy WITH CHECK doesn't mirror USING clause. Fix: WITH CHECK (has_role(team_member) AND assigned_to = auth.uid()).

### H4. auth-guard login is broken
Undefined deviceId reference at auth-guard/index.ts:124. Fix or remove that audit field.

### H5. Two tables are RLS-enabled with zero policies
case_payments, case_service_snapshots — confirm intentionally server-only or write policies.

### H6 (NEW). PartnerPayoutsPanel bulk action can double-confirm a payout already in the formal request flow
In src/components/admin/PartnerPayoutsPanel.tsx, the partner grouping treats rewards with status 'pending' OR 'approved' as bulk-payable via "Pay All Pending" (onConfirmBulk uses group.pending, which includes 'approved' rows). Individually, 'approved' rows correctly show "Payout Requested — see Payout Requests tab" instead of a button — but the bulk button ignores that same distinction and will mark 'approved' rewards paid directly. That same reward is independently actionable via PayoutsManagement.tsx's "Pay" button on its linked payout_request. Both flows are password-gated, audit-logged confirmations that a real transfer happened — risk of the same commission being physically paid twice, even though app KPI totals stay internally consistent (both derive from rewards.status). Proposed fix: filter the bulk action to status === 'pending' only, matching the individual-row logic. Please verify against the actual code and confirm this reasoning before anyone fixes it.

## MEDIUM
M1. Raw DB errors returned to clients (14 functions) — log server-side, return generic message.
M2. No shared data layer — 61 files call Supabase directly; useDashboardData/dataService effectively unused (only consumer is dead code).
M3. God-components — 10 files over 700 lines each, mixing fetch/state/business logic.
M4. Dead code — orm.tsx src/ stray directory, TeamDashboardPage.tsx, StudentDashboardPage.tsx, PartnersPage.tsx, AdminDashboardPage.tsx (routeless), likely AdminOverview.tsx and DashboardErrorBoundary.tsx.
M5. Duplicated payout logic — PayoutsManagement.tsx and PartnerPayoutsPanel.tsx independently implement approve/reject/mark-paid. Now that H6 is identified, this consolidation should be designed around the three-actor model, not just merged for DRYness.
M6. Unoptimized images — 8.5MB in public/lovable-uploads, convert to WebP/AVIF.
M7. 325 `any` annotations — generated Database types available and unused in most offenders.

## LOW
L1. Wildcard CORS on every function including admin endpoints.
L2. No schema validation library in supabase/functions/*.
L3. Coarse error boundaries — public pages have no per-page boundary.
L4. manualChunks in vite.config.ts — verify vendor chunks only load on routes that need them.

## NEW — Role/access build-out (post-security-fix work)
R1. Lawyer task-queue view: documents awaiting translation/notarization, status flip (received to in progress to done), file upload for completed doc, "flag for review" escalation. No case list access, no financial visibility, minimal PII (only what's legally required per document).
R2. Referral-partner simplified interface: single "Send a referral" form (name, phone, interest), one visible commission total, plain-language status labels, tap-to-call/WhatsApp contact button, mobile-first RTL.
R3. Office/multi-seat partner model — deferred, lower priority than R1/R2 since the 2 current lawyers are task-scoped fulfillment, not referral partners.

## Clean bill of health (unchanged from v1)
No circular dependencies. Dashboard role separation is clean (no cross-role imports). No secrets in client code. Only one dangerouslySetInnerHTML (non-user-input). Admin routes properly gated with 2FA/AAL2. Most edge functions do verify JWT and check roles. Route-level code splitting is thorough.

## Data safety prerequisite (before any step below runs)
Confirm current Supabase plan tier and backup/PITR retention window. Take a manual pg_dump snapshot stored outside Supabase before Step 1 runs. Set up a recurring export of cases, case_payments, payout_requests, rewards, transaction_log, profiles independent of Supabase's own backup schedule.

## Proposed remediation order (v2)
0. Data safety prerequisite above.
1. Migration: revoke anon EXECUTE (C1), fix cases WITH CHECK (H3), tighten payout_requests/rewards policies (H2), resolve case_payments/case_service_snapshots (H5), delete forged audit-probe row.
2. Add auth checks to the three edge functions (C2), admin-weekly-digest (C3), flip verify_jwt back on (H1) — test each function individually after.
3. Fix PartnerPayoutsPanel bulk-action filter (H6) — isolated, can be done in parallel with 1-2.
4. Fix auth-guard deviceId (H4), sweep raw err.message responses (M1).
5. Cleanup: delete dead files (M4), consolidate payout panels around the three-actor model (M5, informed by H6), compress images (M6).
6. Build R1 (lawyer task queue) and R2 (referral-partner simplified interface).
7. Longer-term: dataService adoption or removal (M2), split god-components (M3), replace any with generated types (M7), R3 if/when needed.

Nothing in this plan should be implemented without explicit owner approval, step by step.

---

## Agent simulation notes

### (a) H6 reasoning — confirmed, and worse than described

The code matches the description exactly:

- `PartnerPayoutsPanel.tsx:362` — `if (r.status === 'pending' || r.status === 'approved') byPartner[uid].pending.push(r);` — the `pending` bucket is a union of both statuses.
- `:161` — `const isPayoutRequested = reward.status === 'approved';` — the per-row UI correctly suppresses the individual pay button for `approved`.
- `:487-491` — `onConfirmBulk={g => triggerConfirm({ ... rewards: g.pending })}` — the bulk path passes the whole union, `approved` rows included. `:391` then writes `status: 'paid'` to every one of them.

So yes: "Pay All Pending" pays rows the UI has just told the admin not to pay individually. The proposed fix (filter the bulk action to `status === 'pending'`) is correct as far as it goes.

Two additions the plan should carry:

1. **The bulk path leaves the payout_request orphaned.** `PartnerPayoutsPanel` only touches `rewards`. It never updates the linked row in `payout_requests`, and never writes to `transaction_log`. `PayoutsManagement.handleMarkPaid` (`:106-130`) does all three. So after a bulk pay of an `approved` reward, the `payout_request` still sits at `pending`/`approved` in the Payout Requests tab with a live "Pay" button, and there is no `transaction_log` entry for the money that just went out. The second click then writes a `transaction_log` row for a transfer that was really the first one. This is the actual double-payment mechanism — the reward status flip alone would be caught, the missing request-side write is what hides it.
2. **The two panels disagree on what "pending total" means.** `:428` sums `pending` + `approved` into `totalPending`, while `PayoutsManagement` treats `approved` as already-committed. The KPI headline is internally consistent within each panel but the two panels will show different outstanding-liability numbers for the same money. Worth resolving in M5 rather than patching twice.

### (b) platform_revenue_ils — formula and safety

Live definition, from `record_case_commission` (current version, `supabase/migrations/20260310110722_*.sql:10-85`):

```
v_admin_remainder := GREATEST(0, p_total_payment_ils - v_t_comm - v_total_partner);
UPDATE cases SET platform_revenue_ils = v_admin_remainder, commission_split_done = true WHERE id = p_case_id;
```

Where `v_t_comm` is the assigned team member's override (falling back to `platform_settings.team_commission_rate`) and `v_total_partner` is the sum over every row in `partner_commission_overrides` whose `show_all_cases` / `case.source` filter matches.

Arithmetic is integer-only with a `GREATEST(0, ...)` floor, so no float drift and no negative revenue. Idempotency is guarded by the early `IF EXISTS (... commission_split_done = true) THEN RETURN`. That part is sound.

**The input is not sound.** There are two callers passing two different amounts:

- Trigger `auto_split_payment` on `cases` AFTER UPDATE: reads `COALESCE(service_fee, 0)` from `case_submissions` and calls `record_case_commission(NEW.id, v_service_fee)`.
- Edge function `admin-mark-paid/index.ts:83-90`: calls the same RPC with the admin-supplied `total_payment_ils`, but only `if (total_payment_ils && total_payment_ils > 0)`.

`admin-mark-paid:64-69` sets `status = 'enrollment_paid'` first, which fires the trigger synchronously — so the trigger always wins, sets `commission_split_done = true`, and the explicit RPC call two statements later hits the idempotency guard and silently no-ops. **The `total_payment_ils` the admin types is discarded**; `platform_revenue_ils` is always derived from `case_submissions.service_fee`. If `service_fee` is 0 or unset at that moment, revenue is booked as 0 and can never be recomputed, because the guard is now latched. Note also the older superseded migration (`20260310125618`) calls the RPC with a literal `0` in one branch.

This isn't a security hole, but it means the financial KPIs in `MoneyDashboard.tsx:116-117`, `KPIAnalytics.tsx:53-54` and `AdminFinancialsPage.tsx:78-80` may be understating net revenue on any case where the fee wasn't captured on `case_submissions` before the status flip. Recommend adding a reconciliation query (cases with `status = 'enrollment_paid'` and `platform_revenue_ils = 0`) as a diagnostic before touching anything — `health-check/index.ts:98-103` already checks the inverse condition and could be extended.

### (c) Other money-related duplicate-write risks not in the plan

**The biggest one: `request_payout` is bypassed entirely by the student UI.** `RewardsPanel.tsx:96-107` inserts directly into `payout_requests` and then loops `rewards.update({ status: 'approved' })` client-side. It never calls the `request_payout` RPC. Every guard inside that RPC is therefore dead code in practice:

- ownership check (rewards belong to caller)
- all-rewards-are-`pending` check
- the 20-day lock
- the "not already in an active payout request" check
- atomicity — the insert and the status flips are separate round-trips, so a failure or a closed tab between them leaves rewards `pending` while a `payout_requests` row exists, i.e. the same rewards can be submitted a second time

This is the same class as H2 but strictly worse, because it needs no policy abuse at all — it's the app's own happy path. It should be folded into H2: the fix is to route the UI through `request_payout` and revoke the direct client `INSERT` on `payout_requests` / `UPDATE` on `rewards.status`.

**`RewardsPanel.cancelRequest` (`:115-128`)** is the mirror image: it flips the request to `rejected` and resets rewards to `pending` client-side. The `request_payout` "already in an active request" check excludes `rejected`, so a cancel-then-resubmit loop is unrestricted. Combined with the missing `WITH CHECK` in H2, a user can cancel, edit the amount, and resubmit.

**`ReferralManagement.tsx:55`** inserts `rewards` rows directly with a client-supplied `amount`, independent of `record_case_commission`. `:69` deletes them by `referral_id`. No idempotency key, so a double-click creates two rewards. Note that `record_case_commission`'s `INSERT ... ON CONFLICT DO NOTHING` is a no-op safeguard — there's no unique constraint on `rewards` for it to conflict against, so the *only* thing preventing duplicate commission rows is the `commission_split_done` latch.

**`admin-early-release/index.ts:44-60`** performs its own `rewards` status transition outside both payout panels. Third independent writer to the same column. Worth including in the M5 consolidation scope.

**`StudentCasesManagement.tsx:369-377`** also reads/writes `rewards`. Should be inventoried before consolidating.

### (d) What in steps 1-2 could break legitimate functionality

**Step 1 — revoking anon EXECUTE:**

- `log_activity` is called by `admin-mark-paid:92` via the service-role client. `service_role` keeps its grant, so this is fine — but note the call is already wrapped in a best-effort try/catch with a comment about FK failures on `actor_id`, so if it starts failing after the revoke it will fail silently. Worth removing the swallow at the same time.
- `log_user_activity` early-returns when `auth.uid()` is null, so it has no legitimate anon use. Safe.
- `record_case_commission` is invoked from the trigger (runs as the definer, unaffected) and from `admin-mark-paid` (service_role). Safe.
- `request_payout` currently has **zero callers** in the codebase (see (c)) — revoking anon is safe, and re-granting to `authenticated` is a prerequisite for the H2 fix, not a regression.
- `get_forgotten_cases` and `get_influencer_lead_ids`: need a check for which authenticated screens call them before the revoke, so the re-grant to `authenticated` is scoped correctly.

**Step 1 — tightening `payout_requests` / `rewards` policies:** this will break `RewardsPanel`'s request and cancel flows immediately, because as established they write those tables directly. The migration and the `RewardsPanel` rewrite must ship together, or students lose the ability to request a payout. This is the single most likely way step 1 causes a visible outage.

**Step 1 — `cases` WITH CHECK:** if any existing team-side flow legitimately creates or reassigns a case with `assigned_to` set to someone else (e.g. `SubmitNewStudentPage`, or an admin-initiated reassign that runs under a team member's session), the tightened check will reject it. Needs a grep of every `cases` insert/update outside admin edge functions before the migration runs.

**Step 1 — `case_payments` / `case_service_snapshots`:** currently unreachable through the API, so nothing can regress. Confirm they're genuinely server-only before writing permissive policies "to fix" them — adding policies could expose data that is currently closed by accident but closed nonetheless.

**Step 2 — flipping `verify_jwt` back on:** the risk is the public endpoints. `create-case-from-apply` (the apply form), `send-email` (contact form), `get-exchange-rate`, `ai-chat` (anonymous chat is intentional, JWT only raises the rate limit), and `auth-email-hook` (HMAC-verified webhook, no JWT) must all stay `false`. Turning it on for any of those breaks the public site. `auth-guard` is a login endpoint and must also stay `false` — the caller has no JWT yet by definition.

**Step 2 — auth on the three email functions:** `notify_visa_status_email` (trigger on `profiles`) calls `send-event-email` via `pg_net` with `Authorization: Bearer <service_role_key>` read from `current_setting('app.settings.service_role_key')`. If that setting isn't populated in this project, the header is currently empty and the call only works *because* the function has no auth check. Verify that setting resolves before adding the check, or the visa-status email trigger will start failing silently.

---

## Money-flow deep dive (live database, read-only)

Queried the live database directly. Findings below are from actual rows, not code reading.

### The financial tables are essentially empty

| Table | Rows |
|---|---|
| cases | 0 |
| case_submissions | 0 |
| case_payments | 0 |
| rewards | 0 |
| commissions | 0 |
| commission_transactions | 0 |
| referrals | 0 |
| partner_commission_overrides | **0** |
| team_member_commission_overrides | 2 |
| payout_requests | 1 |
| transaction_log | 1 |

Good news for sequencing: **step 1 and step 2 can be executed with essentially zero data-loss risk.** There is no production financial history to corrupt. The `pg_dump` prerequisite is still worth doing, but it should not gate the security fixes — the exposure in C1 is live on a published site while the data at risk is nearly nil. Recommend reordering: run steps 1-2 now, build the backup discipline in parallel rather than before.

### M8 (NEW, HIGH). `record_case_commission` pays every partner on every case

This is the most serious money bug found, and it is not in the plan above. The partner loop in the live function is:

```sql
FOR v_override IN
  SELECT partner_id, commission_amount, show_all_cases
  FROM partner_commission_overrides
LOOP
  IF (v_override.show_all_cases = true
      OR (v_override.show_all_cases = false AND v_case.source IN ('apply_page','contact_form','submit_new_student','manual'))
      OR (v_override.show_all_cases IS NULL AND v_case.source = 'referral'))
  THEN ... INSERT INTO rewards (user_id, amount, ...) VALUES (v_override.partner_id, ...)
```

It iterates **every row in `partner_commission_overrides`** and filters only on `cases.source`. There is no comparison against `v_case.partner_id` or `v_case.referred_by`. So the partner who actually referred the case is never identified — instead, once N partners have override rows, a single enrolled case mints N reward rows, one per partner, and `v_total_partner` deducts all of them from `platform_revenue_ils`.

Today this is invisible because `partner_commission_overrides` is empty, which also means **partner commissions are currently never created at all** — the referral-partner earnings path is dormant. The moment the hub model in R2 onboards a second referral partner, every case starts paying both of them. This must be fixed before R2 ships, and it should be a named step, not folded into M5.

Related: `platform_settings.partner_commission_rate` is 500 but is read nowhere in `record_case_commission` — only `team_member_commission_rate` (1500) is used as a fallback. The partner rate setting is decorative.

Also note the two `team_member_commission_overrides` rows are both 1500, identical to the global `team_member_commission_rate`, so they're currently no-ops.

### M9 (NEW, MEDIUM). Deleting a user orphans paid financial records

The one surviving `payout_requests` row is instructive:

- `id ee2f9700…`, `amount 1000`, `status paid`, `requestor_role social_media_partner`
- `linked_reward_ids = {96bb9c4f…}` — **that reward no longer exists**; the `rewards` table is empty
- `requestor_id 81f7f86b…` — **not present in `user_roles`**; the partner was purged
- matching `transaction_log` row for ILS 1000, `type influencer_payout`, same `payout_request_id`

`linked_reward_ids` is a bare `uuid[]` with no foreign key, and `requestor_id` has no FK either. `selective-delete/index.ts:259` and `purge-account/index.ts:87` delete `rewards` by `user_id` without touching `payout_requests` or `transaction_log`. Result: a permanent record of ILS 1000 paid, to a user that no longer exists, backed by a reward that no longer exists, and no query can reconstruct what it was for.

For a financial ledger this is the wrong deletion semantics. Recommend: soft-delete or anonymise rather than hard-delete anything reachable from `transaction_log`, and add an FK or a validation trigger on `payout_requests.requestor_id`.

### Timing evidence supporting the H2 / RewardsPanel finding

That same request was `requested_at 12:32:01` and `paid_at 12:42:09` — ten minutes end to end, with `approved_at` and `paid_at` nine seconds apart. `request_payout`'s 20-day lock (`(NOW() - created_at) < INTERVAL '20 days'` → raise) could not possibly have passed for a reward created that morning. This is direct evidence that the payout was created outside the RPC, consistent with the finding in (c) that the UI inserts into `payout_requests` directly. Whether this specific row came from the partner UI or manual test insertion can't be determined from the row alone, but the lock demonstrably did not apply.

### Minor

`transaction_ref` is an empty string rather than null on both the request and the ledger row — `PayoutsManagement.handleMarkPaid` passes the raw input with no required-field check, so a bank transfer can be recorded with no reference number. Worth a validation guard when M5 consolidates the panels.

The admin account `4abfba8f…` holds **both** `admin` and `student` roles. Harmless today, but any policy written as "students can only see their own X" will also apply to the admin, and any future `has_role(uid,'student')`-gated UI will render for them. Worth cleaning up before the three-actor role work in R1/R2.

### Revised view on the remediation order

1. Steps 1-2 (C1, C2, C3, H1, H2, H3, H5) — run now. Near-zero data at risk; the exposure is live.
2. Fold M8 into the same migration window as H2 — both are `rewards`-creation correctness, and both must be right before any real partner is onboarded.
3. Backup/PITR discipline (step 0) becomes a parallel workstream, not a blocker.
4. M9 (deletion semantics for financial records) should land before real money flows, not in the general cleanup pass.

