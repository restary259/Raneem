# Admin Pipeline → Visa Tab Runtime Audit

**Date:** 2026-10-02
**Repository:** `restary259/Raneem`
**Route:** `/admin/pipeline?tab=visa` (compat: `/admin/visa`)
**Mode:** AUDIT ONLY — no source, migration, DB, translation, type or config changes were made.

> **Note on the requested deliverable:** this report was written as the audit output
> requested. No implementation changes accompany it. The only files created outside
> this report were transient local build/test artifacts (ignored by `.gitignore`);
> `git status` was clean before and after.

---

## Executive finding

```text
Status: NOT YET CONFIRMED (could not reproduce a deterministic failure)
Root cause: No deterministic source/DB defect found. The Visa tab code path is
            sound at HEAD and in the deployed bundle; the live RPC and schema
            exist. The remaining candidates are session/authorization or
            environment-specific and require the real Admin session to confirm.
First failing layer: UNKNOWN — must be disambiguated from the browser (see §20/§30).
User-visible symptom: reported error that "prevents the Visa workspace from rendering".
                      Could not be reproduced against HEAD or the deployed build.
```

**The single most important finding:** the two failure classes the audit was asked
to separate are **both ruled out** for HEAD:

- **Not a lazy/import/render exception:** `tsc` clean, `vite build` clean, the
  `AdminVisaPage` chunk is emitted and **is deployed** (byte-identical).
- **Not a missing RPC / missing schema:** `get_admin_visa_queue()` **exists and is
  callable** in the live database, and every referenced table/column exists.

What remains is a **recoverable RPC authorization/error state** (designed for:
`AdminVisaPage` renders a friendly `ErrorState`), a **stale client in the reporter's
browser**, or a **transient backend error**. Those are distinguishable only with the
actual Admin session and the on-screen error text.

---

## Baseline

```text
git branch:      main
git status:      clean (no modifications before or after the audit)
git rev-parse HEAD: 790b5de6472b21d67b72f0f60dfef1731a49ad4a
git log -5:      790b5de Applied Phase 6 migrations safely   (2026-10-02T10:12:45Z)
                 3964d6e Changes
                 1068361 Changes
                 7f8214f Aligned migration files
                 7353003 Work in progress
shallow clone:   true (grafted) — history beyond HEAD is unavailable locally
```

Toolchain / versions:

```text
node:                       v24.21.0
npm:                        11.19.1
bun (installed for audit):  1.4.2   (repo's lockfile manager; CI uses oven-sh/setup-bun)
vite:                       per bun.lock (vite build via @tanstack/start-plugin-core)
react / react-dom:          19.2.x
@tanstack/react-router:     1.170.41
@supabase/supabase-js:      2.50.x
i18next:                    26.3.x
react-i18next:              14.1.x
```

```text
Audited commit:            790b5de6472b21d67b72f0f60dfef1731a49ad4a
Deployed frontend commit:  790b5de6472b21d67b72f0f60dfef1731a49ad4a (high confidence)
Match:                     YES
```

**Deployed == audited — proof (byte-level):**

| Artifact | Local md5 (built from HEAD) | Deployed md5 (`https://darb.agency/assets/...`) |
|---|---|---|
| `index-nExBGX3v.js` | `0624c2b72ce76d3b20b214cc033e8dc8` | `0624c2b72ce76d3b20b214cc033e8dc8` |
| `VisaService-B4W2P-1v.js` | `1d53f1e8853c271298fc1cbece1843d1` | `1d53f1e8853c271298fc1cbece1843d1` |
| `AdminVisaPage-B5FQxNoM.js` | `c6de5432059eb0f6fd2ab4508c45651d` | `c6de5432059eb0f6fd2ab4508c45651d` |

The deployed HTML at `/admin/pipeline?tab=visa` references `/assets/index-nExBGX3v.js`,
which is identical to a fresh build of HEAD. Repo `pushed_at` = 2026-10-02T10:12:51Z,
matching HEAD commit time. **A stale frontend must not be assumed** — the deployed
frontend is the audited code.

---

## Reproduction

```text
Route:      /admin/pipeline?tab=visa  (and /admin/visa → redirect)
User role:  admin (TOTP-gated)
Steps:      Log in as Admin → pass AdminSecurityGate (2FA) → /admin/pipeline
            → Pipeline renders → Submissions renders → click Visa
Exact error: NOT CAPTURED — no Admin session/credentials were available to the agent.
             e2e harness requires an injected session
             (LOVABLE_BROWSER_SUPABASE_SESSION_JSON); no test admin credentials exist
             in the repo. Static + live-DB evidence was used instead.
```

What *could* be verified without a session:

| Test | Result |
|---|---|
| A. Normal navigation (click Visa) | NOT RUN — no Admin session |
| B. Deep link `?tab=visa` from fresh load | NOT RUN (session); route/tab wiring verified statically = correct |
| C. Compat route `/admin/visa` | Verified statically: `<Navigate to="/admin/pipeline?tab=visa" replace />` (correct) |
| D. Hard refresh on `?tab=visa` | NOT RUN (session); deep-link resolution verified statically = correct |
| Local runtime smoke (built app) | `vite preview` returns 500 — **local tooling mismatch only** (`dist/server/server.js` missing; build emits `.output/`). NOT the Visa bug. |
| Deployed app reachable | `https://darb.agency` HTTP 200; `/admin/pipeline?tab=visa` serves the SPA shell |

---

## Failure chain

```text
click Visa
↓
/admin/pipeline?tab=visa            ✅ route exists (src/routes/admin.pipeline.tsx)
↓
admin.pipeline route                ✅
↓
AdminPipelineHubPage                ✅ lazy(() => import("./AdminVisaPage")) resolves
↓
TabHub                              ✅ active="visa" (tabs.some(value==="visa"))
↓
lazy(() => import("./AdminVisaPage")) ✅ chunk emitted + deployed (md5 match)
↓
Suspense                            ✅ fallback = LoadingState
↓
AdminVisaPage renders               ✅ no render-time exception found
↓
useVisaQueue()                      ✅ effect → refresh() → loadVisaQueue()
↓
loadVisaQueue()                     ✅ supabase.rpc("get_admin_visa_queue")
↓
Supabase/Postgres                   ✅ RPC EXISTS in live DB (42501 for anon, not PGRST202)
↓
rows OR exact error                 ✅ rows normalized; error stored in hook
↓
AdminVisaPage error/loading render  ✅ error && rows.length===0 → ErrorState
↓
VisaQueue                           ✅ groups/renders; empty + populated safe
```

**FAILS HERE:** ❌ **not located.** Every link in the chain is sound at HEAD and in
the deployed bundle. The failure is not reproducible from the artifacts; it must be
captured live (§20).

---

## Findings

### F1 — Deployed frontend is byte-identical to audited HEAD
```text
ID: F1
Severity: P3 (informational)
File: (build artifacts)
Evidence: index-nExBGX3v.js md5 0624c2b7… identical local vs https://darb.agency;
          VisaService / AdminVisaPage chunks identical; deployed dashboard.json sizes
          match repo (en 262446 / ar 332487 / he 315268 bytes).
Why it matters: rules out a stale-deployment cause.
Impact: None. Strengthens "source defect" hypothesis, which was then also ruled out.
```

### F2 — `get_admin_visa_queue()` EXISTS and is callable in the LIVE database
```text
ID: F2
Severity: P3 (informational — answers Question A/B)
Evidence (read-only, anon key from the public bundle, no session):
  POST /rest/v1/rpc/get_admin_visa_queue      → 401 {"code":"42501","message":"permission denied for function get_admin_visa_queue"}
  POST /rest/v1/rpc/this_rpc_does_not_exist  → 404 {"code":"PGRST202","message":"…no matches were found in the schema cache"}
  POST /rest/v1/rpc/get_my_role              → 401 {"code":"42501","message":"permission denied for function get_my_role"}
Why it matters: 42501 (not 42883/PGRST202) proves the function is present in the
  schema cache; the anon denial is the intended GRANT posture
  (REVOKE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated).
Impact: Rules out FUNCTION_NOT_FOUND. (An authenticated non-admin still cannot call it
  — it is granted to `authenticated` but RAISEs unless has_role(uid,'admin').)
```

### F3 — Every table/column the RPC references exists in the live database
```text
ID: F3
Severity: P3 (informational — answers schema-compatibility)
Evidence (PostgREST read-only probes, HTTP 200 = table + every listed column exist):
  visa_applications            arrived_in_germany_at, submission_snapshot, visa_applied_at, updated_at,
                               case_id, student_user_id, visa_outcome               → 200
  visa_application_documents   visa_application_id, document_id                     → 401 (RLS: table exists)
  case_submissions             case_id, enrollment_paid_at                          → 200
  cases                        status, deleted_at, archived, student_user_id,
                               assigned_to, full_name, phone_number,
                               case_reference, updated_at, created_at               → 200
  profiles                     arrival_date, phone_number, full_name, email         → 200
  visa_fields                  field_key, display_order, created_at, is_active      → 200
  visa_field_values            field_id, student_user_id, value                     → 200
  documents                    student_id, deleted_at, category, file_name          → 200
Impact: Rules out RELATION_NOT_FOUND / COLUMN_NOT_FOUND for the queue path.
```

### F4 — Single authoritative tab/route implementation (no duplicates)
```text
ID: F4
Severity: P3 (informational)
Evidence: grep for get_admin_visa_queue / AdminVisaPage / value:"visa" / ?tab=visa /
          /admin/visa shows exactly one definition each:
  - src/pages/admin/AdminPipelineHubPage.tsx:37  value:"visa"  (only tab def)
  - src/routes/admin.visa.tsx                    redirect (only /admin/visa)
  - src/services/VisaService.ts:125              only rpc("get_admin_visa_queue") call
  - 2 migration definitions of the function (120000 then 130000) — 130000 wins
    (later CREATE OR REPLACE; identical 18-column signature).
Impact: Rules out duplicate/legacy route or tab shadowing.
```

### F5 — i18n keys present in all three locales, in repo AND deployed
```text
ID: F5
Severity: P3 (informational)
Evidence: public/locales/{en,ar,he}/dashboard.json all contain admin.visa.pending,
  applied, emptyPending, emptyApplied, statusLabel, status.*; deployed
  https://darb.agency/locales/{en,ar,he}/dashboard.json served HTTP 200 with the same
  keys (verified parsed). `nav.visa` present in all three. i18nKeys.test.ts (incl. the
  "never resolves a t() key to an object" guard) passes.
Impact: Rules out the i18n object-as-leaf / missing-key class. Note admin.visa.status is
  a namespace (by design); the section title correctly uses the leaf statusLabel.
```

### F6 — No circular imports in the visa module graph
```text
ID: F6
Severity: P3 (informational)
Evidence: static import-graph DFS over src/**/*.{ts,tsx}. No cycle among visa modules.
  AdminVisaPage → {VisaQueue, VisaDetailSheet, VisaService, useVisaQueue, visaStatus,
  AuthContext, shell, ui}. VisaService → {supabase client, types, visaStatus}. The only
  reported self-edge is a false positive from a commented-out import path in
  client.ts ("// import { supabase } from …").
Impact: Rules out runtime `undefined` from circular ESM imports.
```

### F7 — No per-tab error boundary: a Visa render error WOULD break the whole hub
```text
ID: F7
Severity: P2 (architectural; NOT the root cause)
File: src/components/shell/TabHub.tsx:46-52
Evidence: each TabsContent renders <Suspense fallback=…>{tab.render()}</Suspense>. Suspense
  catches pending/lazy loading only — NOT render exceptions. The nearest boundary is
  TabErrorBoundary around <Outlet/> in src/components/layout/DashboardLayout.tsx:282.
Why it fails: an exception thrown while rendering AdminVisaPage/VisaQueue bubbles past
  TabHub to the layout boundary, replacing the WHOLE hub (tabs included).
Impact: This is the reason a Visa render error would look like "the Visa tab is broken".
  It is a contributing factor to *symptom shape*, not a cause. Also note the lazy chunk
  is deployed and resolves, so this path was not triggered.
```

### F8 — Error handling is the designed recoverable path (friendly ErrorState)
```text
ID: F8
Severity: P3 (informational — answers Question C)
File: src/pages/admin/AdminVisaPage.tsx:113-135; src/hooks/useVisaQueue.ts:18-29
Evidence: useVisaQueue stores `error` and never throws; loadVisaQueue throws the
  PostgREST error; AdminVisaPage renders <ErrorState title=… onRetry=…> when
  error && rows.length===0. A failed RPC therefore surfaces as a retryable panel,
  NOT a crash, and the page never reaches Supabase again until Retry/Refresh.
Impact: If the reporter's symptom is a friendly "Something went wrong" + Retry, the
  failure is AFTER the RPC (authorization/transient), not a render/import failure.
```

### F9 — `case_submissions.case_id` is UNIQUE; no row multiplication
```text
ID: F9
Severity: P3 (informational)
File: supabase/migrations/20260305005304_…sql:162 (case_id … REFERENCES … UNIQUE)
Evidence: LEFT JOIN case_submissions cs ON cs.case_id = c.id can produce at most one row
  per case. groupVisaQueue also tolerates duplicates.
Impact: Rules out duplicate queue rows / key collisions.
```

### F10 — Local `vite preview` 500 is a tooling mismatch, not the Visa bug
```text
ID: F10
Severity: P3 (informational)
Evidence: `npx vite preview` → ERR_MODULE_NOT_FOUND dist/server/server.js (build emits
  .output/ per @tanstack/start-plugin-core; vite.config / preview expects dist).
  Nitro output is at .output/ and the production deploy serves .output/public.
Impact: A local-only harness quirk. Not user-facing, not the Visa defect.
```

---

## Database state

```text
Migration present:      20260930120000_post_arrival_visa_workflow.sql (define RPC v1)
                        20260930130000_complete_student_visa_workflow.sql (redefine RPC v2 — wins)
Migration deployed:     INFERRED YES (RPC + columns + join table all present live)
RPC exists:             YES  (42501 on anon call vs PGRST202 for a nonexistent RPC)
RPC callable:           YES for `authenticated` grant; RAISEs unless has_role(uid,'admin')
                        → not directly executed as Admin (no session available)
RPC result:             UNKNOWN (requires Admin session)
Schema compatible:      YES — all referenced tables/columns exist in the live DB
Ordering risk:          Low. Both migrations are idempotent (CREATE OR REPLACE /
                        DROP POLICY IF EXISTS), 130000 depends only on objects created by
                        120000 and on pre-existing objects. A partial deploy that left
                        ONLY 120000 would still be schema-compatible (same signature,
                        only the visa_applied_at fallback/order differ).
```

`get_admin_visa_queue()` (final, 20260930130000) reads: `cases`, `profiles` (student +
assignee), `case_submissions`, `visa_applications`, `visa_application_documents`,
`documents`, `visa_fields`, `visa_field_values` — all confirmed present. Returns the
exact 18 columns the generated `src/integrations/supabase/types.ts` declares
(`Args: never`, 18-column `Returns`) and that `VisaQueueRow` models.

---

## Frontend state

```text
TabHub:                ✅ active resolution + URL sync correct; only active tab mounts;
                          Suspense handles loading only (render errors escape — F7)
AdminPipelineHubPage:  ✅ single lazy("visa") tab; Globe icon; nav.visa label
AdminVisaPage:         ✅ all imports resolve (tsc clean, build clean); no render-time throw
useVisaQueue:          ✅ effect + refresh stable (useCallback []), cancelled-ref guard,
                          loading/error transitions correct, never throws
VisaService:           ✅ rpc("get_admin_visa_queue"); normalizes visa_status + numeric
                          counts with Number(x ?? 0); throws PostgREST error
VisaQueue:             ✅ empty / populated / malformed rows all safe; usePagination safe
VisaQueueCard:         ✅ null-safe (fmt() try/catch; case_id.slice guarded by fallbacks)
VisaDetailSheet:       ✅ safe when row/selected null (hooks no-op on null ids)
```

---

## i18n state

```text
EN:   ✅ admin.visa.* complete; pending="Pending", applied="Visa Applied", statusLabel="Visa status"
AR:   ✅ complete, real Arabic (pending="قيد الانتظار", applied="التأشيرة مقدَّمة")
HE:   ✅ complete, real Hebrew (pending="ממתין", applied="ויזה הוגשה")
RTL:  ✅ document.dir set on languageChanged; rtl:rotate-180 used for direction-aware icons
Object-key issues: NONE — admin.visa.status is a namespace (by design); leaf keys used
                   for titles; i18nKeys.test.ts object guard passes
```

---

## Verification

```text
tsc (npx tsc --noEmit):   PASS  — exit 0, 0 errors
tests (npx vitest run):   PASS  — 132 files passed | 1 skipped; 1906 passed | 1 skipped
  targeted visa/i18n:     PASS  — visaStatus, visaStudentFlowGuard, i18nKeys, i18nRuntime (30 tests)
build (npm run build):    PASS  — exit 0, AdminVisaPage-B5FQxNoM.js emitted
runtime:                  NOT RUN as Admin (no session). Local vite preview 500 = tooling only.
database diagnostic:      PARTIAL — visa_workflow_deploy_audit.sql could not be executed
                          (needs SQL/psql access; not available). Equivalent facts established
                          via read-only PostgREST probes (F2/F3).
CI on main (790b5de):     PASS — "CI" workflow success (Lint→Tests→Typecheck→Build)
```

---

## Root cause confidence

```text
CONFIRMED (ruled out, with direct evidence):
  - lazy import / missing chunk / build failure          → RULED OUT
  - render-time exception in AdminVisaPage/VisaQueue      → NOT OBSERVED (all gates pass)
  - RPC does not exist (FUNCTION_NOT_FOUND)               → RULED OUT (F2)
  - missing table/column (RELATION/COLUMN_NOT_FOUND)      → RULED OUT (F3)
  - missing i18n key / object-as-leaf                     → RULED OUT (F5)
  - circular import runtime undefined                     → RULED OUT (F6)
  - stale deployed frontend                               → RULED OUT (F1)

UNCONFIRMED (require the real Admin session / on-screen text):
  - recoverable RPC authorization failure (has_role false for the session) → renders ErrorState
  - AdminSecurityGate / TOTP / session-not-cleared                       → renders the gate
  - transient PostgREST 5xx / network error                              → renders ErrorState
  - browser-side stale session (old token) in the reporter's browser      → depends on user
```

---

## Recommended fix scope (DO NOT IMPLEMENT — audit only)

The audit does **not** justify a code fix. Recommended next steps, in order:

1. **Capture the live failure** (decisive). In the reporter's browser on
   `/admin/pipeline?tab=visa` as Admin, record: exact on-screen text (friendly
   `ErrorState`? `TabErrorBoundary`? blank `RootErrorComponent`?), the Console error,
   the `get_admin_visa_queue` request status/body, and whether the `AdminVisaPage`
   chunk 200s. This alone separates "before RPC" from "after RPC".
2. **Confirm the session's DB role**: run, as that Admin,
   `select public.has_role(auth.uid(),'admin'), public.get_my_role();`
   If `has_role` is false, the RPC RAISEs "Permission denied: admin role required"
   → friendly `ErrorState`. Fix = role/session, not code.
3. **If and only if** a render exception is observed: add a per-tab error boundary in
   `TabHub` (wrap `tab.render()` in the existing `TabErrorBoundary`) so a single tab's
   render error cannot take down the whole hub (F7). This is a resilience improvement,
   not a proven fix — do not ship it as the "fix" without step 1 evidence.
4. **Do not** touch the RPC/migrations unless step 2 shows a genuine schema/permission
   gap; F2/F3 show the deployed schema is correct.

---

## Hard stop

This audit stops here. No code, migrations, translations, generated types, database
state, or configuration were modified. No fix PR was created.

---

## Post-audit addendum — outcome (2026-10-02, after merge)

**Status update:** F7 (no per-tab error boundary) was adopted as the fix and shipped.

```text
PR:      restary259/Raneem#173 — fix(shell): isolate each TabHub panel with an error boundary
Head:    62af9cc48eb6e2d332c4b5897c71b06b4feabd30
Merged:  b7c695b3bc5e2fcbca7e6a8729e65943f761614a (2026-10-02T11:23:23Z)
Files:   src/components/shell/TabHub.tsx (+4/-1)
         src/components/shell/__tests__/TabHub.test.tsx (+58, new)
```

What changed:

- `TabHub` now wraps each active panel's `<Suspense>` in the existing
  `TabErrorBoundary`. A render-time exception (or a rejected lazy-import) in one
  tab is contained to that tab and shows the recoverable
  "This section encountered a problem" card; the tab bar stays usable and
  switching tabs recovers without a reload.
- A regression test was added; it was verified to fail when the boundary is
  removed (mutation check) and pass with it.

Effect on this audit's conclusions:

```text
F7 (no per-tab boundary)     → FIXED (shipped in #173)
F1, F2, F3, F5, F6, F9       → unchanged (still confirmed sound)
UNCONFIRMED items            → unchanged; still require the real Admin session
                               to disambiguate a recoverable RPC/auth failure
                               from a render exception
```

**Scope note (honesty):** #173 addresses the *blast radius* — it guarantees a
Visa-tab render error can no longer blank the whole hub. It does **not** prove
that a render error was the production trigger; no deterministic render defect was
reproduced at HEAD. If the reporter saw the friendly `ErrorState` rather than a
blank page, the trigger is the still-UNCONFIRMED recoverable RPC/authorization
path, and steps 1–2 of "Recommended fix scope" above remain the way to confirm it.
