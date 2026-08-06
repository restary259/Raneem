# CI failure audit and fix

## What I verified in the repo

The exact GitHub Actions log is not visible from here, so the failing step is unconfirmed. What I could confirm by reading the repo:

1. **`package-lock.json` is stale.** Its root `devDependencies` list contains only the original template packages — `vitest`, `@playwright/test`, and `jsdom` are missing entirely, and there are no lock entries for them. The workflow runs `npm install`, which papers over this by resolving from the network, but the install is non-deterministic and can pull versions that were never tested here. Any step that assumed `npm ci` would fail outright.
2. **The typecheck step is a no-op.** `npx tsc --noEmit` uses the root `tsconfig.json`, which has `"files": []` and only project references. It compiles nothing and exits 0, so type errors never fail CI — the check gives false confidence rather than protection.
3. **Backend E2E assertions silently skip.** `e2e/authorization.spec.ts` and `e2e/spreadsheet.spec.ts` read `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from `process.env`, and the workflow feeds them from repository `vars.*`. If those repo variables were never set in GitHub, every backend guard test skips and only the browser tests actually run.
4. **Two lockfiles coexist** (`bun.lock`, `bun.lockb`, and `package-lock.json`), so local runs and CI resolve dependencies through different paths.

Locally, on the current tree: typecheck is clean, `vitest run` passes 14/14, and the app builds.

## Plan

### Step 1 — Confirm the failing step
Re-run the workflow and read the log for the first failing step. If you can paste the failing step name and its error output, that pins the diagnosis; the fixes below are worth doing regardless.

### Step 2 — Make dependency install deterministic
- Regenerate `package-lock.json` from the current `package.json` so `vitest`, `@playwright/test`, `jsdom`, `exceljs`, and `jspdf` are all locked.
- Switch the workflow to `npm ci`, which fails loudly on drift instead of resolving silently.
- Decide on one lockfile for CI. Keeping `package-lock.json` as the CI source of truth and leaving the bun lockfiles for local use is fine, but they must not drift.

### Step 3 — Make the typecheck real
Replace `npx tsc --noEmit` with a command that actually compiles the app project (`tsc -b --noEmit` or `tsc --noEmit -p tsconfig.app.json`), so type regressions fail CI. Expect this step to start reporting real errors the first time it runs properly — fix whatever it surfaces.

### Step 4 — Make backend E2E coverage explicit
- Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` as repository variables in GitHub so the authorization and tax-rollup guards actually execute.
- Change the specs' skip behaviour under CI: when `process.env.CI` is set and the backend variables are missing, fail with a clear message instead of skipping, so a missing configuration never looks like a green run.

### Step 5 — Harden the E2E job
- Cache the Playwright browser download keyed on the `@playwright/test` version to cut install time and flakiness.
- Upload `test-results/` alongside `playwright-report/` so traces and failure screenshots come back with the artifact.

### Step 6 — Verify
Run the same sequence locally as CI runs it (`npm ci`, real typecheck, `npm run test`, `npm run build`, `npm run test:e2e`) and confirm each step passes before pushing.

## Technical notes

- Files touched: `.github/workflows/ci.yml`, `package-lock.json` (regenerated), `e2e/authorization.spec.ts`, `e2e/spreadsheet.spec.ts`.
- No application source, database, edge function, or RLS changes are part of this plan.
- Setting the GitHub repository variables in Step 4 has to be done by you in the repo settings; I cannot set them from here.
