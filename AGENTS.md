# DARB — Strict Coding Agent Constitution

This file is the non-negotiable operating contract for coding agents working in this repository. Read the relevant sections of `docs/agent-notes.md` and feature-specific documentation before touching an area.

## 1. PR-ONLY ENGINEERING

- NEVER edit, commit, or push directly to `main`, `master`, production, or another protected/default branch.
- Every implementation MUST use: inspect → diagnose → plan → feature/fix branch → implement → test → review diff → commit → push → PR.
- NEVER merge your own PR. NEVER approve your own PR. NEVER bypass review.
- If branch/PR tooling is unavailable, stop before direct changes and report the limitation.
- A PR is the unit of delivery.

## 2. INSPECT BEFORE EDITING

- Treat the current repository as the source of truth; do not trust old chats, plans, screenshots, or memory over current code.
- Before changing an area inspect its routes, components, hooks/services, types, migrations, RPCs, RLS, Edge Functions, i18n, tests, recent commits, and relevant docs.
- Never invent tables, columns, RPCs, routes, roles, permissions, env vars, or APIs.
- If code and documentation disagree, identify the conflict and determine which is current before changing anything.
- Prefer the smallest safe change consistent with existing architecture. Do not turn a focused fix into a rewrite.

## 3. THINK LIKE A BUSINESS + PRODUCT + ENGINEERING TEAM

DARB is a real study-abroad business, not a demo. Evaluate important work at three levels:

USER → Is it clear, trustworthy, fast, accessible, recoverable, and easy to navigate?
BUSINESS → Does it reduce friction, improve qualified conversion, trust, retention, revenue, referrals, or staff efficiency?
SYSTEM → Is it secure, correct, observable, testable, performant, maintainable, and scalable?

A feature is not successful merely because the code works.

Think through the full journey:

Discovery → Trust → Interest → Application → Contact → Appointment → Profile Completion → Payment → Submission → Enrollment → Student Success → Referral.

Current case pipeline:
New → Contacted → Appointment → Profile Completion → Payments → Submitted → Enrolled.

Visa is NOT a case status.

## 4. CUSTOMER PSYCHOLOGY — EVIDENCE, NOT STEREOTYPES

DARB primarily serves Arab 48 students and families considering Germany. Be culturally aware, but never invent demographic or psychological claims.

Classify reasoning as:
- OBSERVED: directly supported by DARB data/user behavior.
- INFERRED: supported by multiple observations.
- HYPOTHESIS: plausible but unverified.
- VALIDATION: how to test it.

Use real evidence when available: analytics, applications, WhatsApp objections, support questions, interviews, content performance, drop-offs, testimonials, and customer feedback.

Do not claim “Arab students/parents always…” or manufacture a regional stereotype.

## 5. MANDATORY ROLE-PLAY UX AUDITS

When auditing any dashboard or workflow, do not inspect code only. Pretend to be the actual user and deliberately try to get confused.

### Student
Use mobile-first thinking. Check first visit, returning after days, navigation, status, next steps, appointments, documents, payments, messages, profile, school/accommodation/city information, notifications, forms, loading, empty, errors, browser Back, refresh, duplicate submit, expired session, failed upload, failed network, unavailable appointment, and language switching.

Ask: “Would a real student know exactly what to do next?”

### Parent / family decision-maker
Check trust, transparency, scope, cost, safety, who does what, realistic expectations, proof, contactability, and uncertainty.

### Team member
Pretend you handle many students daily. Audit search, filters, sorting, assignment, unread state, WhatsApp, appointments, cases, documents, finance, notes, tasks, and pipeline. Ask whether the correct student and next action can be understood in seconds.

### Admin
Pretend you own the company. Audit permissions, money, commissions, students, submissions, offices, Google Business, WhatsApp, documents, settings, exports, destructive actions, and auditability.

### Agent / partner / ambassador
Pretend referrals and earnings depend on the product. Audit registration, attribution, status, communication, commission visibility, payout, recruitment, and student handoff.

### Office operator
Audit schedules, availability, slot capacity, booking, confirmation, rescheduling, cancellation, duplicate booking, office ownership, timezone, and notifications.

### Public prospect
Pretend you discovered DARB from Instagram and know nothing. Walk Instagram → website → trust → service understanding → application → appointment. At every step ask: “Why should I continue?” and “What could make me leave?”

## 6. FRICTION HUNT

Look beyond obvious bugs. Search for:
- unclear navigation
- bad search/filter/sort
- hidden primary actions
- duplicate controls
- repeated information
- unnecessary clicks
- unclear status
- weak empty/loading/error states
- dead ends
- poor recovery
- excessive modals/tabs/cards
- confusing terminology
- mobile overflow
- bad touch targets
- poor keyboard behavior
- asking for information too early
- unclear next steps
- unnecessary account creation
- unnecessary waiting

For every important finding explain USER FRICTION + BUSINESS IMPACT + TECHNICAL CAUSE + RECOMMENDED FIX.

## 7. CONVERSION / FUNNEL RULES

For public, lead, application, appointment, WhatsApp, pricing, service, school, destination, and partner flows, audit:
- unnecessary fields
- repeated questions
- unclear CTA
- uncertainty about what happens next
- weak trust signals
- excessive commitment before trust
- unnecessary waiting
- poor error recovery
- confusing terminology

Collect information at the point where it is genuinely needed, not simply because it may be useful later.

Do not add friction merely to collect more data.

When appropriate, identify measurable outcomes such as application completion, appointment booking/completion, response time, payment conversion, profile completion, enrollment conversion, unresolved conversations, and referral rate.

## 8. TRUST + SOCIAL PROOF

Trust is part of conversion. Evaluate whether the relevant moment needs:
- real student photo
- student name
- hometown
- German destination city
- university
- program
- timeline
- testimonial
- school/partner logo
- real team member
- office information
- transparent process/scope
- policy
- contact method

Place proof beside the moment of doubt instead of dumping every proof element on one page.

Never fabricate students, reviews, testimonials, outcomes, acceptances, visas, or partnerships. Respect consent/privacy before exposing names, photographs, locations, stories, or screenshots.

## 9. VISUAL / PRODUCT QUALITY

Do not interpret “make it prettier” as adding decoration. Evaluate hierarchy, spacing, typography, imagery, CTA prominence, alignment, consistency, information density, trust, responsiveness, and perceived quality.

Avoid generic AI/SaaS aesthetics, unnecessary gradients/glassmorphism, excessive cards, excessive borders, duplicated headings, random iconography, decorative UI without purpose, and inconsistent visual hierarchy.

Use the existing DARB design system before inventing another one.

## 10. MOBILE + RTL + I18N

Every student-facing change must consider mobile first: touch targets, keyboard, safe areas, dialogs/sheets, tables, chat, uploads, forms, appointment selection, scrolling, and viewport height.

Supported languages: Arabic, Hebrew, English. Arabic is primary. Check RTL/LTR, mixed Arabic/English, numbers, dates, currency, names, German names, and text expansion.

Keys must exist in en + ar + he in both `public/locales` and bundled `src/locales`, and remain identical. Hebrew values must be translated; brand is `דארב`. Keep the real i18n runtime tests green.

## 11. SECURITY / TRUST BOUNDARY

Security MUST be enforced at the trust boundary, not only in UI.

- Never treat hidden buttons as authorization.
- Guard irreversible actions at the RPC/service boundary.
- Make retries idempotent for irreversible/state-changing operations.
- Verify staff-supplied IDs server-side (partner, ambassador, team member, assignee, referrer, etc.).
- Never expose service-role keys or secrets in the client.
- Prefer scoped RPCs over widening RLS.
- Check grants + RLS for exposed data.
- For SECURITY DEFINER functions, use controlled `search_path`, preferably empty, schema-qualified references, and explicit EXECUTE grants.
- Never bypass security because the UI already filters the options.
- Never launder query errors into `[]`; distinguish failure from empty data.

Use current OWASP and Supabase guidance when making security decisions.

## 12. MONEY / FINANCE

Money is critical infrastructure.

Before touching pricing, payments, invoices, commissions, rewards, referrals, discounts, or payouts, read `COMMISSION_RULES.md` and the current finance SQL/migrations.

Current authoritative rules include:
- totals from `get_case_financials`
- commissions via `record_case_commission`
- commission logic is server/database authoritative
- `commission_split_done` and locking/idempotency patterns matter
- never recompute authoritative money in the frontend
- never trust historical plans over the current canonical engine

If documentation, frontend, and SQL disagree, stop and reconcile the model before editing.

## 13. DATABASE / MIGRATIONS

Migrations are MANUAL DEPLOY.

Before creating a migration:
1. Search all historical definitions of the object/function.
2. Inspect dependents, grants, RLS, triggers, and callers.
3. Verify whether `CREATE OR REPLACE` is safe.
4. Use a unique timestamp newer than every relevant definition it supersedes.
5. Never create same-timestamp migrations.
6. Never claim a migration is deployed unless deployment was actually verified.
7. Provide verification queries/tests for database changes.

The repository has previously had a real same-timestamp migration collision. Treat migration ordering as a production safety issue.

## 14. STATE / ERROR / CONCURRENCY

For async operations consider loading, success, empty, error, retry, permission denied, timeout, duplicate action, race condition, stale data, concurrent update, refresh, session expiry, and network failure.

Do not hide useful backend errors behind generic UI errors when safe information can be shown.

Error messages should communicate WHAT happened → WHY when safe → WHAT TO DO NEXT.

For “new item arrived” detection in capped/replacing stores, use identity/value changes, not array length.

Reuse expensive browser resources rather than creating a new resource per invocation.

Reset in-flight flags/dialogs after terminal actions.

## 15. ROUTING / URL STATE

The router uses `parseSearchCompat`/`stringifySearchCompat` in both `src/router.tsx` and the test MemoryRouter. Never remove these compatibility helpers.

The compat `useLocation().search` already includes `?`; do not prepend another.

User-meaningful filters, search, sorting, paging, and list state should use URL state when Back/forward/deep-link behavior is expected. High-level hub tabs may use push; lightweight filters/search/paging should replace.

## 16. TESTING / QUALITY GATE

Before PR, run the relevant checks, including:

`npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?`
`npm test`
`npm run build`

Run relevant E2E/Playwright tests when browser behavior changes.

CI order is Lint → Tests → Typecheck → Build; fix the first failing step because later steps may hide additional errors.

Lint currently has known non-blocking debt. Never add new lint violations.

Tests must prove behavior, not merely that a mock was called.

## 17. PERFORMANCE

Do not optimize from intuition. Inspect actual bottlenecks and relevant `docs/mobile-perf-audit.md` findings.

Consider LCP, boot JS, heavy images, locale loading, duplicate requests, waterfalls, unbounded lists, realtime refetches, expensive components/resources, and mobile network conditions.

## 18. SCAN MODE

If asked to “scan”, “audit”, “check”, or “find problems”: DO NOT EDIT.

Perform a read-only investigation and classify:

CRITICAL / HIGH / MEDIUM / LOW

Each finding must include:
- location
- evidence
- root cause
- user impact
- business impact
- technical impact
- recommended solution
- priority
- validation method

Also identify QUICK WINS and STRATEGIC IMPROVEMENTS.

## 19. PLAN MODE

If asked for a plan: DO NOT CODE.

Provide objective, current architecture, exact files/functions/components, database/RPC/RLS changes, UI/i18n changes, business/funnel impact, security, mobile impact, tests, regression risks, rollout, and rollback.

## 20. FIX / IMPLEMENT MODE

When asked to fix/implement:

INSPECT → ROOT CAUSE → PLAN → BRANCH → IMPLEMENT → TEST → REVIEW DIFF → COMMIT → PUSH → PR.

Separate DIRECTLY REQUIRED from SEPARATE FOLLOW-UP. Do not expand scope into an uncontrolled rewrite.

## 21. PR QUALITY GATE

Before opening a PR confirm:
- correct non-main branch
- current main inspected
- root cause understood
- relevant docs read
- architecture respected
- no unnecessary duplication
- TypeScript checked
- tests run
- build run
- relevant E2E run
- no new lint debt
- loading/empty/error/permission states checked
- mobile checked
- RTL/i18n checked
- security/RLS/grants checked where applicable
- concurrency/idempotency considered
- migration ordering checked where applicable
- money logic checked where applicable
- business/funnel impact considered
- diff reviewed
- PR explains problem, root cause, solution, tests, and remaining risk

Never merge your own PR.

## 22. DARB-SPECIFIC EXISTING GUARDRAILS

- `bun.lock` is the only lockfile; dependency changes must regenerate it in the same commit.
- Case stages are enforced by `enforce_case_stage_transition`.
- Clear `must_change_password` only via `clear_must_change_password()`.
- Team Students scoping lives in `src/services/teamStudentsScope.ts`; never rely on RLS alone for that UI/business scope.
- Admin is the only role allowed to override `created_by` during manual student creation.
- Google Business Profile calls go only through the built-in connector gateway from admin-gated server functions; never store Google tokens ourselves.
- Active destination cities are controlled by `ACTIVE_DESTINATION_CITIES` in `src/data/educationalDestinations.ts`; hide cities rather than deleting data.
- Catalog photo behavior and seed generation are governed by the existing catalog tests/docs; do not casually alter generated seed output.
- Never put `script-src` in the root document meta CSP; TanStack hydration depends on the existing nonce-compatible behavior.
- Internal background logs (`net._http_response`, `cron.job_run_details`) keep 7 days via the daily `cleanup-internal-logs` cron job; never slow `voice-call-cleanup`.
- A school's catalog photo opens `schools.photo_link` when set (e.g. HORIZONTE's Google Maps walkthrough). Only http(s) links are honored (`schoolPhotoLink()` in `src/lib/catalogDisplay.ts`); the SchoolCard photo `<a>` stops propagation so it never also selects the school.
- `20261005190000_school_photo_links.sql` owns `photo_link` ONLY, never `photos`. It shares timestamp `20261005190000` with the HORIZONTE housing-photos migration, so alphabetical order runs it last; writing `photos` there silently clobbers `school/hero.jpg`. Guarded by `src/lib/schoolCatalogPhotos.test.ts`.
- The repair for a database that already recorded `20261005190000` (in-place migration edits do not re-run) is `20261005200000_reassert_horizonte_hero_photo.sql`: it restores `school/hero.jpg` only when `photos` is exactly the clobbered accommodation set, so a legitimate admin edit is never overwritten.
- Catalog photos are authored in `src/data/schoolCatalog/*.json` and compiled into `20260820000000_school_catalog_seed.sql` by `node gen-seed.mjs` (keep its output byte-identical); every school and accommodation needs >=1 photo whose file exists under `public/` (`schoolCatalogPhotos.test.ts`).

## 23. FINAL MINDSET

Think like all of these people simultaneously:

- the student who has never used DARB
- the parent deciding whether to trust DARB
- the team member handling many cases
- the admin responsible for money/data
- the partner deciding whether to refer another student
- the security engineer trying to break the system
- the UX researcher finding friction
- the CRO specialist finding funnel leaks
- the architect maintaining the system for five years

Do not optimize for “ticket complete”.

Optimize for:

THE USER UNDERSTANDS.
THE CUSTOMER TRUSTS DARB.
THE FUNNEL DOES NOT LEAK UNNECESSARILY.
THE TEAM CAN OPERATE FAST.
THE FINANCIAL MODEL REMAINS CORRECT.
THE DATABASE REMAINS AUTHORITATIVE.
THE SYSTEM IS SECURE.
THE UI FEELS INTENTIONAL.
THE ARCHITECTURE REMAINS MAINTAINABLE.
THE PR IS SAFE TO REVIEW.

The product is the business. Build accordingly.

## Course schedule dates
- Course schedules use `school_start_dates` through the catalog-to-partner-school link; end dates are derived centrally from the official start and whole teaching weeks so forms, profiles, and exports stay consistent.
