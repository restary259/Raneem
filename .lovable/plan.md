

## Phase 2: Admin Dashboard Overhaul

This phase transforms the Admin Dashboard from a flat list-based view into a high-signal command center with funnel visualization, paginated data, multi-filters, a "Ready to Apply" table, and a configurable eligibility engine panel.

---

### 2A. Paginated Data Loading

**Problem**: `AdminDashboardPage.tsx` fetches ALL leads, cases, profiles, payments, contacts, etc. in one `Promise.all` on load (lines 76-92). This will not scale past 1000 rows (Supabase default limit) and causes slow initial loads.

**Solution**:

1. **Keep aggregate stats as full queries** (counts are fine -- they're lightweight).
2. **Paginate leads and cases** inside their respective management components rather than the parent page.
3. Move data fetching for leads/cases OUT of `AdminDashboardPage` and INTO `LeadsManagement` and `CasesManagement` directly. Each component will manage its own pagination state.
4. Add a `useAdminLeads(page, filters)` hook pattern:
   - Fetch 50 rows per page
   - Return `{ data, totalCount, isLoading, fetchMore }`
   - "Load More" button at bottom of list
5. For overview stats, use `.select('id', { count: 'exact', head: true })` queries to get counts without loading all rows.

**Files to modify**:
- `src/pages/AdminDashboardPage.tsx` -- Remove leads/cases from bulk fetch; pass only aggregate counts to Overview
- `src/components/admin/LeadsManagement.tsx` -- Add internal paginated fetch with "Load More"
- `src/components/admin/CasesManagement.tsx` -- Same pattern

---

### 2B. Enhanced Admin Overview with Sparklines

**Current state**: `AdminOverview.tsx` shows 11 stat cards in a grid. No charts, no trends.

**Changes**:

1. **Redesign KPI Row** to 6 high-signal cards (2 rows of 3 on desktop, stack on mobile):
   - New Leads Today (count of leads created today)
   - Eligible Leads (count + percentage)
   - Conversion Rate (paid cases / total leads)
   - Revenue This Month (sum of service_fee + school_commission for paid cases this month)
   - Housing Commission Expected (sum of school_commission for ready_to_apply cases)
   - Influencer ROI (revenue from influencer leads / influencer payouts)

2. **Add sparkline mini-charts** using recharts (already installed) inside each card showing 7-day trend. Data comes from grouping leads/cases by `created_at` date.

3. **Remove zero-tip hints** -- they add clutter. Show "0" with muted styling instead.

4. **Add a "Quick Funnel Summary"** strip below KPIs showing stage counts in a horizontal bar.

**Files to create**:
- `src/components/admin/SparklineCard.tsx` -- Reusable stat card with embedded mini line chart

**Files to modify**:
- `src/components/admin/AdminOverview.tsx` -- Full redesign with new layout and sparklines

---

### 2C. Funnel Visualization Component

**New component**: `src/components/admin/FunnelVisualization.tsx`

A horizontal pipeline showing the 10 funnel stages with animated counts:

```text
[Lead Submitted] -> [Scored] -> [Assigned] -> [Contacted] -> [Appointment] -> [Paid] -> [Ready] -> [Applied] -> [Visa] -> [Settled]
     42               38          30            25             18             12         8           5           3          1
```

**Implementation details**:

1. Map leads by `status` and cases by `case_status` into the 10 stages
2. Each stage is a rounded pill/box with:
   - Stage name (translated via `t()`)
   - Count
   - Color gradient (cool blue on left to warm green on right)
   - Connecting arrows between stages
3. Click a stage to filter -- emits an `onStageClick(stage)` callback that sets a filter in LeadsManagement
4. Responsive: horizontal scroll on mobile, wraps on tablet, full row on desktop
5. Animated number transitions using CSS transitions on count changes

**Files to create**:
- `src/components/admin/FunnelVisualization.tsx`

**Files to modify**:
- `src/components/admin/AdminOverview.tsx` -- Embed FunnelVisualization below KPI cards
- `public/locales/en/dashboard.json` -- Add `funnel.*` translation keys for all 10 stages
- `public/locales/ar/dashboard.json` -- Same

---

### 2D. "Ready to Apply" Table

**New component**: `src/components/admin/ReadyToApplyTable.tsx`

A dedicated admin tab (added to sidebar under "Students" group) showing cases where `case_status = 'ready_to_apply'`.

**Features**:
1. Table with columns: Ref Code | Student Name | City | School | Course | Accommodation | Assigned Staff | Payment Date
2. Checkbox selection per row for bulk actions
3. "Select All" header checkbox
4. "Export for School" button -- generates CSV (XLSX in Phase 6) with selected rows
5. Filter by city (dropdown) and school (dropdown) at the top
6. Sort by payment date (default: newest first)

**Integration**:
- Add `{ id: 'ready', labelKey: 'admin.tabs.ready', icon: CheckCircle }` to the Students group in `AdminLayout.tsx` sidebar
- Add `case 'ready':` to `renderContent()` in `AdminDashboardPage.tsx`
- Fetch data internally (self-contained component with own query)

**Files to create**:
- `src/components/admin/ReadyToApplyTable.tsx`

**Files to modify**:
- `src/components/admin/AdminLayout.tsx` -- Add sidebar item
- `src/pages/AdminDashboardPage.tsx` -- Add case in renderContent
- `public/locales/en/dashboard.json` -- Add `admin.tabs.ready` and table column keys
- `public/locales/ar/dashboard.json` -- Same

---

### 2E. Multi-Filter System for Leads

**Current state**: `LeadsManagement.tsx` has search (name/phone) and status filter only.

**Add these filters** (horizontally arranged filter bar, collapsible on mobile):

1. **City filter** -- `<Select>` populated from distinct `preferred_city` values in leads
2. **School filter** -- `<Select>` populated from distinct `selected_school` in linked cases
3. **Assigned Staff filter** -- `<Select>` from lawyers list
4. **Influencer Source filter** -- `<Select>` from influencers list (only show leads where `source_type = 'influencer'`)
5. **Date range** -- "This Week" / "This Month" / "All Time" quick filters
6. **Companion filter** -- "Has Companion" toggle to find group applications

All filters combine with AND logic. Show active filter count badge. "Clear All" button.

**Files to modify**:
- `src/components/admin/LeadsManagement.tsx` -- Add filter bar, update filtering logic
- `public/locales/en/dashboard.json` -- Add filter label keys
- `public/locales/ar/dashboard.json` -- Same

---

### 2F. Eligibility Config Panel

**New component**: `src/components/admin/EligibilityConfig.tsx`

An admin-only settings panel for managing the eligibility scoring engine.

**Features**:

1. **Weights Table**: Lists all rows from `eligibility_config` table
   - Columns: Field Name (label) | Weight (editable number input) | Active (toggle switch)
   - Total weight shown at bottom (should sum to 100)
   - Warning badge if total != 100

2. **Thresholds Section**: Reads from `eligibility_thresholds` table
   - "Eligible minimum" (default 70) -- editable
   - "Review minimum" (default 40) -- editable
   - Visual preview: color-coded bar showing the three zones

3. **Save button**: Updates all weights and thresholds in one batch
   - Logs change to `admin_audit_log`
   - Shows success toast

4. **"Reset to Defaults" button**: Restores original weights with confirmation dialog

**Integration**:
- Add `{ id: 'eligibility', labelKey: 'admin.tabs.eligibility', icon: Settings }` to the Tools group in `AdminLayout.tsx` sidebar
- Add `case 'eligibility':` to `renderContent()` in `AdminDashboardPage.tsx`

**Files to create**:
- `src/components/admin/EligibilityConfig.tsx`

**Files to modify**:
- `src/components/admin/AdminLayout.tsx` -- Add sidebar item
- `src/pages/AdminDashboardPage.tsx` -- Add case in renderContent
- `public/locales/en/dashboard.json` -- Add eligibility config keys
- `public/locales/ar/dashboard.json` -- Same

---

### Translation Keys to Add

**English (`dashboard.json`)**:
- `funnel.leadSubmitted`, `funnel.scored`, `funnel.assigned`, `funnel.contacted`, `funnel.appointment`, `funnel.paid`, `funnel.readyToApply`, `funnel.applicationSubmitted`, `funnel.visaStage`, `funnel.settled`
- `admin.tabs.ready`, `admin.tabs.eligibility`
- `admin.ready.*` (table headers, export button, select all, no results)
- `admin.eligibility.*` (weights, thresholds, save, reset, total, warning)
- `admin.filters.*` (city, school, staff, source, dateRange, companion, clearAll, activeFilters)
- `admin.overview.newLeadsToday`, `admin.overview.conversionRate`, `admin.overview.housingCommission`, `admin.overview.influencerROI`

**Arabic (`dashboard.json`)**: Mirror of all above keys.

---

### Implementation Order

1. Add all new translation keys to both locale files
2. Create `SparklineCard.tsx` and redesign `AdminOverview.tsx`
3. Create `FunnelVisualization.tsx` and embed in Overview
4. Refactor `LeadsManagement.tsx` with pagination + multi-filters
5. Refactor `CasesManagement.tsx` with pagination
6. Create `ReadyToApplyTable.tsx` + wire into AdminLayout/AdminDashboardPage
7. Create `EligibilityConfig.tsx` + wire into AdminLayout/AdminDashboardPage
8. Update `AdminDashboardPage.tsx` to remove bulk data fetching for leads/cases

---

### Design Principles Applied

- Light theme only, high contrast, no decorative gradients on dashboard cards
- 8px spacing grid, rounded-xl corners consistent with existing components
- Status colors only: Green (Paid/Settled), Yellow (Pending), Red (Overdue/Not eligible)
- Mobile-first: cards stack vertically, filter bar collapses
- No unnecessary toggles or duplicate actions
- Every label uses `t()` keys -- zero hardcoded strings

