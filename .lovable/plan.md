# Migration & RLS Audit — findings and cleanup plan

Read-only audit of the live database (137 migration files, 59 public tables, ~150 policies) against the current case-centric app. Nothing was changed.

## What is healthy
- Every public table has RLS enabled — no table is wide open.
- The case-centric core (`cases`, `case_submissions`, `case_services`, `case_payments`, `invoices`, `invoice_items`, `documents`, `case_events`) is consistently scoped: admin full access, team scoped to `assigned_to = auth.uid()`, students read-only on their own case.
- Newer tables (`partner_links`, `partner_clicks`, `pipeline_statuses`, `permissions`, `role_permissions`) are correctly written against `authenticated` only.
- Roles live in `user_roles` and all checks go through `has_role()` — no role data on profiles.

## Findings

### 1. HIGH — `anon` holds full CRUD grants on nearly every table
Confirmed from table ACLs: almost all public tables carry `anon=arwdDxtm` (select/insert/update/delete). These are legacy defaults from early migrations. Today RLS is the only thing stopping an anonymous request from deleting rows — a single future policy written with `USING (true)` or targeting `public` becomes an immediate data-loss hole.
Fix: revoke all privileges from `anon` on every public table, then re-grant `SELECT` only to the genuinely public ones (`majors`, `major_categories`, `programs`, `schools`, `accommodations`, `insurances`, `important_contacts` where public reads are intended), plus the specific writes the public apply/contact flow needs (currently these go through SECURITY DEFINER RPCs, so likely none).

### 2. MEDIUM — ~35 policies target the `public` role instead of `authenticated`
Examples: all 7 `documents` policies, `cases` admin + student policies, `rewards`, `payout_requests`, `referrals`, `commissions`, `commission_transactions`. They evaluate for anonymous requests too. They are not exploitable on their own (each compares against `auth.uid()`, which is null for anon), but combined with finding 1 they remove the second layer of defence, and they cost an extra policy evaluation on every anonymous request.
Fix: recreate them with `TO authenticated`.

### 3. MEDIUM — duplicate/overlapping policies from stacked migrations
Same-effect policies coexist on:
- `case_payments` — "Admins manage all payments" and "Admins can manage case payments" (identical)
- `partner_commission_overrides` — "Admin full access…" and "Admins manage partner overrides"
- `team_member_commission_overrides` — "Admins manage team overrides" and "Admin full access…"
Also `case_payments` has a team `ALL` policy plus a redundant team `SELECT` policy.
Fix: drop the redundant duplicates, keep one canonical policy per role per table.

### 4. MEDIUM — the `ambassador` role has no policies at all
`app_role` includes `ambassador`, and the app onboards ambassadors, but every partner-scoped policy checks only `social_media_partner` (`commission_transactions`), and `platform_settings` / `important_contacts` / `eligibility_*` reads enumerate roles that may not include it. Ambassadors currently see no commission data through RLS.
Fix: decide whether `ambassador` is a partner variant; if yes, extend the partner policies to accept both roles (or introduce an `is_partner_role()` helper so this can't drift again).

### 5. MEDIUM — pre-refactor tables still live alongside the case model
| Table | Rows | Still referenced |
|---|---|---|
| `leads` | 3 | only digest/health-check/dataService (dead layer) |
| `commissions` | 0 | spreadsheet + dataService |
| `payments` | 0 | PaymentService, spreadsheet |
| `services`, `student_checklist`, `checklist_items` | 0 | student checklist UI |
| `case_service_snapshots`, `master_services` | 0 / 1 | edge functions only |
| `eligibility_config`, `eligibility_thresholds`, `commission_transactions` | — | **no code references at all** |
They each carry RLS policies that must be reasoned about forever.
Fix: classify each as keep / archive / drop, then remove the dead ones and their policies in one migration. `leads` has 3 real rows — migrate or export before dropping.

### 6. LOW — 26 linter warnings on SECURITY DEFINER function EXECUTE grants
Continuation of the earlier hardening pass: trigger-only and internal functions still have EXECUTE for `anon`/`authenticated`.
Fix: enumerate the SECURITY DEFINER functions, keep EXECUTE only on the ones the client actually calls (`check_referral_code`, `resolve_partner_link`, `record_partner_click`, `insert_lead_from_apply`, `get_my_role`, `get_my_permissions`, `get_staff_directory`, `get_partner_pool_cases`, …), revoke the rest.

### 7. LOW — migration history has drift, not corruption
137 files, with several policies dropped and recreated 3-4 times across them. The live state is what matters and it is coherent; there is no need to rewrite history. Worth adding one consolidating migration that documents the final intended policy set per table.

## Proposed order of work
1. Duplicate-policy cleanup + `public` → `authenticated` rewrite (findings 2, 3) — mechanical, no behaviour change.
2. Revoke `anon` grants and re-grant the public-read whitelist (finding 1), then smoke-test the public site: apply form, contact form, programs/majors pages, referral link resolution.
3. Decide the `ambassador` question (finding 4) and apply partner-policy changes.
4. SECURITY DEFINER EXECUTE sweep (finding 6), re-run the linter.
5. Legacy-table decision and removal (finding 5) — last, after exporting `leads`.

## Technical notes
Each step is one migration. Steps 1-2 are the risky pair for the public site, so they ship together with a Playwright pass over the public routes and the apply/partnership forms before anything else proceeds. No application code changes are required for steps 1, 2, 4; step 5 requires removing the dead `dataService`/spreadsheet references first.

Open question before step 3: should `ambassador` see the same commission and referral data as `social_media_partner`, or is it a reduced scope?
