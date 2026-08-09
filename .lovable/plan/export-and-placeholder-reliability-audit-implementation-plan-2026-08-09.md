# Export and placeholder reliability audit — implementation plan

## Confirmed diagnosis

- Both uploaded payout PDFs are byte-equivalent in behavior and visibly broken. The Arabic student name is manually reshaped/reordered, while the ILS symbol `₪` is drawn with WinAnsi Helvetica and becomes `ª`. Text extraction confirms `1,000 ª`; font inspection confirms the Arabic font is embedded but the Latin/currency cells still use Helvetica.
- `src/utils/exportUtils.ts` applies one font to an entire cell and manually transforms RTL text before AutoTable measures/draws it. This is fragile for mixed Arabic/Latin/numeric/currency content and produces poor Arabic order/alignment.
- The payout PDF title and some formatting are hardcoded in English even when the dashboard is Arabic.
- Live translation mismatches render unresolved placeholders such as `{{n}}`: several locale keys expect `n`, while their components pass `count`. Confirmed examples are referral totals, notification ages, Admin Command Center alerts, and linked-accommodation counts.
- Excel export logic is split between the modern corporate workbook engine and unused legacy helpers. There are currently no automated export tests.
- Spreadsheet enum columns are all mapped to `status`, so ordinary role, payment-method, month, and boolean columns receive incorrect status formatting/alignment.
- The current corporate Excel accounting format intentionally displays numeric zero as an em dash. Because the reported requirement is to show `0` as a number, zero formatting must be corrected consistently.
- Additional download paths exist outside the Spreadsheet Hub: admin inbox CSV, CV browser-print PDF/image export, student-data JSON, and uploaded-document downloads. Only generated tabular/report exports require content changes; file passthrough downloads should be regression-checked but not rewritten.

## Implementation

### 1. Repair the shared PDF engine

- Replace the fragile per-cell shaping behavior with a deterministic RTL-safe rendering path that embeds Unicode Arabic and Hebrew fonts and preserves Arabic joining, punctuation, Latin text, ASCII digits, `₪`, and `€` in mixed-content cells.
- Select fonts and alignment from the original logical text, not already-reordered output; keep RTL cells right-aligned and LTR/numeric cells appropriately aligned.
- Use the header count for orientation and shared layout thresholds, handle empty reports safely, wrap long cells, and preserve headers/footers across pages.
- Accept report locale/direction and typed columns so dates, numbers, currencies, zero, negatives, and missing values are formatted centrally instead of preformatted at each caller.
- Fail visibly instead of silently generating an unreadable document if a required font cannot register.

### 2. Rebuild the payout PDF call site

- Route the payout report through the repaired shared PDF API with typed columns.
- Localize the report title, headers, roles, statuses, methods, dates, and empty-value labels in Arabic and English.
- Render amounts as valid ILS values with the real `₪` glyph, ASCII digits, correct grouping, and numeric `0` rather than `ª`, blank text, or an unresolved token.
- Preserve all payout rows and linked-student names without changing payout data or business logic.

### 3. Standardize Excel and CSV exports

- Make the corporate workbook engine the single Excel implementation; remove or reduce unused legacy Excel helpers to wrappers so future callers cannot bypass RTL, typing, and formatting rules.
- Correct zero formats for number/currency totals to display `0` / `₪0.00` / `€0.00` as appropriate, while retaining valid negative and positive formatting.
- Map only true status enums to status styling; export role, method, month, program type, boolean, and kind as ordinary translated text.
- Keep Arabic workbooks right-to-left, preserve native numeric/date cells, distinguish ILS agency fees from EUR school costs, sanitize unique sheet names, and verify formulas/totals do not trigger Excel repair warnings.
- Harden the admin inbox CSV with consistent UTF-8 BOM, escaped headers/values/newlines, stable column ordering, and Arabic compatibility.

### 4. Eliminate unresolved interpolation tokens

- Standardize count interpolation on `count` in both Arabic and English locale files so i18next plural/count conventions are consistent.
- Fix all confirmed callers/resources for referral totals, notification time labels, Admin Command Center alerts, and accommodation counts.
- Audit every locale namespace and every `t()` call for variable-name mismatches, including non-count placeholders, and correct active mismatches without changing wording unnecessarily.
- Add a static test that fails when a translation call supplies variables that do not match the placeholders in the resolved Arabic/English resource.

### 5. Audit remaining generated downloads

- Verify Spreadsheet Hub full workbook, individual sheet, school packet, payouts workbook/PDF, inbox CSV, CV print-to-PDF, CV PNG/JPG, and student-data JSON.
- Keep uploaded document/chat attachment downloads as byte-preserving passthroughs and confirm their filenames and MIME behavior remain unchanged.
- Ensure every generated download has a consistent safe filename, correct MIME type, and user-visible error state.

## Tests and acceptance checks

- Add unit tests for PDF script detection/font selection, Arabic logical order, mixed Arabic + ASCII digits + `₪`, empty reports, multipage headers, and missing-font failure.
- Add workbook tests for RTL sheet views, Arabic headers/cells, native dates/numbers, ILS/EUR formats, literal zero display, negative values, totals formulas, enum styling, empty sheets, and sheet-name sanitization.
- Add translation interpolation tests covering both locale files and representative runtime calls; assert no rendered output contains `{{...}}` or `((...))`.
- Add CSV tests for Arabic, commas, quotes, and line breaks.
- Run the full automated test suite, then create fresh Arabic and English exports from every active report path.
- Open each generated XLSX with a workbook parser to check values, formulas, dimensions, RTL metadata, and absence of repair conditions.
- Render every generated PDF page to images and visually inspect all pages for joined Arabic, correct RTL order, readable mixed text, valid `₪`/`€`, clipping, overlap, wrapping, margins, and page order. Re-run until clean.
- Compare the repaired payout PDF against the two uploaded samples: the student name must be readable in the correct order and the amount must read `1,000 ₪` (or its localized equivalent), never `1,000 ª`.

## Expected files

- Shared export utilities under `src/utils/export/`, `src/utils/exportUtils.ts`, and `src/utils/pdfFonts.ts`
- Payout report caller in `src/components/admin/PayoutsManagement.tsx`
- Spreadsheet mapping/formatting files under `src/components/spreadsheet/`
- Admin inbox CSV helper in `src/pages/admin/AdminInboxPage.tsx`
- Arabic and English locale JSON files, plus focused export/interpolation tests