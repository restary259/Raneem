# Catalog UX/UI Rebuild — Admin + Team

Rebuild the browsing experience over the existing catalog data. No schema changes, no new tables, no RLS changes. `schools` / `programs` / `accommodations` stay the single source of truth.

## What exists today (verified)

- Data: 8 schools (all `country = 'Germany'`), 15 programs, 40 accommodations. Every program and accommodation has a `school_id` (zero orphans). 21 accommodations have more than one photo. The `accommodation_photos` table is empty — photos live in the `photos text[]` column on each row.
- Relationships: school → programs and school → accommodations. Accommodations are **not** linked to programs; program and accommodation are two sibling branches under a school.
- Admin: `AdminProgramsPage.tsx` (1,574 lines) — four flat CRUD tabs (Programs / Schools / Accommodations / Insurance), each a form dialog plus a list with a 1-photo thumbnail. No hierarchy, no country level.
- Team: `/team/catalog` (`TeamCatalogPage`) — flat school sections with accommodation cards and a dialog gallery. No program display, no country level, no full-screen viewer.
- Shared helpers already in place and reused: `src/lib/catalogDisplay.ts`, `programPricing.ts`, `useTeamCatalog.ts`, `ImageWithSkeleton`, shell primitives (`PageHeader`, `SectionCard`, `States`, `DataToolbar`).

Because there is exactly one country today, the country level renders as a compact top strip/step rather than a full page the user must click through — it stays part of the hierarchy and breadcrumb but never becomes a dead-end single-card screen.

## Plan

### A. Shared catalog layer (no duplication)

Extend `src/lib/catalogDisplay.ts` and `useTeamCatalog.ts` (rename-free) to also load **programs**, and add pure helpers: `groupByCountry`, `schoolStats(schoolId)` → `{ programs, accommodations }`, `programSummary`, and photo helpers (`allPhotos`, `photoCount`). Unit tests extended in `catalogDisplay.test.ts`.

New shared components under `src/components/catalog/`:
- `CatalogBreadcrumb` — Country › City › School › (Program | Accommodation).
- `PhotoLightbox` — the one image viewer used by both dashboards: full-screen overlay, `object-contain` (never stretched), counter `3 / 8`, prev/next, thumbnail strip, close button, Arrow/Escape keys, swipe on touch, neighbour-image preload only, RTL-aware controls.
- `SchoolCard`, `ProgramCard`, `AccommodationCard` (the team card is promoted here) — one consistent card language, all semantic tokens.
- `CatalogImage` — wraps `ImageWithSkeleton` with fixed aspect ratio, `object-cover`, `loading="lazy"`, and a polished icon placeholder on missing/failed load.

### B. Team catalog (`/team/catalog`) — presentation-first

Drill-down flow driven by local state with the breadcrumb always visible:

```text
Country strip → Schools grid → School page (Programs | Accommodation tabs) → Accommodation lightbox
```

- Schools grid: large school image, name, city, and "N programs · M accommodations".
- School page: hero with school image/website, then two tabs — Programs (comparison cards: name, type, CEFR, lessons/hours per week, duration, weekly price ladder) and Accommodation (large photo-first cards with price/week, room type, meals).
- Accommodation card click opens the shared `PhotoLightbox` with details panel (name, school + city, room type, meals, deposit, placement fee, distance note, description, weekly price tier ladder).
- Global search + city/school/room-type filters kept, restricted to what's useful while sitting with a student.
- TV/large-screen sizing: type and card scale up at `xl`/`2xl`, content max-width widened, tap targets ≥ 44px, no cramped grids.

### C. Admin catalog (`AdminProgramsPage`) — management-first, same hierarchy

Keep all existing CRUD, forms, dialogs, `PhotoUploader`, price-tier editors and the Insurance tab exactly as they are. Change the navigation shell around them:

- Tab 1 becomes **Catalog**: country → schools list (image, city, program/accommodation counts, active state) → school detail with Programs and Accommodations sections, each row inline-editable via the existing dialogs.
- Existing flat Programs / Accommodations / Schools tabs remain reachable as a "All records" view so nothing an admin does today is lost.
- Rows gain thumbnails that open the same `PhotoLightbox`.
- Insurance tab untouched.

### D. States, theming, performance

- Loading: layout-matched skeleton grids (schools grid, program list, accommodation grid).
- Empty: no schools / no programs / no accommodations / no photos / no filter matches — each with a short useful message and a clear-filters action where relevant.
- Error: existing `ErrorState` with retry.
- Only semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`, `--brand`) so light, dark and aurora all read as intentional.
- One fetch for schools + programs + accommodations, cached; drill-down is client-side (no refetch). Lightbox preloads only the adjacent photo.

## Technical notes

- Files added: `src/components/catalog/{CatalogBreadcrumb,PhotoLightbox,SchoolCard,ProgramCard,AccommodationCard,CatalogImage}.tsx`.
- Files changed: `src/lib/catalogDisplay.ts` (+ tests), `src/hooks/useTeamCatalog.ts` (adds programs), `src/pages/team/TeamCatalogPage.tsx`, `src/components/team/catalog/*` (folded into the shared components), `src/pages/admin/AdminProgramsPage.tsx` (navigation shell only).
- i18n: new `catalog.*` keys added to `public/locales/{en,ar}/dashboard.json` together (parity guard in `i18nKeys.test.ts`).
- No migrations, no edge functions, no RLS, no auth, no changes to unrelated dashboard functionality.
- Gate: `npm run build` clean and `npx vitest run` green before finishing.
