# Darb — 3-Theme Dashboard System, Sleek Case Visuals, Unified Manager Pipeline

Visual/UX upgrade only. No changes to business rules, commissions, payments, RLS, auth, roles, routing, or workflow. Every dashboard keeps its current information architecture and permissions.

## Current state (verified)

- Theme is owned solely by `ThemeScope` (next-themes, `attribute="class"`, `storageKey="darb-theme"`), forced light on public routes, free on `/admin`, `/team`, `/partner`, `/student`. Only two states exist; `ThemeToggle` is a single ghost button in `DashboardLayout` (line 416).
- Tokens live in `src/index.css` (`:root` + `.dark`) and are wired through `tailwind.config.ts` (`primary`, `brand`, `muted`, `sidebar`, …). There is no third theme class.
- Status colors are hardcoded Tailwind palette strings in `src/lib/caseStatus.ts` (`STATUS_COLORS`, `COLOR_CLASSES`) — light-mode-only literals like `bg-blue-100 text-blue-800`, so they do not adapt per theme.
- Two separate pipeline surfaces exist: `TeamPipelinePage.tsx` (749 lines, manager assignment table with stage pills, quick filters, detail drawer) and `AdminPipelinePage.tsx` (1138 lines, board view with SLA). The manager currently gets only the table.
- Case stage visuals: `CaseProgressRail.tsx` (dot rail), `CaseStatusPipeline.tsx` (numbered circles, hardcoded `green-100`/`blue-100`/`gray-100`), `CaseTimeline.tsx`.

## Phase 1 — Theme foundation (3 themes)

1. Add a third theme class `.aurora` in `src/index.css` defining the full token set (background, card, popover, muted, border, primary, accent, sidebar, brand). Direction: deep indigo-slate layered surfaces, thin luminous borders, teal/violet gradient accent — premium fintech, not neon.
2. Extend `ThemeScope` to `themes={["light","dark","aurora"]}` keeping the same `darb-theme` storage key and forced-light public routes. No second theme system.
3. Add gradient/glow/elevation tokens (`--surface-raised`, `--ring-glow`, `--accent-line`) so components never hardcode effects; expose via `tailwind.config.ts`.

## Phase 2 — Semantic status tokens

4. New `src/lib/statusTokens.ts`: one map from pipeline stage + attention level to semantic class sets (`chip`, `line`, `dot`, `tint`) built on new CSS variables (`--status-new` … `--status-enrolled`, `--status-danger`), defined once per theme in `index.css`.
5. Refactor `STATUS_COLORS` / `COLOR_CLASSES` in `caseStatus.ts` to delegate to those tokens (same export names and signature, so all ~30 call sites keep working). Attention/urgency states get a paired icon or label so meaning is never color-only.

## Phase 3 — Theme selector UX

6. Replace `ThemeToggle` with `ThemePicker`: same trigger slot in `DashboardLayout`, opens a shadcn `Popover` titled "Appearance" with three mini dashboard previews (pure CSS mock: sidebar bar, two cards, an accent line) rendered in each theme's palette, check indicator + ring on the active one, keyboard/arrow navigable, `aria-pressed` labels, respects reduced motion.

## Phase 4 — Sleek case visuals

7. New shared primitives in `src/components/cases/`:
  - `StatusLine` — thin colored edge accent bound to a stage token.
  - `CaseStatusChip` — themed stage badge (replaces raw badge classes).
  - `CaseCard` — SaaS data card: identity (name + case ref) → stage chip + colored edge → next action → secondary metadata (owner, last activity, deadline, financial state when the caller passes it). Progressive disclosure for extras.
8. Restyle `CaseStatusPipeline`, `CaseProgressRail`, and `CaseTimeline` on the same tokens (colored connector segments, stage dots, per-update left rail with timestamp and "NEXT →" line).

## Phase 5 — Unified manager pipeline

9. `TeamPipelinePage` becomes one surface with a view switch: **Board** (new) and **List** (existing table, unchanged logic).
  - Board columns = the existing active stage order from `caseStatus.ts` with stage name, case count, accent header line, and `CaseCard` items inside.
  - Reuses the page's existing data fetch, quick filters (mine / unassigned / needs action / overdue), search, assignment `Select`, and detail drawer. No new queries, no new RPCs, no permission changes — manager gating via `useIsManager` stays as-is.
  - Mobile: board collapses to stacked accordion sections per stage (not a shrunken board); no horizontal overflow.

## Phase 6 — Dashboard refresh (token-level, low risk)

10. Apply the shared primitives and spacing/typography scale to: Admin (`AdminPipelinePage`, command center, students, financials), Team (`TeamWorkPage`, `TeamCasesPage`, case detail tabs), Partner, Student. Only className/markup changes: headers, KPI cards, tables, filters, tabs, empty/loading/skeleton states, hover and focus states. and while at it in the accounts where team is manager combine the cases tab and piline togther in one tab 

## Phase 7 — Validation

11. `npm run build`, `npx vitest run` (full suite must stay green), then a Playwright pass over `/admin`, `/team`, `/team/pipeline`, `/partner`, `/student` in all three themes, LTR + Arabic RTL, at 375px and 1440px, checking contrast, overflow, dropdown/modal layering, and theme persistence across reload. 

## Technical notes

- No new theme library; `next-themes` handles three values as easily as two.
- All new color lives in `index.css` variables and `tailwind.config.ts` — components reference semantic classes only.
- `caseStatus.ts` export surface stays identical so no consumer needs edits.
- Nothing in `supabase/`, services, hooks, or RLS is touched.

## Open scope note

Phase 6 spans many files; it is applied incrementally by dashboard, verifying build + tests after each dashboard, so a regression is isolated.