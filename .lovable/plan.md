# Darb — Full Audit Report & Remediation Plan

Read-only audit. Nothing was changed. Two live probes were run against the backend to confirm findings (one wrote a single throwaway row into the activity log — noted below).

---

## CRITICAL

### C1. Anonymous users can dump every case record (confirmed live)
`get_forgotten_cases()` is `SECURITY DEFINER` and executable by the `anon` role. An unauthenticated `POST /rest/v1/rpc/get_forgotten_cases` returned full case rows including student names, phone numbers, cities and intake notes. This is an active PII leak on a published site.

Also anon-executable and dangerous:
- `record_case_commission(case_id, amount)` — anyone can mint `rewards` rows and mark cases commission-settled.
- `request_payout(...)` — payout-request creation surface exposed to anon.
- `log_activity(...)` / `log_user_activity(...)` — confirmed: an anonymous POST returned `204` and inserted a forged audit-log row (my probe wrote `actor_name: "audit-probe"`, delete it).
- `get_influencer_lead_ids(...)` — leaks lead IDs.

Fix: `REVOKE EXECUTE ... FROM anon, public` on all `SECURITY DEFINER` functions except `insert_lead_from_apply` and `validate_influencer_ref` (needed by the public apply form), and re-`GRANT` to `authenticated`/`service_role` only. Trigger functions need no grants at all.

### C2. Three edge functions accept unauthenticated writes
- `supabase/functions/send_welcome_email/index.ts` — no auth check at all.
- `supabase/functions/send-branded-email/index.ts` — no auth check at all.
- `supabase/functions/send-event-email/index.ts` — no auth check; takes arbitrary `user_id` + `metadata`.

Anyone can inject attacker-controlled notifications into any user's feed by supplying an email or user ID. Fix: require a JWT + role check, or gate on a shared internal secret header.

### C3. `admin-weekly-digest` returns business KPIs to anyone
`supabase/functions/admin-weekly-digest/index.ts` has no `Authorization` handling. Unauthenticated callers get weekly revenue, lead, case and student counts, and can spam admin notifications. Fix: admin JWT check, or cron-only invocation with a secret.

---

## HIGH

### H1. `verify_jwt = false` for 23 of 24 edge functions
`supabase/config.toml`. The platform gate is off everywhere, so all enforcement is hand-written — and C2/C3 prove it was missed three times. Re-enable for everything except the genuinely public endpoints (`send-email` contact form, `create-case-from-apply`, `get-exchange-rate`, `ai-chat`, `auth-email-hook`).

### H2. Users can rewrite their own payout requests
`payout_requests` policy "Users can cancel own pending payout requests" is `UPDATE ... USING (auth.uid() = requestor_id AND status = 'pending')` with no column restriction. A user can change `amount`, `payment_method`, `linked_reward_ids` on a pending request. Combine with the `rewards` policy "Users can restore own rewards on cancellation" (lets a user flip `approved` → `pending`) and there's a double-payout path. Fix: narrow to a cancel-only path (dedicated RPC) and drop the self-service reward status flip.

### H3. Team members can reassign any case to themselves
`cases` policy "Team can manage assigned cases": `USING (has_role(team_member) AND assigned_to = auth.uid())` but `WITH CHECK (has_role(team_member))` only. A team member can update a case and set `assigned_to` to any user, or insert cases owned by others. Fix: `WITH CHECK (has_role(team_member) AND assigned_to = auth.uid())`.

### H4. `auth-guard` login is broken
`supabase/functions/auth-guard/index.ts:124` references an undefined `deviceId`, throwing on every successful login and falling into the generic catch. Fix or remove that audit field.

### H5. Two tables are RLS-enabled with zero policies
`case_payments` and `case_service_snapshots` — no policy means no access for anyone through the API. Either write policies or confirm they're intentionally server-only.

---

## MEDIUM

### M1. Raw DB errors returned to clients (14 functions)
`admin-early-release:103`, `admin-mark-paid:118`, `admin-weekly-digest:83`, `create-case-from-apply:229`, `delete-account:46`, `get-exchange-rate:38`, `get-team-members:62`, `health-check:116`, `purge-account:115`, `push-notify:121`, `send-branded-email:82`, `send-custom-notification:100`, `send-event-email:130`, `send_welcome_email:44`. Returning `err.message` leaks table/column/constraint names. Log server-side, return a generic message (as `admin-verify` and the `create-*` functions already do).

### M2. No shared data layer — 61 files call Supabase directly
`useDashboardData` and `dataService` exist but the only consumer is `src/pages/TeamDashboardPage.tsx`, which is dead code. So the abstraction is effectively unused and every component hand-rolls its own query, loading and error handling.

### M3. God-components
`src/pages/admin/AdminStudentsPage.tsx` (1231), `src/pages/team/CaseDetailPage.tsx` (1229), `src/pages/team/TeamAppointmentsPage.tsx` (1093), `src/pages/admin/AdminPipelinePage.tsx` (1073), `src/pages/admin/AdminProgramsPage.tsx` (1033), `src/pages/ApplyPage.tsx` (859), `src/components/team/ProfileCompletionForm.tsx` (808), `src/pages/admin/AdminSubmissionsPage.tsx` (757), `src/pages/admin/AdminSettingsPage.tsx` (747), `src/pages/team/SubmitNewStudentPage.tsx` (724). Each mixes fetching, form state, modals, tables and business rules.

### M4. Dead code
- `orm.tsx src/components/dashboard/ReferralTracker.tsx` — a stray directory at repo root holding a divergent second copy of `ReferralTracker` (different column names, hardcoded `isAr` ternaries). Delete.
- `src/pages/TeamDashboardPage.tsx` (1020 lines) — unrouted.
- `src/pages/StudentDashboardPage.tsx` — unrouted.
- `src/pages/PartnersPage.tsx` — never imported.
- `src/pages/AdminDashboardPage.tsx` — lazy-imported in `App.tsx:45` but has no `<Route>`; it's a bare redirect.
- Likely dead: `src/components/admin/AdminOverview.tsx`, `src/components/dashboard/DashboardErrorBoundary.tsx`.

### M5. Duplicated payout logic
`src/components/admin/PayoutsManagement.tsx` (368) and `src/components/admin/PartnerPayoutsPanel.tsx` (558) independently implement approve/reject/mark-paid with their own queries and modals.

### M6. Unoptimized images
`public/lovable-uploads` is 8.5 MB of mostly PNG, including two ~0.9 MB and several 0.4–0.6 MB files. Convert to WebP/AVIF and resize to display dimensions.

### M7. 325 `any` annotations
Worst offenders: `src/pages/admin/AdminStudentsPage.tsx` (18), `src/components/admin/AdminOverview.tsx` (17), `src/integrations/supabase/dataService.ts` (16), `src/pages/TeamDashboardPage.tsx` (15), `src/pages/partner/PartnerEarningsPage.tsx` (14), `src/pages/admin/AdminFinancialsPage.tsx` (14). Generated `Database` types are available and unused in most of these.

---

## LOW

- **L1. Wildcard CORS** on every function including admin endpoints. Not a CSRF vector (bearer-token auth, no cookies), but tighten admin functions to known origins.
- **L2. No schema validation library** anywhere in `supabase/functions/*` — all validation is hand-rolled regex. `push-notify:52-57` destructures `subscription.keys.p256dh` with no null check.
- **L3. Coarse error boundaries.** One global boundary in `main.tsx`, one `TabErrorBoundary` around the whole dashboard `<Outlet />` in `DashboardLayout.tsx:210`. Public pages have no per-page boundary, so a crash in `QuizPage` or `AIAdvisorPage` blanks the app.
- **L4. `manualChunks` in `vite.config.ts`** pre-bundles `mapbox-gl`, `jspdf`, `exceljs` and `recharts` into named vendor chunks; verify these are only pulled in on routes that need them.

---

## Clean bill of health

- No circular dependencies (`madge` on the reachable graph: zero cycles).
- Dashboard areas are properly separated — no cross-role imports between `pages/admin`, `pages/team`, `pages/student`, `pages/partner` or their component folders. Sharing happens only through `DashboardLayout`, `ProtectedRoute` and `AuthContext`.
- No secrets or service-role keys in client code; `.env` holds only the publishable anon key, which is correct.
- Only one `dangerouslySetInnerHTML`, in the shadcn `chart.tsx` primitive with generated CSS — not user input.
- Admin routes are gated by `ProtectedRoute` → `AdminSecurityGate` with forced password change and TOTP 2FA (AAL2 enforced before sensitive operations). `verify-admin-password` re-verifies server-side and audit-logs failures. This part is well built.
- All privileged edge functions except those named above do verify the JWT and check `user_roles` before using the service-role key.
- Route-level code splitting is thorough — every page in `App.tsx` is `lazy()`-loaded.

---

## Proposed remediation order

1. One migration revoking anon `EXECUTE` on the `SECURITY DEFINER` functions (C1), fixing the `cases` `WITH CHECK` (H3), tightening `payout_requests`/`rewards` policies (H2), and deciding on `case_payments`/`case_service_snapshots` (H5). Delete the forged audit row from my probe.
2. Add auth checks to `send_welcome_email`, `send-branded-email`, `send-event-email`, `admin-weekly-digest` (C2, C3); flip `verify_jwt` back on for non-public functions (H1).
3. Fix `auth-guard` `deviceId` (H4) and sweep raw `err.message` responses (M1).
4. Cleanup pass: delete dead files and the stray `orm.tsx src/` directory (M4), consolidate payout panels (M5), compress images (M6).
5. Longer-term: adopt the `dataService` layer or delete it (M2), split god-components (M3), replace `any` with generated types (M7).

Approve and I'll start with step 1.
