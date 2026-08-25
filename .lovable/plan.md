# CV Builder audit — fact-check result and fix plan

I verified every claim in the audit against the actual code. Result: **8 of 10 findings are real, 1 is overstated, 1 is a wrong severity call.** No claim was fabricated, but a few details are inaccurate.

## Verification results

| # | Audit claim | Verdict | Evidence |
|---|---|---|---|
| 1 | PDF slices through entries mid-content | **CONFIRMED** | `cvPdf.ts` slices one tall PNG at fixed 297mm offsets. `break-inside-avoid` only affects browser print, not a raster image. All 4 templates do emit `.cv-entry`, so the proposed fix is feasible. |
| 2 | Near-blank trailing page, no epsilon | **CONFIRMED** | `while (position - A4_HEIGHT_MM > -imgHeightMm)` has no tolerance. |
| 3 | `html2canvas` undeclared | **CONFIRMED** | Absent from `package.json`; resolves only as an **optional** dep of `jspdf@4.2.1`. Optional makes it more fragile than the audit states. |
| 4 | Project URL dropped in german-standard + academic | **CONFIRMED** | `p.url` is rendered only in `EuropassTemplate` and `ModernSidebarTemplate`. |
| 5 | `migrateDraft` drops newly added sections | **CONFIRMED** | `useLebenslauf.ts` filters a stored `sectionOrder` but never appends missing `ALL_SECTIONS` keys; all templates render from `sectionOrder`, so an old draft can permanently hide a section. |
| 6 | Mobile overflow in language/certificate/reference rows | **CONFIRMED** | `flex gap-2` rows with `flex-1` inputs and fixed `w-20`/`w-24`/`w-28` controls, no `min-w-0`, no `flex-wrap`. |
| 7 | Email labelled `*` but not required | **CONFIRMED** | `CVForm.tsx` renders `{f("email")} *`; `validate()` only checks format when non-empty. |
| 8 | No date-order validation on experience/volunteer | **CONFIRMED** | `validate()` checks `data.education` only. |
| 9 | Sections hint says "hide" but no hide control exists | **OVERSTATED** | Both `en` and `ar` locale values already read "Reorder sections…". Only the **inline English fallback string** in `CVForm.tsx:499` is stale — users never see it unless the locale file fails to load. Cosmetic code-comment-level issue, not a UI defect. |
| 10 | CV font presets reference unloaded fonts | **CONFIRMED, and worse than stated** | `index.html` loads only Tajawal / IBM Plex Sans Arabic / Noto Sans (+Arabic). Inter, Source Sans 3, IBM Plex Sans, Source Serif 4, Merriweather, IBM Plex Mono all silently fall back. |

### Other inaccuracies in the audit (do not affect the fixes)
- It says "12 sections"; `ALL_SECTIONS` has **10** (`personal` and `signature` are not orderable sections).
- It calls `html2canvas` a plain transitive dep; it is an **optional** dep of jspdf.

## Fix plan

Ordered by impact. Each is the smallest correct change; no refactors, no files outside the CV builder.

1. **PDF entry-aware pagination.** Add pure `computeEntryShifts(entries, pageHeight)` to `cvLayout.ts`. In `cvPdf.ts`, measure `.cv-entry` elements inside `#cv-capture`, apply the shift as a temporary `marginTop` (moved to the preceding `h2` heading when one is the immediate previous sibling, to avoid orphan headings), capture, then restore all mutated styles in a `finally`. Replace the stale comment.
2. **Trailing-page epsilon.** Drop a final slice shorter than ~5mm in the `cvPdf.ts` page loop.
3. **Declare `html2canvas`** in `package.json` dependencies and refresh the lockfile.
4. **Render `p.url`** in `GermanStandardTemplate` and `AcademicTemplate`, mirroring the Europass markup.
5. **`migrateDraft`:** append any `ALL_SECTIONS` keys missing from a stored `sectionOrder`, preserving stored order first.
6. **Mobile rows:** add `min-w-0` to the `flex-1` inputs and `flex-wrap` to the language, certificate and reference row containers. Leave the `grid grid-cols-2` pairs alone.
7. **Email:** make it required in `validate()` so the label and the gate agree (see question below).
8. **Date-order validation** for experience and volunteer, displayed inline like education's, non-blocking.
9. **Sections hint fallback:** update the stale inline English fallback string only; locale files already correct.
10. **Fonts:** decision needed (see below).

## Tests and checks
- Extend `cvLayout.test.ts`: `computeEntryShifts` — inside page, straddling, taller-than-page, cumulative, degenerate inputs.
- New `useLebenslauf.test.ts`: `migrateDraft` section-order merge (missing keys appended, order preserved, unknown keys dropped).
- Extend `CVPreview.test.tsx`: project URL renders in german-standard and academic.
- `npx tsgo --noEmit`, focused `vitest run src/components/lebenslauf`, eslint on changed files. No browser/E2E.
