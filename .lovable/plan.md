
# Phase 9: Team Dashboard Overhaul

This phase replaces all "Lawyer" references with "Team Member", redesigns the dashboard with a premium sidebar-based layout, adds an AI Agent sidebar link, and improves mobile responsiveness with card-based layouts.

---

## Current State

- The route `/lawyer-dashboard` renders `LawyerDashboardPage.tsx` which checks for the `lawyer` role
- `AppointmentCalendar.tsx` uses `lawyer_id` column from the `appointments` table
- Translation keys use `lawyer.*` namespace in both EN and AR `dashboard.json`
- Admin components (`CasesManagement`, `KPIAnalytics`, `ReadyToApplyTable`, `AdminOverview`) reference "lawyer" in props, labels, and variable names
- The `team` section in translations already uses "Lawyer" for the role label
- Database column `assigned_lawyer_id` in `student_cases` and `lawyer_id` in `appointments` remain unchanged (renaming DB columns is high-risk; we alias in the UI instead)

---

## Implementation Plan

### 9A. Rename All "Lawyer" References in Translation Files

**EN `dashboard.json`:**
- Rename `lawyer` key to `teamDash` (keeping same structure)
- Change `"title": "Lawyer Dashboard"` to `"title": "Team Dashboard"`
- Change `"unauthorizedDesc"` to `"This page is for team members only."`
- In `cases` section: `"lawyerLabel"` becomes `"teamMemberLabel"`, `"lawyerComm"` becomes `"teamMemberComm"`
- In `team` section: `"roleLawyer"` becomes `"roleTeamMember"`, value `"Lawyer"` becomes `"Team Member"`, `"lawyerRole"` becomes `"teamMemberRole"`
- In `kpi` section: `"lawyerPerformance"` becomes `"teamPerformance"`

**AR `dashboard.json`:**
- Same structural changes, translating "محامي" to "عضو فريق" throughout

### 9B. Redesign LawyerDashboardPage (rename to TeamDashboardPage)

Complete rebuild of `src/pages/LawyerDashboardPage.tsx` (file stays same path for now, component renamed internally):

**Desktop Layout:**
- **Sticky Header**: Logo, dashboard name ("Team Dashboard"), user info, notification bell, AI Agent quick-access button, sign out
- **Left Sidebar** (collapsible, 64px collapsed / 240px expanded):
  - Items: Home/My Leads, Appointments, Notes/History, AI Agent (links to `/ai-advisor`), Settings
  - Neon-style highlight on active item (border-left accent glow, subtle gradient hover)
  - Uses the Shadcn Sidebar component pattern
- **KPI Strip** below header: Active Leads, Today's Appointments, Paid This Month, SLA Warnings (same data, refined styling with blueprint colors)
- **Main Body** (70/30 split preserved):
  - Left (70%): Lead cards with neon-outline styling, stage badges, quick actions (Call, Set Appointment, Mark Contacted, Add Note, Edit), collapsible notes panel
  - Right (30%): Mini calendar (month/week toggle), upcoming appointments list, personal analytics (conversion rate, weekly appointments, total activated students)

**Mobile Layout:**
- Sidebar collapses to bottom navigation bar (5 icons: Home, Appointments, AI, Notifications, Profile)
- KPI strip becomes horizontally scrollable single row
- Lead cards stack vertically (no table)
- Calendar becomes compact scrollable list
- All tap targets minimum 44px

**Visual Enhancements:**
- Lead cards: subtle neon border glow based on status color
- Stage badges: color-coded with blueprint palette
- Appointment buttons: hover glow effect (`shadow-[0_0_12px_rgba(color)]`)
- Calendar events: color-coded dots by status
- `active:scale-95` on all interactive elements

### 9C. Update AppointmentCalendar Component

- Rename internal references from "lawyer" to "team member" in comments/variables
- Keep `lawyer_id` DB column usage (no schema change) but alias in UI
- Add drag-and-drop date selection for setting appointments (enhanced UX)
- Add conflict detection: warn if appointment overlaps existing one

### 9D. Update Admin Components

**Files affected:**
- `CasesManagement.tsx`: Change `assigned_lawyer_id` display label from "Lawyer" to "Team Member", update prop name `lawyers` display
- `KPIAnalytics.tsx`: Rename `lawyerData` variable display section from "Lawyer Performance" to "Team Performance"
- `ReadyToApplyTable.tsx`: Update "lawyer" references in UI labels
- `AdminOverview.tsx`: Update prop references in display
- `AdminLayout.tsx` / sidebar: Ensure "Team" section label is consistent

### 9E. Add Route Alias

- Keep `/lawyer-dashboard` working (backward compat) but add `/team-dashboard` as primary route
- Update navigation links across the app to use `/team-dashboard`

### 9F. Student Activation Flow

- Add "Activate Student" button in the lead card (visible when case status reaches `paid`)
- On click: creates student portal account (uses existing `create-team-member` edge function pattern) and sends welcome email
- Only admin or team members with explicit permission can deactivate

### 9G. Notification Enhancements

- New lead assigned: notification to team member (already exists via admin actions)
- Upcoming appointment reminder: check appointments within 1 hour
- Payment confirmation: notify team member when case payment is marked

---

## Technical File Summary

| File | Action |
|------|--------|
| `src/pages/LawyerDashboardPage.tsx` | Full rewrite with sidebar layout, renamed component |
| `src/components/lawyer/AppointmentCalendar.tsx` | UI label updates, conflict detection |
| `src/components/admin/CasesManagement.tsx` | Rename "Lawyer" labels to "Team Member" |
| `src/components/admin/KPIAnalytics.tsx` | Rename "Lawyer Performance" section |
| `src/components/admin/ReadyToApplyTable.tsx` | Rename "Lawyer" labels |
| `src/components/admin/AdminOverview.tsx` | Update prop display labels |
| `src/App.tsx` | Add `/team-dashboard` route alias |
| `public/locales/en/dashboard.json` | Rename `lawyer` to `teamDash`, update all "Lawyer" strings |
| `public/locales/ar/dashboard.json` | Same rename, Arabic equivalents |

## Implementation Order

1. Update translation keys in both EN and AR files
2. Add `/team-dashboard` route in `App.tsx`
3. Rebuild `LawyerDashboardPage.tsx` with new sidebar layout and premium styling
4. Update `AppointmentCalendar.tsx` labels and add conflict check
5. Update admin components (`CasesManagement`, `KPIAnalytics`, `ReadyToApplyTable`, `AdminOverview`)
6. Add student activation button in lead cards
7. Test end-to-end on desktop and mobile viewports
