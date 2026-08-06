# Darb — Full Audit Report & Remediation Plan (v3)

Read-only audit and planning document. Nothing has been changed in the live app or database. Two live probes were run in v1 to confirm findings (one wrote a throwaway row into the activity log — still needs deletion in step 1).

## Business model context
Darb is a hub model with three actor types:
1. Broad community referral partners — no case/document access, submit a lead, see their own commission status only.
2. Two lawyers (translation/notarization only) — task-scoped access to documents needing translation/notarization, no financial visibility, minimal client PII (only what's legally required for the notarized document itself).
3. Admin/team (the owner) — full case ownership, on-the-ground fulfillment, financials.

## CRITICAL
### C1. Anonymous users can dump every case record (confirmed live)
get_forgotten_cases, record_case_commission, request_payout, log_activity/log_user_activity, get_influencer_lead_ids all anon-executable. Fix: REVOKE EXECUTE FROM anon, public on all SECURITY DEFINER functions except insert_lead_from_apply and validate_influencer_ref; re-GRANT to authenticated/service_role only.

### C2. Three edge functions accept unauthenticated writes
send_welcome_email, send-branded-email, send-event-email — no auth check. Fix: require JWT + role check or shared internal secret header.

### C3. admin-weekly-digest returns business KPIs to anyone
No Authorization handling. Fix: admin JWT check or cron-only invocation with secret.

## HIGH
### H1. verify_jwt = false for 23 of 24 edge functions
Re-enable for all non-genuinely-public endpoints. Must stay false: create-case-from-apply, send-email (contact form), get-exchange-rate, ai-chat, auth-email-hook, auth-guard.

### H2. Users can rewrite their own payout requests / RewardsPanel bypasses request_payout entirely
payout_requests UPDATE policy has no column restriction; combined with rewards "restore own rewards on cancellation" policy, creates a double-payout path. WORSE: RewardsPanel.tsx inserts directly into payout_requests and updates rewards.status client-side, never calling the request_payout RPC — so the RPC's ownership check, 20-day lock, and duplicate-active-request check are all dead code in practice. RewardsPanel.cancelRequest allows an unrestricted cancel-then-resubmit loop. Fix: rewrite RewardsPanel to call request_payout/a cancel-only RPC exclusively; revoke direct client INSERT on payout_requests and UPDATE on rewards.status. This must ship together with the policy tightening, or students lose the ability to request payouts.

### H3. Team members can reassign any case to themselves
cases policy WITH CHECK doesn't mirror USING clause. Fix: WITH CHECK (has_role(team_member) AND assigned_to = auth.uid()). Verify no legitimate flow (e.g. SubmitNewStudentPage) depends on the looser check before migrating.

### H4. auth-guard login is broken
Undefined deviceId reference at auth-guard/index.ts:124. Fix or remove that audit field.

### H5. Two tables are RLS-enabled with zero policies
case_payments, case_service_snapshots — confirm intentionally server-only before writing any policy (adding one could expose data currently closed only by accident).

### H6. PartnerPayoutsPanel bulk action can double-confirm a payout already in the formal request flow
PartnerPayoutsPanel.tsx groups rewards with status 'pending' OR 'approved' into one bulk-payable bucket ("Pay All Pending" at :487-491 uses group.pending, which includes 'approved' rows), even though the individual-row UI correctly hides the pay button for 'approved' rows (:161). Confirmed worse than initially described: the bulk path only writes to `rewards` — it never updates the linked `payout_requests` row and never writes `transaction_log` (PayoutsManagement.handleMarkPaid, :106-130, does all three). So a bulk-paid reward leaves its payout_request live and actionable in the other tab; the second "Pay" click there creates a transaction_log entry for a transfer that already happened. This is the actual double-payment mechanism. The two panels also disagree on what "pending total" means (PartnerPayoutsPanel sums pending+approved; PayoutsManagement treats approved as already committed). Fix: unify into a single payout-confirmation code path used by both surfaces, atomic across payout_requests/rewards/transaction_log.

## MEDIUM
M1. Raw DB errors returned to clients (14 functions) — log server-side, return generic message.
M2. No shared data layer — 61 files call Supabase directly; useDashboardData/dataService effectively unused.
M3. God-components — 10 files over 700 lines each.
M4. Dead code — orm.tsx src/ stray directory, TeamDashboardPage.tsx, StudentDashboardPage.tsx, PartnersPage.tsx, AdminDashboardPage.tsx (routeless), likely AdminOverview.tsx and DashboardErrorBoundary.tsx.
M5. Duplicated payout logic — PayoutsManagement.tsx and PartnerPayoutsPanel.tsx. Consolidation should be designed around the three-actor model and the H6/H2 findings, not just merged for DRYness. Also fold in the third and fourth independent rewards writers found: ReferralManagement.tsx (client-supplied amount, no idempotency key beyond the commission_split_done latch) and admin-early-release/index.ts. Inventory StudentCasesManagement.tsx's rewards access too before consolidating.
M6. Unoptimized images — 8.5MB in public/lovable-uploads, convert to WebP/AVIF.
M7. 325 `any` annotations.

### M8 (HIGH severity, money-critical). record_case_commission pays every partner on every case
Confirmed via live migration read (supabase/migrations/20260310110722_*.sql): the partner-payout loop iterates every row in partner_commission_overrides and filters only on cases.source — never compares against the case's actual referring partner. So once N partners have override rows, one enrolled case mints N reward rows. Currently invisible because partner_commission_overrides is empty (0 rows) — meaning partner commissions have never fired at all. This must be fixed (filter to the case's actual referring partner) before onboarding any second referral partner, i.e. before R2 ships. Also: platform_settings.partner_commission_rate (500) is never read by the function — only team_member_commission_rate is used as fallback; the partner rate setting is currently decorative.

### M9 (MEDIUM, ledger integrity). Deleting a user orphans paid financial records
The one surviving payout_requests row (id ee2f9700…, amount 1000, status paid) references a reward that no longer exists (rewards table is empty) and a requestor_id not present in user_roles (user was purged). selective-delete and purge-account delete rewards by user_id without touching payout_requests or transaction_log. linked_reward_ids and requestor_id have no FK. Fix: anonymize rather than hard-delete anything reachable from transaction_log; add FK/validation trigger on payout_requests.requestor_id.

## LOW
L1. Wildcard CORS on every function including admin endpoints.
L2. No schema validation library in supabase/functions/*.
L3. Coarse error boundaries — public pages have no per-page boundary.
L4. manualChunks in vite.config.ts — verify vendor chunks only load on routes that need them.

## Role/access build-out (post-security-fix work)
R1. Lawyer task-queue view: new case_tasks table (task type, assigned lawyer, status, completed_at) drives both the task queue UI and triggers lawyer commission on completion. Status flip (received to in progress to done), file upload, "flag for review" escalation. No case list access, no financial visibility beyond their own commission, minimal PII (only what's legally required per document).
R2. Referral-partner simplified interface: single "Send a referral" form (name, phone, interest), one visible commission total, plain-language status labels, tap-to-call/WhatsApp contact button, mobile-first RTL. BLOCKED on M8 fix — do not onboard a second referral partner before the attribution bug is fixed.
R3. Office/multi-seat partner model — deferred, lower priority than R1/R2.

## Finalized money-logic redesign (owner-approved business rules)
Commission structure:
- Referral partners: flat fixed amount per enrolled case (partner_commission_overrides.commission_amount), attributed to the single actual referring partner (requires the M8 fix).
- Lawyers: percentage-based, triggered per completed task (translation/notarization), not at case enrollment — requires the new case_tasks table (shared with R1).
- Eligibility window: both partner and lawyer rewards become payable only after a ~2-3 week safety window from the triggering event (enrollment or task completion), to protect against refunds/cancellations.
- Payout batching: admin manually triggers a batch run (not automatic, not partner-initiated) that scans all rewards past their eligibility window, groups by recipient, and creates one payout_requests row per recipient. This replaces both the self-service request_payout path and the RewardsPanel direct-insert bypass — nothing else should write to payout_requests going forward.
- Payout confirmation: single unified admin flow (see H6 fix) atomically marks payout_requests paid, marks linked rewards paid, and writes transaction_log — replacing the two divergent panels.
- Deletion semantics: never hard-delete anything reachable from transaction_log (see M9).

Open items needing owner input before implementation:
- Attribution mechanism: how is a partner currently attributed to a case (manual field assignment by the team, vs a self-service referral code/link)? Assumed manual pending confirmation.
- Lawyer commission base: percentage of the same service fee (like team commission), or a separate translation/notarization fee charged on top? Assumed same service fee pending confirmation.

## platform_revenue_ils — known defect
record_case_commission's arithmetic itself is sound (integer-only, GREATEST(0,...) floor, idempotency-guarded). The INPUT is not: the auto_split_payment trigger (using case_submissions.service_fee) and the admin-mark-paid edge function (using admin-typed total_payment_ils) both call the same RPC with different amounts. The trigger fires first (synchronously, on the same status-flip UPDATE) and wins; the explicit RPC call from admin-mark-paid hits the idempotency guard and silently no-ops. The admin-typed amount is discarded. If service_fee is 0/unset at that moment, revenue books as 0 permanently (latched). Fix direction: service_fee must be the single source of truth, read once, before the status flip — not two competing callers.

## Clean bill of health
No circular dependencies. Dashboard role separation is clean (no cross-role imports). No secrets in client code. Only one dangerouslySetInnerHTML (non-user-input, shadcn primitive). Admin routes properly gated with 2FA/AAL2. Most edge functions do verify JWT and check roles. Route-level code splitting is thorough.

## Live database state (read-only query, 2026-08-06)
cases: 0 rows. case_submissions: 0. case_payments: 0. rewards: 0. commissions: 0. commission_transactions: 0. referrals: 0. partner_commission_overrides: 0. team_member_commission_overrides: 2 (both 1500, same as the global default rate — currently no-ops). payout_requests: 1. transaction_log: 1.
Conclusion: near-zero data-loss risk for steps 1-2 below — the live PII exposure (C1) is real and urgent, the financial data behind it is nearly nil. Backup discipline should run in parallel, not gate the security fixes.
The one surviving payout_requests row's timestamps (10 minutes request-to-paid, 9 seconds approved-to-paid) are inconsistent with the 20-day lock in request_payout, direct evidence supporting the H2/RewardsPanel-bypass finding.
Data-integrity note (unrelated to money): the admin account (4abfba8f…) holds both admin and student roles — should be cleaned up before R1/R2, since any "students only see their own X" policy will also apply to this admin account.

## Data safety
Backup/PITR discipline should be set up in parallel with steps 1-2 (not gating them, given the near-empty database above): confirm Supabase plan tier and backup/PITR retention window, take a manual pg_dump snapshot stored outside Supabase, set up recurring exports of cases/case_payments/payout_requests/rewards/transaction_log/profiles independent of Supabase's own backup schedule.

## Proposed remediation order (v3)
1. Migration: revoke anon EXECUTE (C1), fix cases WITH CHECK (H3, after verifying no legitimate flow depends on the looser check), tighten payout_requests/rewards policies (H2) SHIPPED TOGETHER WITH the RewardsPanel rewrite, resolve case_payments/case_service_snapshots (H5), fold in the M8 attribution fix (same migration window as H2 — both are rewards-creation correctness), delete forged audit-probe row.
2. Add auth checks to the three edge functions (C2), admin-weekly-digest (C3) — verify the service_role_key setting used by notify_visa_status_email resolves correctly first — flip verify_jwt back on for non-public functions (H1), test each individually.
3. Unify the payout-confirmation code path (H6) across PartnerPayoutsPanel and PayoutsManagement.
4. Fix auth-guard deviceId (H4), sweep raw err.message responses (M1).
5. Fix platform_revenue_ils input source (single source of truth for service_fee, read before status flip).
6. M9 — anonymize-not-delete semantics for financial records, add FK/validation on payout_requests.requestor_id.
7. Cleanup: delete dead files (M4), consolidate payout panels around the three-actor model and the four independent rewards-writers found (M5), compress images (M6).
8. Build case_tasks table + R1 (lawyer task queue) + implement the finalized money-logic redesign (batching, eligibility windows, commission triggers).
9. Build R2 (referral-partner simplified interface) — only after M8 is fixed.
10. Longer-term: dataService adoption or removal (M2), split god-components (M3), replace any with generated types (M7), R3 if/when needed.

Nothing in this plan should be implemented without explicit owner approval, step by step.

---

## SEO & AI-Search Plan (Arabic-only, Israeli-Arab audience)

### Context
Diagnostic scan (2026-08-06) result: technical foundations are largely solid — metadata, structured data (EducationalOrganization schema), sitemap, robots.txt, page basics, and AI-crawler rendering all pass. Two amber findings, one low-priority gap, one recently-fixed item awaiting rescan confirmation. Web search for Arabic "study in Germany" queries confirms zero existing Darb presence, and confirms the top-ranking Arabic content is generic pan-Arab (Jordan/Egypt/Gulf-oriented), none addressing the Israeli-citizen-specific visa/recognition process. Real content gap, not a crowded field.

Owner decisions locked in:
- Arabic-only site, deliberately — no Hebrew version. Trust signal for the community, not an oversight.
- Testimonial/gallery content must stay anonymous or aggregate — no fabricated names/photos, ever. Real partial-consent testimonials (first initial + city) are fine once available; until then, use aggregate stats.
- Google Business Profile status: not yet confirmed/set up.

### Technical fixes (low-risk, pending owner approval to execute — not yet approved)
1. Replace generic link text ("Learn More"/"Read More") with descriptive text across partners/UniversityCard.tsx, educational/MajorCard.tsx, resources/GuidesReferences.tsx, partners/components/UniversityCarousel.tsx.
2. Fix weak/generic image alt text ("logo", empty) across the same components and landing/StudentGallery.tsx.
3. Rework locales/ar/landing.json gallery/testimonial copy: replace empty/placeholder names with either (a) aggregate stats or (b) partial-consent real testimonials as they become available. Never fabricate identities.
4. Connect Google Search Console once workspace connector is enabled.
5. Rescan after (1)-(3) to confirm the previously-fixed social-preview duplication finding actually resolved.

### Local SEO — Google Business Profile
Not yet set up. Needs owner input: business name, category, service area (e.g. Nazareth, Sakhnin, Umm al-Fahm, Haifa, Rahat, Jerusalem — confirm actual coverage with owner), phone, Arabic business description.

### Content strategy — cornerstone pages
1. Visa process for Israeli passport holders specifically.
2. Whether an Israeli bagrut is recognized for German university admission.
3. Real cost breakdown in ILS, not just EUR.
4. City-specific guides for target communities, framed around real (partial/anonymized) testimonials once available.
5. FAQ-structured content for AEO visibility.

### Backlink / off-site strategy
Arabic-language local news outlets serving the Israeli-Arab community, community Facebook groups, local organizations. Lower priority than on-site content until cornerstone pages exist to link to.

### Sequencing
1. Technical fixes above.
2. Connect Google Search Console.
3. Draft cornerstone content pages.
4. Google Business Profile.
5. Backlink outreach.

No execution without explicit owner approval, step by step.
