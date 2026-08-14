# Darb — Frontend UX/UI & Dashboard Architecture Remodel

Frontend-only. No migrations, no schema, no RPC/RLS/edge-function/business-logic changes. Same design language (brand orange, charcoal, existing shadcn primitives, tokens in `index.css`, the 3 themes) — refined, not replaced.

## What the audit found

Navigation and page inventory (`DashboardLayout.tsx`, `MobileBottomNav.tsx`, `src/pages/*`):

- **Admin**: 13 flat sidebar items across 5 groups. `analytics` + `spreadsheet` + `financials` overlap heavily; `activity` is an audit log sitting next to `settings`; `submissions` and `pipeline` both show case state.
- **Team**: 8 top-level items + a Tools group. `analytics` and `spreadsheet` are again two views of one dataset. `students` vs `cases` is the same population seen twice. `submit` is an action, not a destination.
- **Partner/Ambassador**: 5 shared items, plus 2 injected for master partners (`network`, `performance`) — `performance` (89 lines) is a thin page that belongs as a tab inside Network or Earnings.
- **Agent**: 5 items; overview is 106 lines and doesn't answer "what needs attention".
- **Student**: already grouped (good) but 4 groups + 2 top-level = the tools group competes with the study file.
- **Mobile**: bottom nav duplicates the sidebar's top items but caps at 4-5 and drops discovery for everything else; no "More" affordance, so several routes are unreachable on mobile.
- Repeated patterns with no shared component: page header + subtitle, KPI card row, empty state, loading skeleton, status badge (partially in `statusTokens.ts`), list-card row (see `TeamCasesPage`).

## The remodel

### 1. Shared shell primitives (do this first)
New components under `src/components/shell/`:
- `PageHeader` — title, optional subtitle, right-aligned action slot, optional breadcrumb. Sticky on desktop.
- `KpiRow` — responsive 2/4-up compact stat tiles (replaces stacked KPI cards everywhere).
- `EmptyState`, `LoadingState`, `ErrorState` — one look for all roles.
- `SectionCard` — the only card wrapper allowed for grouped content, with an optional collapsible body.
- `DataToolbar` — search + filter pills + view switch (extracted from `TeamCasesPage`'s inline block).

Every page below is rewritten to compose these instead of hand-rolled markup. This alone removes most of the vertical stacking and inconsistent spacing.

### 2. Information architecture per role

Routes are **kept** (no dead links). Consolidation happens by turning sibling pages into tabs on a parent route, with the old paths redirecting to the parent + tab.

**Admin** — 5 sections:
- Work: Overview, Pipeline (Submissions becomes a Pipeline tab), Applications (inbox)
- Money: Finance (Financials | Spreadsheet | Analytics as tabs on `/admin/financials`)
- People: Team, Students, Referrals
- Setup: Programs, Settings (Activity log becomes a Settings tab)
Sidebar goes 13 → 8 entries.

**Team** — 3 sections:
- Work: My Work, Cases (Students becomes a Cases tab "Enrolled"), Appointments
- Insights: Reports (`/team/analytics` with Analytics | Spreadsheet tabs)
- Tools: unchanged collapsible
"Submit new student" moves out of the sidebar into a primary action button in the Cases page header (and the My Work quick actions). Sidebar 8 → 5.

**Partner / Ambassador** — premium portal feel:
- Overview (reworked: earnings snapshot, active referrals, next action, share link)
- Students, Earnings, Messages, Account
- Master partners: Network gains a **Performance** tab; the separate `/partner/performance` sidebar entry is removed (route redirects into the tab).

**Agent** — operationally focused Overview: an "Needs attention" list at the top (pending invites, recruits with no case, unlocked earnings), then network summary, then earnings snapshot. Nav unchanged (already 5 lean items).

**Student** — keep the grouped sidebar; move Tools under Study File as a fourth child group is avoided — instead Tools stays but is rendered last and collapsed by default. Next Steps becomes the single "where am I / what's next" surface: journey rail + tasks + fees/documents snapshot, no duplicate overview section below it.

### 3. Mobile
- Bottom nav stays at 4 role destinations + a 5th **More** sheet listing every remaining route for that role (fixes unreachable pages).
- Page-level tabs render as a scrollable segmented control, not wrapped pills.
- Sticky primary action per page instead of a button buried at the bottom of a long scroll.
- Audit each rewritten page at 392px for overflow and 44px touch targets.

### 4. Case pipeline micro-visuals
Extend the existing restrained language from `CaseVisuals.tsx`:
- segmented stage connector reused in the student journey rail and the agent case rows
- 2px active-indicator stroke on sidebar/tab active states
- gentle status transition (opacity/translate, 150-200ms) when a stage advances
- skeletons that match the final layout so nothing shifts
All behind `prefers-reduced-motion`, using existing tokens only. No gradients, no new colors.

### 5. Accessibility & performance
- Focus-visible ring on all interactive shell primitives; tabs get proper roving focus via the existing shadcn `Tabs`.
- Real `<button>`/`<a>` semantics, `aria-current` on active nav, labelled icon-only buttons.
- Memoize list rows, hoist derived filters into `useMemo`, drop the duplicate fetches where a page and its child both query the same table.

## Technical notes
- No files under `supabase/` are touched. No `src/integrations/supabase/*` edits.
- Consolidation is presentational: merged pages keep their existing data hooks/services untouched and are mounted as tab panels.
- Removed sidebar entries keep working routes via `<Navigate>` redirects so bookmarks and deep links (including notification deep links) don't break.
- `dashboard.json` en + ar get new `nav.*` / shell keys together (parity guard in `src/lib/i18nKeys.test.ts`).
- Gate after each phase: `npm run build` + `npx vitest run`, plus a Playwright pass over each role's dashboard at desktop and 392px.

## Order of work
1. Shell primitives + tokens/micro-visual utilities
2. Student (highest trust impact, smallest surface)
3. Agent + Partner/Ambassador
4. Team
5. Admin
6. Mobile More-sheet + full responsive/a11y sweep + final cross-role consistency pass
