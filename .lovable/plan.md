# Upgrade i18next (23 -> 26) directly in Lovable (syncs to GitHub; PR #149 can then be closed)

## Current state (confirmed)
- App uses `i18next ^23.11.5`, `react-i18next ^14.1.0`, `i18next-http-backend ^3.0.2`, React 19, TypeScript 5.8.
- PR #149 (Aikido bot) bumps only `i18next` by three major versions. It does not touch `react-i18next` or the HTTP backend, so peer compatibility is the main risk.

## Verification steps (read-only, no merge)
1. Pull the PR diff from GitHub: confirm it changes only `package.json` + `bun.lock` and check its CI result (lint, unit tests, typecheck, build).
2. Read the advisory Aikido is fixing, and confirm 26.x is the minimum fixed version (or whether a 23.x/25.x patch exists, which would be lower risk).
3. Check peer ranges from the npm registry:
   - `react-i18next@14` peer `i18next` range — if it excludes 26, the PR must also bump `react-i18next` (likely to 16.x), plus check that version's React 19 / TS requirements.
   - `i18next-http-backend@3` compatibility with i18next 26.
4. Review i18next 24/25/26 breaking-change notes against how we use it in `src/i18n.ts`:
   - object form `fallbackLng: { he: ['en'], default: ['ar'] }`
   - `partialBundledLanguages`, `supportedLngs`, `react.useSuspense: true`
   - `t(key, fallbackString)` second-argument default value (used everywhere)
   - `returnObjects: true` call sites and TypeScript `t()` typing changes
   - removal of legacy formats / `compatibilityJSON`, Node/runtime minimums (Cloudflare Worker SSR).
5. In a scratch copy under `/tmp` (not the project), install the PR's lockfile and run `tsc --noEmit`, `vitest run` (incl. i18n parity + Hebrew coverage guards) and `vite build`, then SSR-render `/`, `/faq`, `/student` in ar/en/he to confirm translations, RTL, and Hebrew->English fallback still work.

## Outcome
A short verdict: **merge as-is**, **merge after adding the react-i18next bump**, or **do not merge** (with the exact blocker). If extra version bumps are needed, a follow-up build-mode change updates `package.json` + regenerated `bun.lock` together.

## Technical notes
- No database, backend, or translation-file changes.
- Nothing is merged without your confirmation.
