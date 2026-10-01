# i18next 26 upgrade: verify + add runtime translation smoke test

## Verified state
- Latest commit `7614473b` (PR #149) changed only `package.json` + `bun.lock`: i18next 23 -> 26.4.2. `react-i18next` (14) and `i18next-http-backend` (3) unchanged.
- The preview build after that commit is green, and GitHub CI (lint, tests, typecheck, build, CodeQL) passed.
- The reviewer note is valid: the only i18n test (`src/lib/i18nKeys.test.ts`) and the Hebrew coverage test read JSON files; nothing actually starts i18next, so a loading/fallback regression would pass.

## Fixes
1. Run locally once: typecheck, full unit suite, and a page render of `/` in Arabic, English and Hebrew to confirm text, RTL and Hebrew->English fallback still work on 26.
2. Add `src/lib/i18nRuntime.test.ts` that initializes the real `src/i18n.ts` and checks:
   - bundled `common` resolves in ar/en/he without network;
   - an HTTP namespace (`dashboard`) loads (fetch stubbed to serve `public/locales/*`);
   - `{{var}}` interpolation works;
   - `t(key, "fallback")` default-value form works;
   - Hebrew missing key falls back to English, other missing keys to Arabic;
   - `languageChanged` sets `dir`/`lang` (rtl for ar/he, ltr for en).
3. If any check fails on 26, apply the smallest config fix in `src/i18n.ts` (or bump `react-i18next` together with a regenerated lockfile).
4. Record the guard in AGENTS.md.

## Technical notes
No database, backend, or translation-text changes.
