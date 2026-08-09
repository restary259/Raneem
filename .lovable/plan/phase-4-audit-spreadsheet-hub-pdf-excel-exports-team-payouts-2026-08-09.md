# Phase 4 Audit — Spreadsheet Hub, PDF/Excel Exports & Team Payouts

Audit only. Findings first, fix plan per item at the end.

## 1. Garbled Arabic/Hebrew in the payout PDF — ROOT CAUSE CONFIRMED

Pipeline: `src/components/admin/PayoutsManagement.tsx` (`exportPdf`) → `src/utils/exportUtils.ts` (`exportPDF`, jsPDF + jspdf-autotable) → `src/utils/arabicFontLoader.ts` (`registerArabicFont`).

The loader downloads a font at runtime from
`https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUqkJA.ttf`.
**That URL returns HTTP 404.** Verified this turn.

Consequences, in order:
- The fetch throws, and `registerArabicFont` swallows it in a `try/catch` that only does `console.warn` — the export still "succeeds".
- No `Amiri` font is ever registered in the jsPDF VFS, so the `font: 'Amiri'` styles passed to autoTable fall back to **Helvetica**, a standard-14 PDF font with **WinAnsi (cp1252) encoding and no Arabic/Hebrew glyphs**.
- jsPDF then writes the UTF-16 code units of each Arabic character byte-by-byte through cp1252, which is exactly the `þáþôþáþ³` pattern seen in `payouts-2026-08-09.pdf`. This is a font-embedding failure, not a data/encoding failure — the names are correct in the database and correct in the Excel export.

Secondary defects in the same path:
- `processArabicText` is imported in `exportUtils.ts` but never called, and its implementation (reverse the whole string) is wrong anyway: it would break mixed Arabic/Latin/digit strings and does no letter shaping/joining.
- Even with a working font, jsPDF does not do Arabic shaping or bidi, so text would render as disconnected, reversed letterforms.
- Network-dependent font loading means the PDF silently degrades whenever gstatic is slow/blocked.

## 2. Spreadsheet Hub filtering — School and Month filters DO NOT EXIST

`SpreadsheetHub.tsx` renders tabs and `SheetTable`. `SheetTable.tsx` offers only a free-text `search` box plus column visibility toggles. There is no School selector, no Month selector, and no combined filtering. `school_name` and `intake_month` exist as *columns* on the Students sheet, so text search can accidentally match them, but that is not filtering (searching "September" also matches any other column containing the word). `SheetTableProps` has an unused `Extra toolbar controls (filters)` slot — the hook exists, nothing is wired to it.

Status: **not implemented**, so "School A + September" cannot work.

## 3. Spreadsheet content vs. what a school actually needs

Students sheet currently exports: case reference, full name, phone, city, status, team member, partner, school, program, accommodation, insurance, intake month, course start, course end, program price, accommodation price, insurance price, total (EUR), service fee (ILS).

Missing for a school to process an application:
- **Email address** (schools correspond by email — completely absent).
- **Passport number / passport type / date of birth / gender / nationality** — captured on `case_submissions`/`cases` but not exported.
- **Education level** (added in Phase 3, not surfaced in the sheet).
- **Program duration in weeks** and accommodation duration/dates — only course start/end are present.
- **Insurance start date**, application/submission date, enrollment date.
- Internal columns that should *not* go to a school: partner, team member, service fee (ILS agency fee). Today there is one shared column set with no school-facing variant.

## 4. Formatting issues in the Excel export

`src/utils/export/corporateSheet.ts` sets `wrapText` on the header row and computes widths as `max(longest cell + 4)` clamped by `LAYOUT.minColWidth`/`maxColWidth`. Practical consequences:
- Long values (linked student lists, notes, program names) exceed `maxColWidth` and are clipped/spill because **data rows do not set `wrapText` and rows have no auto-height**.
- Width is computed from raw values, not formatted output, so currency/date cells render wider than the reserved width (`₪1,234,567.00` vs `1234567`) → visible `####` on numeric columns.
- RTL Arabic in a header cell centred with wrap can visually overlap adjacent short headers.
UNVERIFIED: exact per-column breakage in the user's file — needs one generated workbook opened and inspected.

## 5. `#REF!` errors

Not reproduced in this audit — **UNVERIFIED**. Highest-probability cause, from reading `corporateSheet.ts`: worksheets are built with an ExcelJS **table** (`ws.addTable`) that has `totalsRow: true` and `totalsRowFunction: 'sum'`. When a sheet is exported with **zero data rows** (which happens today: the empty team-commission tab, and any month/school with no cases), the table's data range collapses and ExcelJS emits a table ref/totals formula over an invalid range — Excel repairs it into `#REF!`. The branded title/subtitle rows inserted above the table are also a common source of off-by-one table anchors.
Verification step before fixing: export the full workbook, unzip the `.xlsx`, and grep `xl/tables/*.xml` + `xl/worksheets/*.xml` for `#REF!` / mismatched `ref=` ranges.

## 6. PDF ↔ Excel parity

- Only **payouts** has both a PDF and an Excel export. The Spreadsheet Hub is **Excel-only** — no PDF exists for it, so parity cannot be assessed there.
- The two payout exports **do not match**: Excel has 10 columns (Request ID, Approval Date, Notes included); the PDF has 7.
- **Currency bug in the Hub export:** `src/components/spreadsheet/exportMapping.ts` hardcodes `currency: 'ILS'` for *every* currency column. Program/accommodation/insurance/total costs are EUR in the UI but are exported to Excel formatted as ₪. This is a real, silent financial mis-labelling.
- Null handling: the Hub maps raw values, so `null` dates/amounts land as blank cells (acceptable), but `payout_reference`, `transaction_ref` and `paid_at` can be `null` and are exported unlabelled. The PDF path stringifies with `String(c ?? '')` so no literal `undefined`; `Number(r.amount).toLocaleString()` would emit `NaN` if `amount` were ever null.

## 7. Team commission on ENROLLED — the mechanism EXISTS

It is not missing; it is wired end to end:
- `supabase/functions/admin-mark-paid` calls the `record_case_commission(case_id, total_payment_ils)` RPC.
- A DB trigger (`auto_split_payment`) also calls it when a case reaches `enrollment_paid`.
- Rules read from real config, no invented percentages:
  - Team member: `team_member_commission_overrides.commission_amount` for that member, else `platform_settings.team_member_commission_rate` (a **flat ILS amount**, default 100). Inserted into `rewards` as `reward_type='team'`, `status='pending'`.
  - Partner / master partner: `get_effective_partner_split()` pool split, plus a flat master override (`partner_commission_overrides.master_override_amount` → else `platform_settings.master_partner_override_rate`).
  - `cases.platform_revenue_ils = payment − team − pool − override`, and `commission_split_done` makes it idempotent.
- Current data: **exactly one** reward row exists overall — `team`, `pending`, ₪1,500. So the table looks empty mostly because almost no case has reached enrollment-paid, not because the mechanism is absent.
- Real gap: the Hub's Commissions sheet derives `kind` by string-matching `admin_notes` (`'Team commission…'`) instead of reading the `reward_type` column that already exists — fragile, and it mislabels any row whose note text changes. There is also no *payout* record created from a commission; payout is a separate manual `payout_requests` flow.

## 8. Team member stats

`src/pages/admin/AdminTeamPage.tsx` is a list with row actions (create member, copy referral link, commission override, role toggles). **Clicking a member opens no profile/stats view.**
Available today from existing data, no schema change needed: total assigned cases, cases by stage/status, enrolled count, conversion rate, commission earned / paid / pending (from `rewards` filtered by `user_id` + `reward_type='team'`), 20-day unlock dates, linked payout requests. The Hub's `fetchPerformanceSheet` already computes assigned/contacted/enrolled/conversion/earned/paid per person — it can back the panel directly.
Missing/derivable-only: average time-to-enroll and SLA breaches (computable from `case_events`), revenue attributed per member (needs `cases.platform_revenue_ils` join).

---

# Fix plan

### P0 — PDF non-Latin text (live financial document)
1. Stop fetching the font over the network. Vendor an Arabic+Hebrew-capable TTF (Noto Naskh Arabic or Amiri, plus a Hebrew-covering face) into `src/assets/fonts/` and register it from a bundled base64 module so the export cannot silently degrade.
2. Make `registerArabicFont` **fail loudly**: return a boolean; if registration fails, surface a toast and either abort or fall back to a Latin-only PDF with an explicit warning — never emit mojibake silently.
3. Add proper shaping/bidi rather than the string-reverse hack: run names through a bidi/shaper step before `doc.text`/autoTable, delete `processArabicText`, and set `styles.font` to the registered family name only after successful registration.
4. Regression test: generate the payouts PDF from a fixture containing an Arabic name and a Hebrew name, extract text with `pdftotext`, and assert the original strings round-trip.

### P0 — Currency mislabelling in Hub Excel export
Pass the column's real currency through `toExportColumns` instead of hardcoding `ILS`; EUR school costs and ILS agency fees must keep their own formats and separate totals.

### P1 — School + Month filtering
Add a filter bar to `SpreadsheetHub` (School select from `schools`, Month select derived from `intake_month`/`course_start`, both with an `'all'` sentinel per project convention), apply it to the loaded rows, feed the filtered set into both the table and every export, and stamp the active filters into the export header.

### P1 — School-facing export variant
Add a "School packet" column set: student ID/reference, full name, DOB, gender, nationality, passport type + number, email, phone, education level, school, program, duration/weeks, course start/end, accommodation + dates, insurance + start date, status, submission/enrollment dates — and exclude partner, team member and ILS service fee.

### P1 — `#REF!` and formatting
Verify first (unzip the generated xlsx, grep for `#REF!`). Then: skip `addTable`/totals row entirely for zero-row sheets and render a "no records" line instead; anchor tables from the real first data row; enable `wrapText` + auto row height on long text columns; compute widths from the *formatted* string; give notes/linked-students columns an explicit wider width.

### P2 — PDF/Excel parity
Drive both payout exports from one column definition so they always carry the same fields, with `—` placeholders for nulls.

### P2 — Team commission visibility & member stats
Read `rewards.reward_type` instead of parsing `admin_notes` in `fetchCommissionsSheet`. Add a team-member detail sheet on `AdminTeamPage` (click a row) showing cases by stage, enrolled count, conversion, and commission earned/pending/paid with unlock dates, sourced from the existing performance query. Show the configured commission rule (override vs. platform default) on the panel so admins see where the number comes from.
