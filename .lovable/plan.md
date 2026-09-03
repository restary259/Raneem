# Payout Request Flow — Role-Based Audit Report

Scope: audit only. No code changed. Source of truth = latest migration per object + current frontend. The hosted database is paused right now, so `pg_policies` / live function bodies could not be queried; every finding below is from the repo and must be re-confirmed live before fixing (step 0 of the fix plan). Migration drift has happened before in this project (see `confirm_german_finance_item`), so this matters.

## A. Flow map (as implemented)

```text
Case reaches enrollment_paid (admin-mark-paid)
  -> trg auto_split_payment -> record_case_commission (SECURITY DEFINER, service_role only)
     inserts rewards rows: status='pending', unlock_at = now()+20d, one per (case_id,user_id,reward_type)
     reward_type: team | referral (partner/ambassador) | agent_self_referral | agent_override | student_referral

User side
  Partner/Ambassador/Agent : DirectMessages composer "Request payout" (isPartner gate)
  Student                  : CaseMessages composer "Request payout" (isStudent gate)
  Team member              : NO UI ENTRY POINT (see B-1)
    -> PayoutRequestDialog shows get_my_payout_preview() (server-computed)
    -> requestPayoutViaChat() -> RPC request_payout_via_chat(p_notes)
         auth.uid() only; role from user_roles; advisory lock per user;
         rejects if a pending request exists; sums ONLY own pending rewards with
         unlock_at <= now() not already in a non-rejected request;
         INSERT payout_requests (status='pending', thread_id) ; rewards.payout_requested_at
         posts card message into the admin direct thread (kind='payout_request')

Admin side
  /admin/payouts -> PayoutsManagement -> list_payout_requests() (admin-gated SQL)
    -> RoleDirectory (get_members_directory) -> RequesterProfilePanel
    -> ApproveModal / RejectModal / MarkPaidModal -> usePayoutActions.respond()
    -> RPC admin_respond_payout_request(id, approve|reject|pay, note, ref)
         has_role(admin) ; SELECT ... FOR UPDATE ; idempotent
         approve: pending->approved, rewards pending->approved
         pay    : pending|approved -> paid via confirm_payout_batch (rewards->paid, transaction_log)
         reject : pending|approved -> rejected, rewards back to pending, payout_requested_at=NULL
         posts status message to thread, updates card request_status, admin_audit_log
  Chat card (PayoutRequestCard) offers the same three actions -> same RPC
  Team early release: TeamEarlyReleaseCard -> get_member_locked_rewards / admin_early_release_rewards
    (team_member only, password re-auth in UI, creates an already-'paid' payout_requests row)

Notifications: trg_payout_status_notify (notifications row) + chat message from the RPC.
Realtime: payout_requests and rewards are in supabase_realtime; partner/agent/admin pages refetch on change.
```

## B. Role matrix (actual)

| Role | Request | View own | View all | Approve | Reject | Mark paid |
|---|---|---|---|---|---|---|
| Admin | RPC allows (no UI) | yes | yes (list_payout_requests + RLS FOR ALL) | yes | yes | yes |
| Team | RPC allows, **no UI** | RLS self-read; TeamAnalyticsPage shows balance | no | no | no | no |
| Agent | yes (DirectMessages) | yes | no | no | no | no |
| Partner | yes | yes | no | no | no | no |
| Ambassador | yes | yes | no | no | no | no |
| Student | yes, intentionally (student_referral rewards, migration 20260817050000) | yes | no | no | no | no |

Server-side enforcement: identity = `auth.uid()`; amount = SUM of own rewards; status transitions only inside admin RPCs; no user INSERT/UPDATE/DELETE policy on `payout_requests` or `rewards`. Self-approval is impossible for non-admins (has_role admin check inside RPC, not UI).

## C. Security findings

**C-1 Medium — legacy `request_payout(uuid[], numeric, text, text, text, text[])` is still granted to `authenticated`.**
File: `20260809163608` (def), `20260806001221` (grant). Not called by any frontend file. It stores the client-supplied `p_requestor_role` (default `'influencer'`) verbatim into `payout_requests.requestor_role`. Amount is server-computed (safe), ownership/lock/duplicate checks are present, but a user can (a) spoof their role so the request lands in the wrong admin directory or in none (`influencer` matches no tab, so it becomes invisible to admins), (b) bypass the chat card. Fix: `REVOKE EXECUTE ... FROM authenticated` (or drop) — keep `service_role` if anything else needs it (nothing found).

**C-2 Medium — admin payout RPCs do not enforce the AAL2 rule the RLS layer now enforces.**
`admin_respond_payout_request`, `confirm_payout_batch`, `admin_early_release_rewards`, `get_member_locked_rewards`, `list_payout_requests` gate on `has_role(uid,'admin')` only. The 2FA hardening (`is_admin_session()`) was applied to policies, but SECURITY DEFINER RPCs bypass RLS, so an admin session that has not completed MFA can approve/pay by calling the RPC directly. Fix: swap `has_role(...,'admin')` for `is_admin_session()` inside these functions.

**C-3 Low — dead `admin-early-release` edge function is deployed and admin-callable.**
`supabase/functions/admin-early-release/index.ts`, no frontend caller. Matches rewards by `admin_notes LIKE %case_id%` (notes contain the case *reference*, so it normally matches nothing), marks rewards paid without checking existing payout requests, no idempotency, no audit log. Fix: delete the function (superseded by `admin_early_release_rewards`).

**C-4 Low — `admin_early_release_rewards` does not exclude rewards already in an open payout request.**
UI only lists locked rewards, but the RPC accepts any pending reward id of the member. An unlocked reward that sits in a pending request can be early-released (reward -> paid) and then the pending request is later paid too (request amount still includes it) = double payment of that reward. Also no per-user advisory lock, so it can race with `request_payout_via_chat`. Fix: add the same `NOT EXISTS (... linked_reward_ids && ARRAY[r.id] AND status <> 'rejected')` filter and `pg_advisory_xact_lock('payout_request:'||member)`.

No Critical findings. Verified safe: amount tampering (ignored/derived), cross-user create/read/update (no policy; RPC checks ownership), status tampering (no UPDATE policy; transitions inside RPC with FOR UPDATE), double approve/pay (idempotent early returns), duplicate submit / two tabs (advisory lock + `uniq_pending_payout_per_requestor` partial unique index), students messaging outside their payout thread (`send_direct_message` gate).

## D. Business-logic findings

**D-1 High — team members cannot request a payout, and unlocked team rewards cannot be paid by any UI.**
`DirectMessages.tsx:244` exposes "Request payout" only for `isPartner` (partner/ambassador/agent); `CaseMessages.tsx:262` only for students. The RPC allows `team_member`, but no button calls it. The admin early-release card lists only rewards with `unlock_at > now()`; once a team reward unlocks it disappears from that card. Result: a team commission that has cleared the 20-day hold is stuck (visible as "Available" on TeamAnalyticsPage, unpayable). Fix options (needs your choice): (a) show the request button to team members in their direct thread with admin, or (b) let the early-release card list all pending team rewards (locked + unlocked), or both.

**D-2 Medium — PartnerEarningsPage per-case status is wrong for ambassadors and for every case.**
`.like("admin_notes","Partner commission from case%")` excludes ambassador rewards (notes start with "Ambassador commission…", engine `20260818000000`). `getCaseRewardInfo` matches `admin_notes.includes(caseId)` but notes contain the case *reference*, not the UUID, so the badge falls back to "Projected" for paid/locked cases. It also recomputes the lock from `created_at + 20d` instead of `unlock_at`. Balances (KPIs) are correct because they come from `get_my_earnings_summary`; only the per-case badges/list are wrong. Fix: filter by `reward_type IN ('referral')` or `recipient_role`, match on `case_id`, use `unlock_at`.

**D-3 Low — client-side lock recomputation in `sheetQueries.ts:298`** (`created_at + 20d`) ignores `rewards.unlock_at` (early-released rows show as still locked in the admin spreadsheet). Use `unlock_at`.

**D-4 Low — MarkPaidModal payment method is not persisted.** The chosen method is only concatenated into the note; the RPC pays with `COALESCE(v_req.payment_method,'bank_transfer')`. Cosmetic/reporting inaccuracy. Fix: pass `p_payment_method` through (RPC signature change) or accept as-is.

**D-5 Ambiguity — lock period.** Your brief mentions a 10-day lock for agents. The codebase, engine, RPCs, docs and copy implement a single 20-day lock for every role (`unlock_at = now()+20d`, checked server-side in `request_payout_via_chat`, `get_my_payout_preview`, `get_my_earnings_summary`). No role-specific lock exists. Flagging, not changing.

**D-6 Ambiguity — `min_payout_threshold` (100 NIS) exists in `eligibility_config` but is enforced nowhere.** No minimum payout is applied (matches the agent guide "no minimum payout"). Flagging only.

**D-7 Info — "pending -> paid" is an allowed transition** (approve step optional). Deliberate in code and UI ("Mark paid" shown for pending). Not a bug, but note it in the state machine below.

## E. RLS summary (from migrations; confirm live)

| Table | SELECT | INSERT | UPDATE | DELETE | Admin |
|---|---|---|---|---|---|
| payout_requests | `requestor_id = auth.uid()` (Users read own) | none for users | none for users (cancel policy dropped 20260806001221) | none | FOR ALL via `is_admin_session()` (two overlapping admin policies: "Admins can manage…" + "Admins manage…") |
| rewards | `auth.uid() = user_id` | none for users (dropped) | none for users | none | "Admins can manage rewards" FOR ALL + legacy "Admins can update/insert/view" (redundant duplicates) |
| transaction_log / admin_audit_log | admin only | admin only (RPCs write as definer) | — | — | ok |
| direct_messages (payout cards) | thread participants | via `send_direct_message` RPC only | — | — | — |

Nothing missing or overly permissive for non-admins. Duplicate admin policies are harmless but could be consolidated (optional, not recommended to touch now).

## F. State machine

```text
pending --approve--> approved --pay--> paid
pending ----------------pay----------> paid
pending --reject--> rejected
approved --reject--> rejected      (rewards restored to pending)
paid  : terminal (reject raises; pay/approve are no-ops)
rejected: terminal (approve raises; pay raises; rewards re-requestable)
```
All enforced inside `admin_respond_payout_request`/`confirm_payout_batch`; no client path can change `status`.

## G. Edge cases

- Duplicate submit / two tabs / retry: handled (advisory lock + partial unique index + "already have a request" error).
- Reject then re-request: handled (rewards return to pending, rejected requests ignored by preview).
- Reward paid twice via approve+pay repeats: handled (idempotent).
- Early release of a reward already in a pending request: NOT handled (C-4).
- Team reward after unlock: NOT reachable (D-1).
- Multiple roles per user: `user_roles LIMIT 1` without ORDER BY in `request_payout_via_chat` (one-role model makes this moot; note only).
- Timezone: all comparisons are `timestamptz` vs `now()` server-side; no early-unlock risk.
- Notifications: a status change produces both a `notifications` row (trigger) and a chat message + chat notification. Likely two alerts per event — confirm live whether `send_direct_message` also inserts a `notifications` row before treating as duplicate.

## H. Overall result

**PASS WITH FIXES.** The money path is server-authoritative (identity, amount, lock, ownership, transitions, idempotency, audit) and no non-admin can read, create for others, modify or approve payouts. Material gaps are functional (team members cannot get paid after unlock) and hygiene/defence-in-depth (legacy RPC still callable with client-supplied role, admin RPCs not MFA-gated, dead edge function, one double-pay corner in early release, wrong per-case badges for ambassadors).

## Proposed fix plan (after your approval)

0. Resume the backend and re-verify live: `pg_policies` for both tables, `pg_get_functiondef` for the 7 payout RPCs, grants on `request_payout`.
1. Migration: revoke `request_payout` from authenticated (C-1); switch admin payout RPC gates to `is_admin_session()` (C-2); harden `admin_early_release_rewards` with open-request exclusion + advisory lock (C-4).
2. Delete `supabase/functions/admin-early-release` (C-3).
3. D-1 — your decision: team "Request payout" button in the admin direct thread, and/or early-release card listing unlocked team rewards too.
4. `PartnerEarningsPage`: filter by `reward_type`, match by `case_id`, use `unlock_at` (D-2); `sheetQueries` use `unlock_at` (D-3).
5. Optional: persist admin-chosen payment method (D-4).
6. `npm run build` + `npx vitest run`; smoke the flow with a partner and a team account once the DB is live.

Untouched by design: commission engine, 20-day rule, RLS policies, dashboards outside the payout surfaces.
