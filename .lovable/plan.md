# Fix the cut-off PDF export and audit every download in the app

## What is wrong (confirmed by reading the code, not guessed)

The PDF and the Excel file are built from the same report definition, but the PDF drawing layer has two concrete defects:

1. **Columns run off the page — the "cut off" you saw.**
   Each column is given a fixed minimum width (text 18mm, status 22mm, dates 24mm, money 26mm). The Students sheet shows 19 columns in the team view, which needs about 380mm of width. A landscape A4 page only has 277mm of usable width. The table engine honours those minimums, so everything past roughly the 14th column is drawn outside the paper and disappears.

2. **Sheets with no rows are silently dropped.**
   The PDF builder removes any sheet that currently has zero rows, while the contents page still lists it. So the file can genuinely be missing whole sections — which matches "it doesn't have the full spreadsheets".

There is a third risk to verify rather than assume: the full-report button loads every sheet, but a sheet whose data fails to load is swallowed by one shared error handler, which would also produce a short file. This gets tested, not guessed.

## Approach

### Step 1 — Reproduce and measure first
Generate real PDFs from the actual export code for the worst cases (Students 19 columns, full multi-sheet report, Arabic interface, empty sheet, one row, several hundred rows), render every page to an image and inspect each page. No fix is written before the failure is visible in a rendered page, and the same rendering check is repeated after each fix.

### Step 2 — Make wide tables fit, losslessly
- Measure the real text width of each column and fit the table to the printable area instead of applying fixed minimums.
- When a sheet is genuinely too wide to stay readable, continue the remaining columns on a following page that repeats the row's identifying column (case reference / name), so no column is ever lost or clipped.
- Page orientation is chosen from the fitted width, not from a fixed column count.

### Step 3 — Never drop a section
- Every sheet in the report appears in the PDF. A sheet with no records prints its title and a clear "No records" line.
- The contents page and the actual sections always match.
- If a sheet fails to load, the export says which one instead of quietly shipping an incomplete file.

### Step 4 — Audit every other download the same way
Each one gets generated, opened and checked, then fixed if it fails:
- Spreadsheet page: single-sheet Excel, single-sheet PDF, full workbook Excel, full workbook PDF, school packet Excel, school packet PDF (admin and team views).
- Payouts report (Excel + PDF).
- Admin inbox export.
- Student invoice PDF (admin block and public invoice page).
- CV / Lebenslauf PDF.
- Document downloads in the student and team document panels.

Checked on every file: nothing clipped at the page edge, Arabic and Hebrew joined and in the right direction, right-to-left column order in Arabic, currency symbols correct, totals row present and matching Excel, headers repeated across pages, page numbers and footer intact, sensible file name, and a clear message instead of an empty file when there is no data.

### Step 5 — Close out
Re-generate and re-inspect everything after the fixes, confirm nothing that already worked regressed, and run the type check, test suite and build.

## Technical notes
- Frontend/export layer only. No database, permission, commission or business-logic changes.
- Shared work stays in `src/utils/export/pdfReport.ts` so the Excel and PDF versions of a report can never drift apart.
- Wide-table fitting and column continuation are added as pure, unit-tested helpers.
- Any new interface text is added to English and Arabic together.
