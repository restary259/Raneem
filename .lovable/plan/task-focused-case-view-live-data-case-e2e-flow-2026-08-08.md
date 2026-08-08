# Task-focused case view (live data) + case E2E flow

Rebuild `/team/cases/:id` and `/admin/cases/:id` (same component) to match the uploaded layout, with every element driven by real case data and real actions — no demo content.

## 1. Persistent header

- Back arrow, student name, and a subline reading `Case #DRB-YYYY-NNNNNN · Assigned to <team member>` (falls back to "Unassigned").
- Call button opens `tel:` with the case phone; Schedule button opens the existing appointment picker.
- Status chip shows the current pipeline stage label (from `pipeline_statuses`, translated), followed by the compact dot-and-line progress rail: filled dots for completed stages, ringed dot for current, muted for remaining.

## 2. "Needs attention now" panel — live tasks

Replaces the current static alert. Tasks are computed from the case's real state, each with a working action, and the panel disappears when nothing is open:

| Condition | Task shown | Action |
|---|---|---|
| Stage awaiting payment and payment not confirmed | "Payment confirmation is overdue by N days" | Confirm payment (existing finance action) |
| Required document category missing (passport, photo, etc.) | "<Document> still missing" | Jumps to Documents tab, opens upload |
| No appointment scheduled while stage expects one | "No appointment scheduled" | Opens the scheduler |
| Appointment in the past with no outcome recorded | "Outcome not recorded for <date>" | Opens record-outcome dialog |
| No activity for more than the configured forgotten threshold | "No follow-up logged for N days" | Adds a note on the timeline |

The primary (most blocking) task gets the filled action button; the rest are compact rows with a chevron. Overdue day counts come from the relevant timestamp (`payment_confirmed_at`, `last_activity_at`, appointment date), formatted `en-US`.

## 3. Five section tabs

Segmented control styled like the reference, replacing the current tab bar and the long scroll: **Overview · Student · Program · Financial · Activity**.

- **Overview** — the six-field summary grid from the reference (Program, Accommodation, Insurance, Payment status, Documents "4 of 6 uploaded", Next appointment), each reading live values with a muted "Not attached yet / Not scheduled" fallback.
- **Student** — existing `CaseStudentTab`.
- **Program** — existing `CaseProgramTab`.
- **Financial** — existing `CaseFinance` (services, invoices, payments).
- **Activity** — existing `CaseTimeline` plus the appointments list.

## 4. Localization and styling

- All new strings via `t()` with keys added to both `public/locales/ar/dashboard.json` and `en`. No hardcoded English, no emoji labels.
- Colors use existing semantic tokens (surface, border, warning) — no hardcoded hex or `text-white`; layout works in RTL.
- Numbers and dates formatted with `en-US`.

## 5. Case E2E flow test

New `e2e/case-flow.spec.ts`:

- Signed out: `/team/cases/<id>` and `/admin/cases/<id>` never render the case header.
- Signed in (injected session, skipped when absent): open a real case from the pipeline list, assert header shows the case reference and a status chip, walk all five tabs and assert each renders its heading, assert no raw i18n keys (`case.`, `sheets.`) or raw DB tokens (`payment_confirmed`, `appointment_scheduled`) leak into the rendered text, and assert the needs-attention panel either lists tasks with actionable buttons or is absent.

Runs in the existing Playwright CI workflow alongside the current specs.

## Technical notes

- Work stays in `src/pages/team/CaseDetailPage.tsx` plus a new `src/components/cases/CaseAttentionPanel.tsx` (task derivation as a pure function so it is unit-testable) and `src/components/cases/CaseProgressRail.tsx`.
- Task derivation reads already-fetched data (`cases`, `case_submissions`, `documents`, `appointments`, `platform_settings.forgotten_*`) — no new queries, no schema or RLS changes.
- Hardcoded `PIPELINE_STAGES` and `STATUS_COLORS` in the page are dropped in favour of `usePipelineStatuses` + `statusColorClasses`.
