# Spreadsheet Hub — readable labels, E2E tests, final audit

## 1. Human words instead of raw keys and raw database values

The tab and column titles are already translated, but the **cell values** are still raw database strings (`enrollment_paid`, `pending`, `partner_commission`, `true`, `social_media_partner`). Those are what read like code.

Add a shared value-translation layer used by every sheet:

- **Case / payment status** — `new`, `contacted`, `appointment_scheduled`, `profile_completion`, `payment_confirmed`, `submitted`, `enrollment_paid`, `cancelled`, `forgotten` → Arabic/English wording matching the pipeline names already used elsewhere in the app.
- **Reward & payout status** — `pending`, `approved`, `paid`, `rejected`.
- **Commission kind / source** — team commission, partner commission, referral, apply page, contact form, manual, submit new student.
- **Role** — admin, team member, partner, student.
- **Payment method** — bank transfer, cash, other.
- **Booleans** — Active/Inactive instead of true/false.
- **Program type** — language course, foundation, university, other.
- **Month column in Taxes** — `2026-08` → `August 2026` / `أغسطس 2026`.

Unknown values fall back to the raw string so nothing ever renders blank. Excel exports use the same translated text, so a downloaded workbook reads the same as the screen. Status cells also get the shared colour badges the rest of the dashboard uses.

New keys go under `sheets.value.*` in `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`.

## 2. E2E tests

Add `e2e/spreadsheet.spec.ts` to the existing Playwright suite:

- `/admin/spreadsheet` and `/team/spreadsheet` redirect signed-out visitors to login (authorization guard).
- Signed-in team member sees exactly three tabs (My Students, My Commissions, My Performance) and no Payouts, Taxes, or Catalog tab.
- Tab switching renders the matching sheet header.
- Search box filters rows; clearing restores the count.
- No raw key text (`sheets.`) and no raw status token (`enrollment_paid`) appears anywhere in the rendered page — this is the regression guard for item 1.
- Empty state shows the translated "no data yet" message rather than a blank card.

Also add a unit test for the value-translation helper (`src/components/spreadsheet/sheetLabels.test.ts`) covering every mapped value plus the unknown-value fallback, so the suite runs in CI even when the browser binary is unavailable.

Both are wired into the existing `.github/workflows/ci.yml` job.

## 3. Deep final audit

Read-only pass, reported in chat, no silent changes:

- **Row-level security** — re-run the linter and security scan; confirm the Spreadsheet Hub queries cannot return another person's rows for a team member (students, commissions, performance), and that the taxes rollup stays admin-only.
- **Money correctness** — verify the totals row, the VAT split, and the net-margin figure against the same numbers computed directly from the database.
- **Scope leakage** — confirm no hidden column (platform revenue, other people's payouts, phone numbers beyond what a role already sees) is present in the exported Excel file even when hidden on screen.
- **Data integrity** — check for orphaned payout and reward rows and report anything the earlier audit left open.
- **Frontend quality** — typecheck, build, translation-key completeness sweep across both locales.

Anything found gets listed with severity and file; fixes only after review.

## Technical notes

- New file `src/components/spreadsheet/sheetLabels.ts` exports a `useSheetLabels()` hook returning a `translateValue(column, value)` function; `SheetTable.tsx` calls it for `type: 'enum'` columns, and `SpreadsheetHub.tsx` marks status/kind/role/method/active columns with that type.
- `exportUtils.ts` receives already-translated cell text, so no export-side changes are needed.
- No database or edge-function changes in this plan.
