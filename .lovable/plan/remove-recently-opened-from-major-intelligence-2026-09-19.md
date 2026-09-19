# Remove "Recently opened" from Major Intelligence

Remove the "Recently opened" section from the internal Major Intelligence page (`/team/majors`). The page will show only the search box and the subject list, as before this feature existed.

## Changes

1. `**src/pages/team/TeamMajorIntelPage.tsx**`
  - Remove the `recentIds` state, the `recent` memo, and the "Recently opened" section (the block rendering `t('intel.recent', 'Recently opened')` with its tile grid).
  - Remove the `pushRecentMajor` / `readRecentMajors` import and the `setRecentIds(pushRecentMajor(...))` call inside `open()` (opening a subject stays unchanged otherwise).
  - Remove the now-unused `History` icon import.
2. **Cleanup of now-unused code**
  - Delete `src/lib/intel/recentMajors.ts` and `src/lib/intel/recentMajors.test.ts` (no other file imports them — verified by search).
3. **i18n**
  - Leave the orphaned `intel.recent` key in en/ar locale files (harmless; the parity guard only flags missing keys, not orphans). Remove it only if preferred — default: keep.if not needed remove for cleaner repo 

## Verification

- `npm run build` clean.
- `npx vitest run` passes (recentMajors tests removed with the file).
- Open `/team/majors`: no "Recently opened" section; search and subject cards work unchanged; opening a subject still works.