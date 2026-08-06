# Darb — Production Readiness Plan (Attribution, Flat ILS Commissions, Unlimited Partners)

## What I verified before writing this

- The app already has exactly the 4 dashboards you want: `/admin`, `/team`, `/partner`, `/student`. There is no 5th dashboard to remove (the old influencer dashboard route no longer exists).
- There is no tiered commission system left in the database — no `commission_tiers`, no `student_cases`, no `get_influencer_tier_commission()`. The live money path is already flat: `record_case_commission()` + `partner_commission_overrides` + `platform_settings.partner_commission_rate`. So "remove tiered" = lock the flat model in and make sure nothing can drift back.
- Attribution is genuinely broken: `src/pages/ApplyPage.tsx` lines 87–88 hardcode `sourceType = "organic"` and `sourceId = null`. `useSearchParams` is imported but never read. Live data confirms it: 2 cases exist, **0 have a `partner_id`**.
- No `referral_code` column exists anywhere. Partners have no share link UI.
- Only 1 partner account exists today and 0 commission overrides are configured. Nothing in the schema limits partner count — the limit is practical (no codes, no links, no self-serve creation), not structural.
- `rewards` has no `case_id` column. Rewards are linked to cases only by a substring inside `admin_notes` (`'Partner commission from case <uuid>'`), and `admin-early-release` searches with `LIKE`. Currently 0 rewards exist, so this is a **free** fix right now.
- Money is already stored in whole shekels in the live path, but `master_services`, `programs`, `accommodations`, `insurances` each carry a free `currency` column, and the Excel export engine supports EUR/USD.

---

## Phase 1 — Referral attribution (blocks everything else)

**1.1 Referral codes for every partner, ambassador and student**
- Add `referral_code` (unique, short, e.g. `sara-k7x2`) to `profiles`, plus `referral_code_enabled`.
- Auto-generate on account creation for partner/ambassador/student roles; backfill the existing accounts.
- Add a public, minimal resolver RPC `resolve_referral_code(code) -> uuid` that returns only the user id (no PII) so codes cannot be spoofed by pasting someone else's UUID.

**1.2 Capture the code**
- `ApplyPage.tsx`: read `?ref=` from `useSearchParams`, store in `localStorage` with a 90-day expiry the moment it is seen, and fall back to storage on submit.
- Same capture on the landing page and `/contact`, so a visitor who arrives on the homepage and applies later still counts.

**1.3 Resolve server-side**
- `insert_lead_from_apply` gains `p_ref_code text`; it resolves the code itself, sets `source_type` and `source_id`, and records `source_attribution_method` (`link` / `manual` / `admin`) for dispute auditing.
- `create-case-from-apply` carries the resolved id into `cases.partner_id` (or `referred_by` for student referrals).

**1.4 "My Link" UI**
- New share card on the partner dashboard and on the student refer page: the code, the full URL, copy-to-clipboard, and a WhatsApp share button.

---

## Phase 2 — Unlimited partners + ambassadors

- Remove every single-partner assumption: partner lists, commission settings, and payout panels all paginate and search instead of assuming one row.
- Add an `ambassador` role (students / people already in Germany) that behaves like a partner but with its own default rate and a lighter dashboard reusing the existing partner pages.
- Admin can create unlimited partner/ambassador accounts from the Team page; each gets a referral code automatically.
- Default per-case visibility for new partners: their own referred cases only. Admin can widen per person.

---

## Phase 3 — Flat shekel commission model, locked in

- Admin settings holds three global flat ILS amounts: partner, ambassador, team member.
- Per-person override table stays (it's already flat) and always wins over the global default. This precedence rule gets written as a comment in the SQL and as UI copy in the settings panel.
- `record_case_commission()` is rewritten to a single documented path: resolve the actor's flat amount, insert one reward per actor, and set `platform_revenue_ils = service_fee − all commissions`.
- A short `COMMISSION_RULES.md` at repo root states the rule in plain language so no future change re-derives it from SQL.
- Any percentage-based leftovers in the UI (rate labels, `%` icons on financial KPIs) get replaced with `₪` amounts.

---

## Phase 4 — Everything in shekels

- `rewards.currency`, `payout_requests`, `transaction_log` are pinned to `ILS`; a check constraint blocks anything else on the money tables.
- `master_services`, `programs`, `accommodations`, `insurances` default to `ILS` and the currency selector is removed from those admin forms.
- One shared formatter (`₪ 1,234` with `en-US` digits, correct placement in RTL) used by every display point and by the Excel export; the export engine drops EUR/USD.
- The currency converter tool on the public site is unaffected — it is a student utility, not money logic.

---

## Phase 5 — Money-path integrity

- Add `rewards.case_id uuid REFERENCES cases(id)`; `record_case_commission()` and `admin-early-release` use it instead of `LIKE` on `admin_notes`. Zero rewards exist today, so no backfill is needed.
- Make the `admin_audit_log` write blocking for money-moving actions in `admin-mark-paid` — if the action can't be recorded, it doesn't happen.
- Rate limits on `create-influencer`, `create-team-member`, `create-student-account`, and the public apply/contact submit paths.

---

## Phase 6 — Verification before launch

- Unit tests: commission with an override, without an override, with a team member, and idempotency of double-marking a case paid.
- E2E: visit `/apply?ref=<code>` → submit → admin marks paid → the correct reward, in shekels, appears on that partner's dashboard.
- RLS audit query over `pg_policies` plus a CI guard that fails the build if any money or PII table has zero policies.
- Translation parity check in CI (there is a known 18-key AR/EN gap in `dashboard.json`).

---

## Technical notes

- Migrations touch: `profiles` (`referral_code`), `cases` (`source_attribution_method`), `rewards` (`case_id`, currency constraint), `platform_settings` (ambassador rate), `app_role` enum (`ambassador`), and rewrites of `insert_lead_from_apply` and `record_case_commission`.
- Frontend touches: `ApplyPage.tsx`, `ContactPage.tsx`, `PartnerOverviewPage.tsx`, `StudentReferPage.tsx`, `CommissionSettingsPanel.tsx`, `AdminFinancialsPage.tsx`, `PartnerPayoutsPanel.tsx`, `src/utils/export/formats.ts`.
- Out of scope for now, per your instruction: funnel-event instrumentation, self-serve partner applications, and the god-file refactors. They come after launch.
