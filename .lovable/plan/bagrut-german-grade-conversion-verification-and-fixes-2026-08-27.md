# Bagrut → German grade conversion: verification and fixes

## Verdict

The formula shape is correct (Modified Bavarian Formula), but three real defects exist.

The app uses:

```text
German = 1 + 3 × (Nmax − Average) / (Nmax − Nmin)
```

which is the standard modified Bavarian formula. However:

### 1. Two different minimum-pass values live in the codebase
- `src/pages/team/BagrutConverter.tsx` (team + student tool): `NMIN = 56`
- `src/components/calculator/GpaCalculator.tsx` (public page): `NMIN = 56`
- `src/utils/gradeConverter.ts` (tested utility): `N_min = 55`

The same Bagrut average therefore converts to two different German grades depending on which screen the user is on. The Israeli Bagrut passing mark is 55, which is what the tested utility uses and what uni-assist-style conversions assume.

### 2. Results are clamped to 4.0, hiding failures
Both UI calculators do `Math.min(4.0, raw)`. An average of 40 (a fail) renders as a clean "4.00 — Pass" instead of an out-of-range/fail result. Only a soft amber warning appears. This is misleading for a student or team member quoting the grade.

### 3. Duplicated math instead of the shared, tested helper
`gradeConverter.ts` already implements the conversion plus interpretation bands and is covered by `gradeConverter.test.ts`. Both UI calculators re-implement it inline, which is how the 55/56 divergence appeared.

## Plan

1. Standardise on `N_min = 55` as the single passing mark.
2. Make `src/utils/gradeConverter.ts` the only implementation; both calculators compute the weighted average, then call `bagrutToGermanGrade(average)`.
3. Stop clamping at 4.0. When the average is below the passing mark, show the failing result explicitly (grade shown as "—" / not convertible with a clear message) rather than a fake 4.00.
4. Update the on-screen formula caption (currently hardcoded `(100 − 56)`) to match, in both calculators and both locales.
5. Add a disclaimer line noting the receiving institution / uni-assist may apply a different conversion (already present as a code comment, not shown to users).

## Technical notes

- Files: `src/utils/gradeConverter.ts` (source of truth), `src/pages/team/BagrutConverter.tsx`, `src/components/calculator/GpaCalculator.tsx`.
- i18n: any changed caption/warning strings added to `en` + `ar` `resources.json` together (parity guard in `src/lib/i18nKeys.test.ts`).
- Tests: extend `gradeConverter.test.ts` for the below-pass (non-clamped) path; run `npm run build` and `npx vitest run`.
- No backend, RLS, or money-path changes.
