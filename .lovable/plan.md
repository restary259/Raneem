# Verification report — CV Builder fix commit 60ca22f5

Fact-checked against the working tree and git history. No files were modified.

## Verdict: the commit does what the report claims (9.5 / 10 items verified)

| # | Claim | Verified | Evidence |
|---|-------|----------|----------|
| 1 | Entry-aware PDF pagination | YES | `computeEntryShifts()` in `cvLayout.ts`; `shiftStraddlingEntries()` in `cvPdf.ts` inserts spacers, restored in `finally`; spacer anchors to a preceding `H2` |
| 2 | Trailing near-blank page dropped | YES | `slicePageCount()` with `PDF_TRAILING_EPSILON_MM = 5`, used in the page loop |
| 3 | html2canvas direct dependency | YES | `"html2canvas": "^1.4.1"` in `package.json`, present in `package-lock.json` and installed in `node_modules` |
| 4 | `projects[].url` rendered in german-standard + academic | YES | line 72 of `GermanStandardTemplate.tsx`, line 97 of `AcademicTemplate.tsx` |
| 5 | `migrateDraft` appends missing sections | YES | stored order filtered to known keys, then `ALL_SECTIONS` remainder appended |
| 6 | Mobile wrap on languages/certificates/references | YES | `flex flex-wrap` + `flex-1 min-w-0` on rows at lines 368, 405, 445 of `CVForm.tsx` |
| 7 | Email required + localized | YES | `val_emailRequired` in both `en` and `ar` `resources.json` (line 248), used in `validate()` |
| 8 | from > to validated for experience + volunteer | YES | `exp_`/`vol_` checks in `LebenslaufBuilder.tsx`, inline errors at `CVForm.tsx` 271 and 432 |
| 9 | Sections hint reworded | YES | in the `CVForm.tsx` diff |
| 10 | 6 font families loaded + `document.fonts.ready` | YES | all six added to the Google Fonts `<link>` and `<noscript>` in `index.html`; `await document.fonts.ready` before capture in `cvPdf.ts` |

## Gates re-run here

- `npx tsgo --noEmit -p tsconfig.app.json` — clean.
- `npx vitest run src/components/lebenslauf src/lib/i18nKeys.test.ts` — 49/49 pass across 5 files, including the new `computeEntryShifts` / `slicePageCount` / `migrateDraft` / project-URL tests.
- Commit stat matches the report exactly: 16 files, +301 / −45.

## Corrections to the report

- **"1302/1302 tests"** — not reproducible here; the full suite was not run to completion (it previously exceeded the command timeout). The scoped CV + i18n run is green (49 tests). Treat the 1302 figure as unverified rather than wrong.
- **eslint "clean"** — a pre-existing React `key` warning fires from `ModernSidebarTemplate` (`mainKeys.map(key => renderMainSection(key))`, line 245) during tests. That file was not touched by the commit, so the claim "pre-existing" holds, but the builder is not warning-free.

## Residual risks (accurate as stated)

Rail/sidebar blocks in academic and modern-sidebar carry `.cv-entry` inside a parallel flow that the cumulative-shift model cannot move, so those can still slice at a boundary. Bullet index keys, FileReader error handling, ISO date rendering and large-canvas memory remain open.

## Not verified (needs a browser, out of scope here)

Actual multi-page PDF output, RTL capture, real font substitution in the PDF, and 320–430px layout behaviour. Unit tests cannot observe layout in jsdom.

## Note

The commit landed directly on `main`, contrary to the repo's branch + PR guideline. No action proposed unless you want it reverted and re-landed via PR.
