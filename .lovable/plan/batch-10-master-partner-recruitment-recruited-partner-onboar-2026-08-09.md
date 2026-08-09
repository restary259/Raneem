# Batch 10 — Master Partner Recruitment, Recruited Partner Onboarding & Referral-to-Enrollment E2E

## What already exists (verified this turn)

- Master partner status is a flag on `profiles.is_master_partner`; the recruitment relationship is `profiles.master_partner_id`. `useIsMasterPartner` reads the flag, `MasterPartnerToggle` (admin) sets it.
- Recruitment link exists: `ensure_master_recruit_link()` returns a code, the public page is `/join/:code` (`JoinPartnerPage.tsx`), which resolves the recruiter server-side via `resolve_recruit_code` and stores attribution via `submit_recruit_application` into `partner_recruit_applications`.
- Admin review exists: `RecruitApplicationsPanel.tsx` → edge function `approve-partner-recruit` (admin-only, creates the account, links `master_partner_id`, issues a durable partner invitation + branded email) and `reject_recruit_application`.
- Commissions (Batch 8) fire only at `enrollment_paid` inside `record_case_commission`, writing snapshot rows into `rewards` with a 20-day `unlock_at`.

## The one real gap: the money model

Current behaviour: the partner pool comes from `platform_settings.partner_commission_rate` (**currently 0**), and the master's `master_partner_override_rate` (200) is inserted **on top** of that pool. With your rule that is wrong twice: the partner earns 0, and the master's 200 is additive rather than carved out.

Target rule (your answer):

```text
Partner-side pool per enrolled case = 1,000 ILS  (never more)
  - case referred by a partner recruited by a master:
        recruited partner = 800, recruiting master = 200
  - case referred by a master partner directly:
        master = 1,000, no second payout
  - case referred by an independent partner:
        partner = 1,000
```

## Work to do

### 1. Finance model migration
- Set `platform_settings.partner_commission_rate = 1000` and treat `master_partner_override_rate` (200) as a **carve-out of the pool**, not an addition.
- Rewrite `record_case_commission` so the master override is subtracted from the pool: recruited partner reward = `pool - override`, master reward = `override`, and never pay the master twice when the referring partner *is* the master.
- Add a guard so the configured allocation can never exceed the pool (validation trigger on `platform_settings`).
- Keep the existing negotiated `partner_rate_offers` path working — it already carves the master's share out of the pool; align both paths on the same "sum ≤ pool" invariant.
- Historical `rewards` rows are untouched (they already snapshot `rate_used`, `base_amount`, `rate_source`).

### 2. Admin configuration UI
- In Admin Settings, surface the recruitment allocation as two fields (partner pool, master recruitment share) with live "= total" validation and an error when the master share exceeds the pool.

### 3. Recruitment email from the master partner
- Missing today: a master can copy the link but cannot email an invite. Add a small "invite by email" action on the Master Network page that calls a new edge function sending the existing branded transactional template with the master's `/join/:code` link, using the production DARB sender (no localhost URLs).

### 4. Idempotency / duplicate protection
- Unique constraint on pending recruit applications per (recruit code, email); approval already guards on `created_user_id`; verify resend-invite reuses the same invitation row.

### 5. E2E verification (steps 2–51)
Run as a scripted walk-through with real records:
- Promote the existing demo partner (`tsukuyomidomain00@gmail.com`) to master; confirm role stays `social_media_partner` and existing cases keep attribution.
- Negative security tests: partner/team/student attempting promotion, reading `partner_recruit_applications`, or approving — all must fail at RLS/edge-function level.
- Recruitment link → application → admin approval → partner invitation → password creation → partner dashboard.
- Recruited partner's referral link → 2 demo cases → team assignment → full pipeline (New → Enrolled) including appointment, profile completion, school/course/accommodation service selection, 40-week course maths, finance summary, submission, admin payment confirmation.
- Commission checks: recruited partner 800, master 200, team commission to the assigned team member, 20-day lock, no duplicates; reconcile Admin Finance / Partner / Team / Master dashboards against the underlying `rewards` rows.
- Excel + PDF export check, then a clean-session replay.

### 6. Legacy audit (step 50)
Classify: the public `/partnership` `RegistrationForm`, `JoinPartnerPage`, `invite-account`, `create-team-member`, `approve-partner-recruit`, `partner_rate_offers`, and any hardcoded 800/200 in components — active / duplicate / legacy / safe to remove — with no deletions in this batch.

## Reporting

I report `STEP N DONE — files changed — how to verify` after each step, and finish with the Batch 10 report format you specified. Two caveats up front:
- Real email delivery to `raneem.dawahade@student.jade-hs.de` can be sent and logged, but I cannot open that mailbox — inbox/spam placement will be reported as "sent + render-verified from the template preview", not as confirmed inbox placement.
- Any step needing the admin TOTP gate (as in Batch 4) will be reported BLOCKED with what I need from you.

## Technical notes

- Schema changes ship as tracked migrations; no commission value is hardcoded in UI components — everything reads `platform_settings` or the per-partner override tables.
- No new role, no second recruitment system, no second referral system; the existing partner account, invitation (Batches 3/9) and commission (Batch 8) architecture is reused.
