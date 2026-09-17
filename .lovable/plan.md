# Make the spreadsheet download names say exactly what each file is

## Current state (verified in code)

Four download buttons on the Spreadsheet Hub (`src/components/spreadsheet/SpreadsheetHub.tsx`), plus two on each table (`SheetTable.tsx`):

| Button today | What the file actually is | Problem |
|---|---|---|
| Download Excel / Download PDF (per table) | The visible table, filtered rows | Accurate — keep |
| "School packet" (Excel) | Students identity sheet (name, passport type, school, program, costs in EUR) for forwarding to schools | Doesn't say Excel; doesn't say it's students-for-schools |
| "School packet PDF" | Same as PDF | Same |
| "Download full workbook" (Excel) | All tables (students, payments, payouts, commissions, taxes) + contents page | "Workbook" is jargon; Arabic "تنزيل الملف الكامل" is vague |
| "Download full PDF" (PDF) | Same content as PDF | Acceptable but should mirror the Excel name |

File names on disk are already clear (`DARB-team-report-2026-09-17.xlsx`, `DARB-school-packet-...`) — no change needed there.

## Changes (labels + i18n only, no logic)

1. Rename button labels in `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` together (parity-guarded):
   - `sheets.schoolPacket` → "School packet (Excel)" / "ملف المدارس (Excel)"
   - `sheets.schoolPacketPdf` → "School packet (PDF)" / "ملف المدارس (PDF)"
   - `sheets.exportWorkbook` → "Full report (Excel)" / "التقرير الكامل (Excel)"
   - `sheets.exportPdfWorkbook` → "Full report (PDF)" / "التقرير الكامل (PDF)"
2. Add a one-line hint under each button pair (or as the button `title`) stating contents:
   - School packet: "Student details and costs for schools" / "بيانات الطلاب والتكاليف للمدارس"
   - Full report: "All tables: students, payments, payouts, commissions, taxes" / "كل الجداول: الطلاب، الدفعات، المستحقات، العمولات، الضرائب"
   (new keys `sheets.schoolPacketHint`, `sheets.fullReportHint`, added to en + ar together)
3. Per-table "Download Excel / Download PDF" labels stay as-is.

## Technical notes
- Text-only change: two locale JSON files + the two button blocks in `SpreadsheetHub.tsx` for the hint lines. No export logic, file-name, or content changes.
- i18n parity guard (`src/lib/i18nKeys.test.ts`) must pass; then typecheck + build.
