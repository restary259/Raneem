
## Mobile Rendering Audit — Findings & Fix Plan

### What Already Works (Global CSS)
- `box-sizing: border-box` ✅ (base.css line 40)
- `overflow-x: hidden` on `html` and `body` ✅
- `word-break: break-word` on body + tables ✅
- `overflow-wrap: anywhere` on td/th ✅
- `max-width: 100%` on img/video/table/iframe ✅

### Issues Found — Grouped by Type

---

#### 1. Non-responsive Grid Layouts (need responsive breakpoints)

**`AdminCommandCenter.tsx`** — `grid-cols-5` KPI tiles: On mobile 2 columns is fine but 5 fixed cols will overflow. Already `grid-cols-2 lg:grid-cols-5` → OK. But `p-6` container has no `px-4` fallback. **Minor fix**: ensure page padding scales.

**`AdminFinancialsPage.tsx`** — `grid grid-cols-2 md:grid-cols-3` — OK.
- Summary cards `p-5` with `text-2xl` value: on 320px with long ILS strings, can overflow. Need `truncate` on value text.

**`PartnerEarningsPage.tsx`** — `grid grid-cols-3 gap-4` (line 103): **3 equal columns with no breakpoint** — on mobile 320px each card gets ~100px wide, text is clipped. Fix: `grid-cols-1 sm:grid-cols-3`.
- Earnings breakdown uses `grid grid-cols-4` (custom div, line 155) with no overflow wrapper and no responsive column count — on narrow screens the 4 columns are too tight. Fix: wrap in `overflow-x-auto` or make it `grid-cols-2 sm:grid-cols-4`.

**`AdminAnalyticsPage.tsx`** — `grid grid-cols-2 md:grid-cols-4` KPIs — fine. Charts use `ResponsiveContainer width="100%"` — fine.

**`AdminSettingsPage.tsx`** — `grid grid-cols-2 gap-4` in platform config (line 362) — on mobile inputs get too narrow. Fix: `grid-cols-1 sm:grid-cols-2`.
- Contact form `grid grid-cols-2 gap-3` appears 4 times (lines 403, 413) — same fix.

**`AdminSubmissionsPage.tsx`** — `grid grid-cols-2 gap-3` for detail view sections — fine on most phones but tight on 320px. Fix: `grid-cols-1 sm:grid-cols-2`.

**`AdminPipelinePage.tsx`** — Kanban: `flex gap-4 min-w-max` inside `overflow-x-auto` → this is correct Kanban behavior, horizontal scroll is intentional. **No fix needed.**
- Filter row: `min-w-[200px]` on search — may cause overflow. Fix: `min-w-0` or `min-w-[160px]`.
- Sheet `w-full sm:max-w-md` — ✅.

**`CaseDetailPage.tsx`** — Application info `grid grid-cols-2 sm:grid-cols-3` — ✅.
- Appointment action buttons `flex gap-2 shrink-0 flex-wrap` — ✅.

---

#### 2. Fixed-width `DialogContent` / `SheetContent` missing `max-w-[95vw]`

**`AdminTeamPage.tsx`** — `DialogContent dir={isRtl ? "rtl" : "ltr"}` — no `max-w` or responsive width. Fix: add `className="max-w-[95vw] sm:max-w-lg"`.

**`AdminSubmissionsPage.tsx`** — `DialogContent ... className="max-w-2xl max-h-[90vh] overflow-y-auto"` — on small screens `max-w-2xl` is wider than the viewport. Fix: `max-w-[95vw] sm:max-w-2xl`.

**`TeamCasesPage.tsx`** — `DialogContent className="max-w-sm"` — `max-w-sm` is 384px, fine on most phones but not on 320px screens. Fix: `max-w-[95vw] sm:max-w-sm`.

**`AdminSettingsPage.tsx`** — `DialogContent ... className="max-h-[90vh] overflow-y-auto"` (contact add form) — missing max-w. Fix: add `max-w-[95vw] sm:max-w-lg`.

---

#### 3. Headers / text that can overflow

**`AdminStudentsPage.tsx`** — Student list row `grid-cols-5` on desktop, mobile has separate card. The mobile card has `truncate` on name ✅. But `p.text-xs.text-muted-foreground` for email has no `truncate` — long email can overflow. Fix: add `truncate` to email `<p>` in mobile card.

**`AdminPipelinePage.tsx`** — Filter `SelectTrigger className="w-[200px]"` — fixed pixel width, on 320px with both search + select in flex-wrap row, the select may overflow. Fix: `w-full sm:w-[200px]` or `min-w-0 flex-1`.

**`PartnerOverviewPage.tsx`** — Earnings banner: `text-4xl font-black` for monetary value — could overflow on 320px. Fix: `text-3xl sm:text-4xl break-all`.

**`AdminCommandCenter.tsx`** — KPI card: `text-3xl font-bold` for value. On smaller cards at 2-col layout may be slightly tight. Fine as-is given numbers are small.

---

#### 4. Table overflows

**`AdminSpreadsheetPage.tsx`** — Table wrapped in `overflow-auto` ✅ (line 264).

**`PartnerOverviewPage.tsx`** — Table wrapped in `overflow-x-auto` ✅ (line 198). Table cells use `px-4 py-3` text — but no `whitespace-nowrap` protection. On very small screens, names wrap naturally which is fine.

**`AdminStudentsPage.tsx`** — Uses cards instead of a table for mobile ✅.

---

#### 5. Page padding on mobile (all dashboard pages use `p-6`)

`p-6` = 24px padding — on 320px this gives only 272px for content. Should be `p-4 sm:p-6` for comfort. Affects:
- `AdminCommandCenter.tsx` (line 146)
- `AdminFinancialsPage.tsx` (line 74)
- `AdminTeamPage.tsx` (line 112)
- `AdminActivityPage.tsx` (line 75)
- `AdminAnalyticsPage.tsx` (line 76)
- `AdminStudentsPage.tsx` (line 635)
- `TeamTodayPage.tsx` (line 87)
- `PartnerEarningsPage.tsx` (line 88)
- `StudentChecklistPage.tsx` (line 25)
- `StudentProfilePage.tsx` (line 37)
- `StudentDocumentsPage.tsx` (line 21)
- `StudentVisaPage.tsx` (line 234)
- `AdminSettingsPage.tsx` (line 332)

---

#### 6. RTL directional classes to convert (hardcoded `ml-`, `mr-`, `pl-`, `pr-`)

**`AdminSettingsPage.tsx` (line 344)** — `<DollarSign className="h-3.5 w-3.5 mr-1" />` — Fix: `me-1`.

**`PartnerOverviewPage.tsx` (line 186)** — `className="ml-auto text-xs"` — Fix: `ms-auto`.

---

#### 7. Bottom Nav labels — already good

`MobileBottomNav.tsx` uses `truncate max-w-[48px]` and `text-[10px]` ✅. No fix needed.

---

### Files to Edit (CSS-only changes)

| File | Changes |
|---|---|
| `src/pages/partner/PartnerEarningsPage.tsx` | `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`; earnings breakdown `grid-cols-4` row → `overflow-x-auto` wrapper |
| `src/pages/partner/PartnerOverviewPage.tsx` | `text-4xl` value → `text-3xl sm:text-4xl`; `ml-auto` → `ms-auto` |
| `src/pages/admin/AdminTeamPage.tsx` | `DialogContent` → add `className="max-w-[95vw] sm:max-w-lg w-full"` |
| `src/pages/admin/AdminSubmissionsPage.tsx` | `max-w-2xl` → `max-w-[95vw] sm:max-w-2xl`; `grid-cols-2` detail grids → `grid-cols-1 sm:grid-cols-2` |
| `src/pages/admin/AdminSettingsPage.tsx` | `grid-cols-2` form grids → `grid-cols-1 sm:grid-cols-2`; `mr-1` → `me-1`; `DialogContent` → add `max-w-[95vw]` |
| `src/pages/team/TeamCasesPage.tsx` | `DialogContent className="max-w-sm"` → `max-w-[95vw] sm:max-w-sm` |
| `src/pages/admin/AdminCommandCenter.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/admin/AdminFinancialsPage.tsx` | `p-6` → `p-4 sm:p-6`; `text-2xl` value → add `truncate` |
| `src/pages/admin/AdminTeamPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/admin/AdminActivityPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/admin/AdminAnalyticsPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/admin/AdminStudentsPage.tsx` | `p-6` → `p-4 sm:p-6`; mobile card email `truncate` |
| `src/pages/admin/AdminSettingsPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/team/TeamTodayPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/partner/PartnerEarningsPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/student/StudentChecklistPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/student/StudentProfilePage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/student/StudentDocumentsPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/student/StudentVisaPage.tsx` | `p-6` → `p-4 sm:p-6` |
| `src/pages/admin/AdminPipelinePage.tsx` | Filter `SelectTrigger w-[200px]` → `w-full sm:w-[200px]` |

All changes are CSS class modifications only — zero logic, state, or query changes.
