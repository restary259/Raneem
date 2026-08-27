# Export QA Audit — Excel + PDF

## What exists today (verified by reading the code)

Export surfaces found across the whole repo:

| Location | Excel | PDF | Notes |
| --- | --- | --- | --- |
| Spreadsheet Hub — full report (admin + team) | yes | **missing** | multi-sheet workbook + cover sheet |
| Spreadsheet Hub — school packet | yes | **missing** | identity-heavy student sheet |
| Spreadsheet Hub — every single sheet (`SheetTable`) | yes | **missing** | per-table export with column picker |
| Admin Payouts | yes | yes | only surface with both |
| Admin Inbox | CSV only | **missing** | raw `downloadCsv`, not the corporate workbook |
| Case invoice (admin block + public invoice page) | no | yes | `downloadInvoicePdf` |
| CV / Lebenslauf builder | no | yes | image-raster PDF, separate stack |

So: 5 Excel/CSV surfaces have no PDF, and the Inbox does not follow the shared export standard at all.

The PDF stack (`exportUtils.ts` + `pdfFonts.ts`) bundles Arabic and Hebrew fonts, but `shapeForPdf()` is currently a pass-through no-op — the code comment claims jsPDF shapes Arabic itself. That claim is unverified and is the single highest-risk item in this audit, since every Arabic PDF (payouts, invoices, and all new ones) depends on it.

## Approach

### Phase 1 — Prove what actually renders (no code changes yet)
Build a throwaway Node harness in `/tmp` that imports the real `exportUtils` / `pdfFonts` / `corporateSheet` modules and writes real files, then:
- render each PDF to images with `pdftoppm` and visually inspect every page (Arabic shaping/connection, RTL column order, mixed AR+EN, ₪/€ symbols, long names, page breaks, footers);
- open each XLSX with Python/openpyxl to confirm sheet names, headers, widths, number/date/currency formats, totals row, and no `[object Object]`/`undefined` leakage;
- run each through fixtures: 0 rows, 1 row, ~500 rows, very long Arabic and English text, missing optional values, special characters, large numbers.

Findings from this phase drive the fixes; nothing is declared working from code reading.

### Phase 2 — Fix the shared engine
- If Arabic renders disconnected or reversed, implement real shaping + bidi in `shapeForPdf` using the already-installed `arabic-persian-reshaper` and `bidi-js` (currently loaded but unused), applied per cell, with digits and Latin runs kept in logical order.
- Fix whatever else phase 1 surfaces: column widths/clipping, header repetition across pages, page numbers, RTL column reversal, empty-data handling (graceful toast instead of an empty file).

### Phase 3 — One shared PDF path for every workbook export
Add a small `exportCorporatePdf(report)` helper next to `exportCorporateWorkbook` that consumes the exact same `CorporateReport` object (title, subtitle, columns, rows, totals, locale, rtl) so Excel and PDF can never diverge. Multi-sheet reports become one section per sheet with page breaks.

Then wire a "PDF" button next to every existing Excel button:
- `SheetTable` (covers all Spreadsheet Hub sheets in both admin and team scope)
- Spreadsheet Hub full report
- Spreadsheet Hub school packet
- Admin Inbox — move it onto the shared export path so it gets a proper Excel workbook plus PDF (the current CSV download stays available)

Language follows the app's active language, as the payouts export already does.

### Phase 4 — Consistency + re-verification
- Unify filenames (`DARB-<report>-<YYYY-MM-DD>`), report titles, date and currency formatting, loading state, and failure toast across all surfaces.
- Regenerate every file after the fixes, re-inspect the rendered pages, and confirm no previously-working export regressed.

## Technical notes
- No database, RLS, auth, or business-logic changes. Frontend/export layer only.
- Existing working exports (payouts Excel, invoice PDF, CV PDF) are preserved as-is unless phase 1 shows a concrete defect.
- The CV builder PDF is a separate raster pipeline and is audited but not rewritten.
- New i18n keys are added to both `en` and `ar` together (parity guard).
- Finishes with `npm run build` and `npx vitest run` green, plus the completed verification matrix.
