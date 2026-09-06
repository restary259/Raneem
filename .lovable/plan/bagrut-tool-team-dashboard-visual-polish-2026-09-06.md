# Bagrut Tool (Team Dashboard) — Visual Polish

Scope: `src/pages/team/BagrutConverter.tsx` + i18n keys only. No logic, formula, or calculation changes.

## Fixes

1. **RTL placeholder fix** — grade input placeholder `100-0` renders reversed in Arabic. Replace with a localized placeholder: `0–100` in English, `من 0 إلى 100` in Arabic (via i18n key, not an isAr ternary in the placeholder string — follow existing `isAr` pattern used in this file since it's already established there).

2. **Wider, balanced layout** — change container from `max-w-3xl` to `max-w-5xl`; on desktop use a two-column layout: subject groups on one side, results + actions in a sticky side column (single column on mobile, results appear below as today). Keeps the tool visually balanced on wide screens.

3. **Per-row grade feedback** — when a grade is entered, tint the input border/text by band: emerald (≥80), blue (65–79), amber (55–64), destructive (<55) — same bands as `getAverageColor`. Uses existing semantic/token colors, no new hardcoded palette.

4. **Labeled Reset button** — replace icon-only reset with an outline button showing the rotate icon + "إعادة تعيين" / "Reset" label; keep Calculate as the primary action.

5. **Copy result summary** — small "نسخ النتيجة" / "Copy result" button on the results card. Copies a one-line bilingual-safe summary (average, German grade, label) to clipboard with a success toast. Uses existing toast system. Pure client-side, no backend.

## i18n
- New keys (`team.bagrut.gradePlaceholder`, `team.bagrut.copyResult`, `team.bagrut.copied`, reset label if missing) added to BOTH en and ar `dashboard.json` — parity-guarded by `src/lib/i18nKeys.test.ts`.

## Verification
- `npm run build` clean, `npx vitest run` green.
- Playwright screenshots: Arabic desktop (empty + filled), English desktop, mobile — confirm layout balance, row tinting, placeholder direction, and copy button.
