# DARB — Batch 14: Admin Service Catalog + Pricing Engine

## Step 1 — Audit of what exists today (verified)

**Authoritative path (already live, keep it):**
- `service_catalog` (id, name_ar/en, code, category, default_price, in_full_service, is_active, sort_order) — admin-managed, RLS: admin ALL, authenticated SELECT.
- `set_case_services(case_id, service_ids[])` — SECURITY DEFINER RPC. Copies `default_price` into `case_services` at selection time; only admin or the assigned team member may call it.
- `case_services` (service_id, description, category, unit_price, quantity, discount, currency) — RLS gives team/student **SELECT only**; no team INSERT/UPDATE policy exists, so team cannot write prices directly today.
- `get_case_financials(case_id)` — single source of truth: ILS service lines + totals, EUR school estimates (program/accommodation/insurance from `case_submissions`), payments, confirmed/pending/remaining, rounded to 2 decimals.
- `issue_case_invoice` snapshots `get_case_financials` output into `case_invoices.totals`. `record_case_commission` uses fixed ₪ pools (team rate, ₪1,000 partner pool with master carve-out), not typed prices. Payments: team may only insert `pending`/`submitted`; admin confirms.

**Gaps against Batch 14:**
1. Catalog has no currency, pricing model, description, quantity support, commissionable flag, or school/course applicability — everything is a flat fixed ILS price.
2. `40` weeks is hardcoded in `src/lib/studentProfileFields.ts` (`COURSE_DURATION_WEEKS`) — not admin-configurable.
3. No snapshot of pricing model/version on `case_services`, and no audit event when services change.
4. `case_services` allows "manual lines" with `service_id = null`; `CaseServices.tsx` still renders them. Insert path for those must be closed.
5. Legacy, still present: `master_services` + `case_service_snapshots` (older commission-per-service model) and `services` (per-student status list). Not used by the finance path.
6. No school → course → accommodation → service filtering in the catalog; `SubmitNewStudentPage` lets team type weeks (`placeholder="40"`).
7. Missing catalog config shows `₪0` silently instead of blocking.
8. Exports (`sheetQueries.ts`, invoice PDF) read case_services but lack pricing model/quantity/currency columns end-to-end.

## Step 2 — What will be built

### Database (tracked migrations)
1. **Extend `service_catalog`**: `description_ar/en`, `currency` (default ILS), `pricing_model` (`fixed | per_week | per_month | per_person | quantity`), `unit_price`, `default_quantity`, `allows_quantity`, `commissionable`, `is_optional`, `school_id`, `program_id`, `accommodation_id` (all nullable = applies everywhere), `version` (bumped on price change).
2. **Extend `case_services`**: `pricing_model`, `unit_label`, `catalog_version`, `snapshot_at`, `currency` non-null — a frozen historical copy. Keep `service_id` as reference only.
3. **Lock down writes**: trigger on `case_services` that rejects any DML not coming from the RPCs, and rejects changes after the case is submitted (admin correction RPC only). Team keeps SELECT.
4. **`set_case_services` v2**: takes `[{service_id, quantity}]`; validates each service is active and applicable to the case's school/program/accommodation; recomputes price server-side from the catalog (never from the client); enforces quantity = 1 unless `allows_quantity`; deletes de-selected lines; refuses lines with no configured price unless price is explicitly 0.
5. **Full Service**: resolved server-side from `in_full_service` at selection time, so team selecting "Full Service" expands to the configured set with catalog prices.
6. **Course duration**: `platform_settings.default_course_weeks` (default 40); `get_case_financials` and the client read it instead of the hardcoded constant.
7. **Audit**: `log_case_event('services_changed', {added, removed, old_total, new_total, actor})` on every service mutation.
8. **Admin correction RPC** `admin_adjust_case_service(...)` — admin only, writes an audit event with old/new value and reason.
9. **Legacy cleanup**: drop the unused `master_services` / `case_service_snapshots` pricing path after confirming zero rows in use; leave `services` (student task list) alone.

### Backend calculation
- `get_case_financials` extended to return per-line `pricing_model`, `quantity`, `unit_price`, `line_total`, `currency`, plus `commissionable_total`. It stays the only calculator; invoice, student view, exports and admin finance all consume it.
- Currencies stay separate: ILS agency services vs EUR school estimates — no silent conversion.
- Rounding: one helper — round each line to 2 decimals, then sum (matches current behaviour).

### Admin UI (`ServiceCatalogPanel`, Admin Settings)
- Table + edit dialog: name AR/EN, description, category (Language Course, Accommodation, Insurance, SIM, Bank Account, University Registration, Translation, Notarization, Documents, Visa Support, Transportation, Other), pricing model, price, currency, quantity support, commissionable, in Full Service, optional, applicable school/course/accommodation, active toggle, display order.
- Full Service preview with the resolved included list and total.
- Price edits bump `version`; a note states existing cases keep their frozen price.

### Team UI (`CaseServices`, case detail)
- Checkbox list grouped by category, filtered by the case's selected school/course/accommodation, with a Full Service card that expands to the included list and total.
- Quantity stepper only where `allows_quantity`.
- No price inputs anywhere; the weeks input in `SubmitNewStudentPage` defaults from `default_course_weeks` and is read-only for team.
- Manual `service_id = null` lines are removed from the UI and their creation path deleted.
- If the catalog fails to load: an error state that blocks saving — never an empty list with ₪0.

### Exports & invoice
- `sheetQueries.ts` service sheet and the invoice PDF gain: case reference, student, school, course, accommodation, service, category, pricing model, unit price, quantity/duration, line total, currency, payment status, dates — all from `get_case_financials`.

## Step 3 — Verification (E2E, run in this project)
1. Admin creates a custom service (₪500, commissionable=No) → team sees it and checking it raises the case total by ₪500 and produces no commission row.
2. Case A selects service X → admin changes X's price → Case A unchanged, new Case B gets the new price.
3. Full Service selection expands to the configured set; total matches the sum; invoice, student fees page and exports agree.
4. School A vs School B filtering; changing the course clears now-invalid selections.
5. Backend rejects: inactive service, service not applicable to the school/course, direct `case_services` insert/update as team, price tampering through the RPC payload, payment/commission/invoice-total edits as team.
6. Final consistency check: service totals = case total = invoice total = student total = admin finance total; commission uses the authoritative amount; the 20-day lock is untouched.
7. `bunx vitest run` (94 existing tests) plus new unit tests for pricing-model math and week resolution.

## Technical notes
- All schema changes go through the migration tool; no ad-hoc SQL on production data except the demo fixtures used for E2E.
- No new pricing calculators are added on the client — `get_case_financials` remains the only one, and `programPricing.ts` stays as the shared weekly-tier helper it already is.
