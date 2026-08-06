# Darb — Production Readiness Checklist kepp the temp password that we genrate and then they change password on sign in instead o google sign in auth 

Verdict: **not production-ready yet, but close.** Three data-integrity holes in
the database rules must be closed first. Everything else is polish or
operational setup.

Below, each item is marked with what was actually checked in this project right
now (not assumed).

---

## 1. Blockers — must fix before going live

### B1. A student can insert their own "paid" payment row

Verified: the only INSERT rule on `payments` is `auth.uid() = student_id`.
Nothing limits `amount` or `status`, and there is no trigger on `payments`.
A signed-in student could create a row saying they paid any amount.

Fix: force client-side inserts to `status = 'pending'` with no
`payment_date`, and let only admins / edge functions confirm a payment.

### B2. A student can approve their own service request

Verified: `Users can update own services` has no `WITH CHECK`, and `services`
has no guard trigger. A student can set `status` to whatever they like.

Fix: block non-staff from changing `services.status`.

### B3. A student can mark their own referral as already discounted

Verified: `Students create referrals` only checks `referrer_user_id = auth.uid()`.
`discount_applied` is unconstrained.

Fix: force `discount_applied = false` on student inserts; only staff can set it true.

Note on a fourth scanner finding ("students can tamper with profile financial
fields"): verified as **already mitigated** — the `restrict_profiles_write`
trigger blocks commission, statuses, case links, referral code, email and
confirmed bank details for non-admins. No change needed; it will be
re-flagged by the scanner because the policy itself is broad, and can be
dismissed with a note.

---

## 2. High — should fix before real traffic

### H1. 25 database linter warnings

Verified: 4 `SECURITY DEFINER` functions callable by anonymous visitors,
21 callable by any signed-in user. Some are legitimate (`has_role`,
`check_referral_code`, `insert_lead_from_apply` need public/anon access);
the rest are trigger-only or admin-only helpers that should have `EXECUTE`
revoked. Plan: enumerate all 25, keep the intentionally public ones, revoke
the rest, and record the intentional ones in security memory so they stop
being re-raised.

### H2. Auth hardening not confirmed

Not yet verified from the app side — needs a one-time settings pass:

- Leaked-password (HIBP) protection enabled
- Email confirmation required for sign-up
- OTP / session expiry sane
- Google sign-in provider actually configured (not just wired in code)

### H3. Money paths never exercised with real volume

Verified counts: 2 cases, 1 lead, 7 profiles, **0 invoices, 0 rewards,
0 payout requests**. The invoice, commission and payout code has never run
against real data. Before launch: run one full staged case end-to-end
(apply via a partner link → case → submission → enrollment paid → commission
→ payout request → payout confirmed) and reconcile every number by hand.

---

## 3. Medium — quality and consistency

- **Service layer half-adopted.** Verified: 20 files still call
`supabase.from` directly outside `src/services/`. Not a bug, but it means
RLS assumptions live in many places. Migrate the remaining admin/team/student
pages progressively.
- **Test coverage is thin.** Verified: 14 unit tests and 4 Playwright specs
(authorization, partnership form, public flow, spreadsheet). Missing E2E
coverage for the case pipeline, invoices, and payouts.
- **CI typecheck command.** `ci.yml` runs `npx tsc --noEmit`; this previously
failed on the project's tsconfig layout. Confirm the workflow is green on
the current main before trusting it as a gate.
- **Phase 8 of the refactor is still open** (analytics rollup + case
archival). Not a launch blocker.

---

## 4. Low — pre-launch polish

- Arabic/English parity sweep on all new screens (invoices, partner links,
spreadsheet hub).
- Empty-state and error copy on partner + student dashboards.
- Mobile pass at 390px on the pipeline board and case file.
- Confirm SEO metadata and sitemap still reflect the current page set.

---

## 5. Operational readiness (outside the code)

- Custom domain connected and published (currently `darb-agency.lovable.app`;
referral links point at `https://darb.agency`) — these must match or
referral links will break.
- Transactional email sender verified for the 29 edge functions that send mail.
- Admin account recovery path documented (who can reset the admin).
- Backup/restore expectation understood; a documented "what if we delete a
case by mistake" answer (`deletion_logs` exists and supports restore).
- Privacy policy / terms published, since real student PII is stored.

---

## Suggested execution order

1. Fix B1, B2, B3 (one migration, guard triggers + tightened policies).
2. Re-run the security scan; dismiss the profiles finding with a memory note.
3. Sweep the 25 linter warnings (second migration, revokes only).
4. Auth settings pass (H2).
5. Full money lifecycle dry run (H3), fixing whatever it surfaces.
6. Then publish; medium/low items continue after launch.

## Technical notes

- B1/B2/B3 are all database-only changes: `WITH CHECK` clauses plus small
`BEFORE INSERT/UPDATE` guard triggers following the existing
`restrict_profiles_write` pattern, so behaviour for admins is unchanged.
- The linter sweep is `REVOKE EXECUTE ... FROM anon, authenticated` per
function; no function bodies change, so no app code is touched.
- No frontend changes are required for the blockers.