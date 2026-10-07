# DARB Agent Rules

Read the relevant sections of `docs/agent-notes.md` and feature documentation before editing. These rules are non-negotiable.

## Delivery
- PR only: inspect → diagnose → plan → feature/fix branch → implement → test → review diff → commit → push → PR. Never edit protected branches or merge/approve your own PR; stop if branch/PR tooling is unavailable.
- Current code/database are authoritative. Inspect callers, types, services, migrations/RPC/RLS, i18n, tests, docs, and recent commits; never invent objects. Prefer the smallest safe change.
- Audit/scan requests are read-only. Findings need severity, location, evidence/root cause, user/business/technical impact, fix, priority, and validation.
- Plan requests do not change code. Implementation separates required work from follow-up.

## Product and UX
- DARB is a real Germany-study business for Arab 48 students. Evaluate user clarity/trust/recovery, conversion/operations, and secure maintainability. Visa is not a case stage.
- Audit as the affected student/parent/team/admin/partner/office operator/public prospect. Check mobile, RTL/LTR, keyboard, Back/refresh, loading/empty/error/retry, permissions, duplicate actions, and session/network failure.
- Use evidence, labeling claims OBSERVED/INFERRED/HYPOTHESIS plus validation; never stereotype or fabricate people, testimonials, outcomes, acceptances, visas, or partnerships.
- Reduce unnecessary fields/clicks/waiting, unclear CTAs/status/next steps, weak trust, overflow, dead ends, duplicate controls, and poor recovery. Put real consented proof beside doubt.
- Preserve the DARB design system; avoid generic decoration, excessive cards/borders/gradients, and inconsistent hierarchy.
- Arabic is primary; support Arabic/Hebrew/English, RTL/LTR, mixed text, ASCII-number/date rules, and expansion. Keep locale keys aligned; Hebrew brand is `דארב`.

## Security, data, and money
- Enforce authorization at RPC/service/database boundaries, never hidden UI. Validate staff IDs server-side; use scoped RPCs, RLS/grants, controlled `SECURITY DEFINER search_path`, explicit EXECUTE grants, idempotency, and truthful query errors. Never expose secrets.
- Money is database-authoritative. Before finance/referral work read `COMMISSION_RULES.md` and current SQL. Use `get_case_financials`, `record_case_commission`, locks/idempotency, and never recompute authoritative money in the browser.
- Migrations are manual deploy: inspect historical definitions/dependents/grants/RLS/triggers/callers, use a unique newest timestamp, include verification, and never claim deployment without checking.
- Async work covers success/empty/error/retry/permission/timeout/races/stale/concurrent/session/network states. Errors say what happened, why when safe, and next action. Reset in-flight state and reuse expensive resources.

## Architecture and quality
- Preserve router compatibility helpers. Search strings already include `?`. Put meaningful filters/search/sort/page in URL state; hub tabs may push, lightweight controls replace.
- Run relevant lint/tests/typecheck/build and browser E2E for UI changes; tests prove behavior. Review diff plus mobile/RTL/security/concurrency/money/migration impacts before PR.
- Measure performance; inspect actual bottlenecks and `docs/mobile-perf-audit.md` rather than guessing.
- `bun.lock` is the only lockfile. Preserve case-stage DB enforcement, `clear_must_change_password()`, Team Students scope service, admin-only `created_by` override, Google connector boundary, active-city source, nonce-compatible CSP, and background-log retention behavior.
- Catalog photo/source rules and migration-collision repair details live in `docs/agent-notes.md`; read them before catalog edits.
- Course schedules resolve `school_start_dates` through catalog→partner-school mapping; calculate end dates centrally from official start plus whole booked weeks so forms, profiles, and exports agree.

Optimize for comprehension, trust, funnel integrity, staff speed, financial correctness, database authority, security, intentional UI, maintainability, and a reviewable PR.