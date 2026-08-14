# Dashboard Performance, State & UI Polish Pass

Scope: the five dashboards only — Admin, Team, Partner, Ambassador, Agent, Student (`src/pages/{admin,team,partner,agent,student}`, plus shared dashboard components and `src/components/shell/*`). No marketing/public pages, no backend, no RLS, no edge functions, no schema changes.

Everything must render correctly in all three themes (light, dark, aurora) using existing semantic tokens only.

## 1. Performance

- **Client-side pagination for long lists.** Add a small shared `usePagedList` hook plus a `Pagination` footer built on existing shadcn primitives, and wire it into the heaviest tables/feeds: Admin Students, Admin Pipeline, Admin Submissions, Admin Activity, Admin Team, Team Cases, Team Students, Team Appointments, Agent Network, Agent Students, Partner Students, Partner Earnings. Default page size 25, preserved across filter changes with a reset-to-page-1 on filter/search change.
- **Debounce search inputs.** All dashboard search/filter text fields go through a shared `useDebouncedValue` (250ms) so filtering does not re-run on every keystroke.
- **Memoize row components.** Extract repeated row/card renderers in the largest pages into `React.memo` components with stable props; wrap derived filter/sort pipelines in `useMemo` and event handlers passed to rows in `useCallback`.
- Keep queries as-is (already `.limit()`-bounded); pagination is presentational.

## 2. Skeleton loaders

No dashboard page currently renders a skeleton — they show either nothing or a spinner. Every async fetch in the five dashboards will render the existing `LoadingState` from `src/components/shell/States.tsx` (extended with `table`, `cards`, and `kpi` variants) so the layout occupies its final height before data arrives. This also removes the layout shift that happens when data lands.

## 3. UI/UX consistency

- Replace the few remaining hardcoded color utilities found in `PartnerOverviewPage`, `PartnerEarningsPage`, `AdminSubmissionsPage`, `AdminAnalyticsPage` with semantic tokens so aurora/dark render correctly.
- Standardise every dashboard page on the shell primitives: `PageHeader` for the title/actions row, `KpiRow` for stat grids, `SectionCard` for content blocks, `DataToolbar` for search/filter rows. Pages that hand-roll these get switched over.
- Mobile-first: tables that overflow on 392px get a horizontal scroll container with sticky first column, or collapse to a stacked card list under `sm`.
- Add consistent interactive transitions (hover, focus-visible ring, active press) via shared utility classes on rows, cards and toolbar controls. Respect `prefers-reduced-motion`.

## 4. Error, empty and type hygiene

- Every list/feed gets the three states wired explicitly: loading skeleton, `EmptyState`, `ErrorState` with a retry that re-calls the fetch.
- Remove `any` in the touched dashboard files, typing Supabase rows off the generated types.
- Clear React console warnings in these pages: missing/duplicate `key`, controlled-vs-uncontrolled inputs, and effect cleanup on fetches (abort/ignore flag on unmount).

## Technical notes

New shared files (small, dashboard-only):
- `src/hooks/useDebouncedValue.ts`
- `src/hooks/usePagedList.ts`
- `src/components/shell/Pagination.tsx`
- extended variants in `src/components/shell/States.tsx`

Verification: `npm run build` (tsc + vite), `npx vitest run` (current suite must stay green), plus a browser pass over one page per dashboard in light, dark and aurora at 392px and 1280px.

## Sequencing

1. Shared hooks/primitives + `States.tsx` variants.
2. Admin dashboard pages.
3. Team dashboard pages.
4. Agent + Partner/Ambassador pages.
5. Student pages.
6. Theme/responsive sweep and final build + test run.
