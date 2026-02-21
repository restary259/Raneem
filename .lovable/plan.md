

# Add "Today's Appointments" Tab and UI Improvements

## 1. Add "Today" Tab to Main Navigation

**File: `src/pages/TeamDashboardPage.tsx`**

Add a new main navigation tab called "Today" that shows only today's scheduled appointments with full action capabilities (call, reschedule, delete, go to case, complete profile).

### Changes:
- **TabId type** (line 41): Add `'today'` to the union type: `'cases' | 'today' | 'appointments' | 'analytics'`
- **TAB_CONFIG** (lines 43-47): Insert a new entry after `cases`:
  ```
  { id: 'today', icon: CalendarDays, labelKey: 'lawyer.tabs.today' }
  ```
  This places it as the second tab in the sidebar and bottom nav.
- **New "Today" tab content** (after the cases tab block, ~line 806): Render a dedicated section showing:
  - A header with today's date and appointment count
  - Full appointment cards (not the compact chips from the cases tab) with:
    - Student name, time, location, duration
    - Linked case status badge
    - Action buttons: Call, Reschedule, Delete, Open Case/Profile
  - Empty state message when no appointments today ("No appointments scheduled for today")
  - The existing `todayAppointments` variable already filters correctly (today + scheduled + not ended)

### "Today" Tab Card Layout:
Each appointment card will show:
- Time (large, left-aligned) + Student name
- Location and duration
- Linked case info (status badge, lead source)
- Actions: Call, Reschedule, Complete Profile (if case is in appointment stage), Delete

## 2. Remove Today's Appointments Summary from Cases Tab

Since "Today" now has its own dedicated tab, remove the inline summary card from the Cases tab (lines 679-697) to reduce clutter. The Cases tab becomes purely about case management.

## 3. UI Improvements (Applied in Same Change)

### A. Color-coded filter badge counts
Currently all filter chip counts use the same style. Update the count badges:
- SLA: red text when count > 0 (already partially done)
- Paid: green text when count > 0
- New: blue text when count > 0

### B. Case card status position improvement
Move the status badge from top-right to below the name, inline with source badges, for better mobile readability on narrow screens.

### C. Bottom nav badge for Today tab
Show a small red dot/count on the "Today" tab icon in the bottom mobile nav when there are appointments scheduled for today. This draws attention to upcoming appointments.

## Technical Details

### Files Modified:
| File | Changes |
|------|---------|
| `src/pages/TeamDashboardPage.tsx` | Add 'today' tab type, config, content section; remove inline today summary from cases; color-coded badges; bottom nav indicator |

### Translation Keys Needed:
- `lawyer.tabs.today` -- fallback: "Today" / will show "Today" in English
- No new Arabic keys strictly required (fallback works), but ideally add `lawyer.tabs.today` to `public/locales/ar/dashboard.json` as "اليوم" and `public/locales/en/dashboard.json` as "Today"

### Performance:
- The `todayAppointments` array is already computed and available -- no additional queries needed
- The new tab renders a filtered subset of existing data, so no new fetches or subscriptions required
- Tab content continues to use conditional rendering (matching existing pattern)

### No Regression Risk:
- No changes to case status flow, transitions, or data mutations
- No changes to financial logic, influencer attribution, or commission calculations
- Filter logic for all existing tabs remains identical
- Real-time subscriptions unchanged

