
## Global UI Refinement + Structural Enhancements + Financial Visuals

This is a comprehensive UI/UX overhaul across all four dashboards (Admin, Lawyer, Student, Influencer) covering visual theme, delete functionality, sidebar restructuring, and financial presentation improvements.

---

### Phase 1: Global Theme Update

**1.1 Background and Color Palette**
- Change all dashboard backgrounds from `bg-muted/30` and `bg-gray-50` to `bg-[#F8FAFC]` (Ghost White) across:
  - `AdminLayout.tsx` (main container)
  - `LawyerDashboardPage.tsx`
  - `InfluencerDashboardPage.tsx`
  - `StudentDashboardPage.tsx`
- Soften the admin/lawyer sidebar from `bg-[hsl(215,50%,23%)]` to a deep charcoal `bg-[#1E293B]` (Slate 800)
- Active sidebar items get a brand accent glow: `bg-accent/20 text-white shadow-[0_0_12px_rgba(234,88,12,0.3)]` (orange glow)

**1.2 Border Radius**
- Update the Card component (`src/components/ui/card.tsx`) border-radius from `rounded-lg` to `rounded-2xl` (16px)
- Update the Button component (`src/components/ui/button.tsx`) from `rounded-md` to `rounded-xl` (12px)
- Update the Input component (`src/components/ui/input.tsx`) from `rounded-md` to `rounded-xl`
- Update the Select trigger similarly
- Update CSS variable `--radius` from `0.5rem` to `0.75rem` in `base.css`

**1.3 Typography**
- Add `'IBM Plex Sans Arabic'` as the primary font in `base.css` body and in `tailwind.config.ts` fontFamily
- Load the font via a Google Fonts import in `index.html`

**1.4 Icons**
- All icons are already using Lucide consistently -- no changes needed here. Verified across all dashboard components.

---

### Phase 2: Delete Functionality + Sidebar Cleanup

**2.1 Delete with Confirmation**
Add delete capability to the following management views with a shared confirmation dialog pattern ("Are you sure? This action cannot be undone."):

- **LeadsManagement.tsx**: Add a `Trash2` icon button on each lead card. On confirm, delete from `leads` table.
- **CasesManagement.tsx**: Add a `Trash2` icon in the collapsed card header. On confirm, delete the case and related `case_payments` and `commissions`.
- **StudentManagement.tsx**: Add a `Trash2` icon in the actions column. On confirm, delete profile.
- **ContactsManager.tsx**: Add delete button per contact row.
- **ChecklistManagement.tsx**: Add delete button per checklist item.

Each uses a shared `AlertDialog` confirmation modal:
```
"Are you sure? This action cannot be undone."
[Cancel] [Delete]
```

**2.2 Admin Sidebar Restructuring**
Reorganize `AdminLayout.tsx` tabs into grouped categories:

```
Dashboard
  - Overview
  - Analytics

Students
  - Leads (Potential Clients)
  - Cases (Student Files)
  - Students
  - Checklist

Team
  - Influencers (Agents)
  - Referrals

Finance
  - Payouts

Tools
  - Contacts (Messages)
  - Security
  - Audit Log
```

Implementation: Add section headers in the sidebar nav with small uppercase labels and a thin divider between groups.

---

### Phase 3: Dashboard and Financial Visuals

**3.1 Stats Cards (AdminOverview.tsx)**
- Reduce card padding from `p-5` to `p-4`
- When a value is `0`, show a subtle "Getting Started" tip instead of a large "0" (e.g., "Add your first lead to get started" in muted text)
- Reduce the large `text-2xl` number to `text-xl` for a more compact feel

**3.2 Profit Analysis (KPIAnalytics.tsx)**
- Add a hero "Net Profit" card at the top with a distinct gradient background (green if positive, red if negative)
- Color-code revenue cards with green text/accent and expense cards with red text/accent
- Show Revenue, Expenses, and Net Profit as three distinct visual blocks before the detailed breakdowns

**3.3 Cases Financial Breakdown (CasesManagement.tsx)**
- In the expanded view, color-code revenue items (service fee, school commission) in green and cost items (influencer/lawyer commission, discount, translation) in red
- Make the "Net Profit" row more prominent with a larger font and colored background

**3.4 Add Lead Modal (LeadsManagement.tsx)**
- Convert from single-column to two-column layout on screens wider than mobile (`grid grid-cols-1 sm:grid-cols-2 gap-3`)
- Set modal max-width to `max-w-lg` to give more room

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Edit | `index.html` | Add IBM Plex Sans Arabic Google Font link |
| Edit | `src/styles/base.css` | Update `--radius`, add IBM Plex Sans Arabic to font-family |
| Edit | `tailwind.config.ts` | Update fontFamily to include IBM Plex Sans Arabic |
| Edit | `src/components/ui/card.tsx` | `rounded-lg` to `rounded-2xl` |
| Edit | `src/components/ui/button.tsx` | `rounded-md` to `rounded-xl` |
| Edit | `src/components/ui/input.tsx` | `rounded-md` to `rounded-xl` |
| Edit | `src/components/admin/AdminLayout.tsx` | Sidebar color, active state glow, grouped sections, background color |
| Edit | `src/components/admin/AdminOverview.tsx` | Compact stats, zero-state tips |
| Edit | `src/components/admin/LeadsManagement.tsx` | Delete button, confirmation dialog, two-column modal |
| Edit | `src/components/admin/CasesManagement.tsx` | Delete button, confirmation dialog, color-coded financials |
| Edit | `src/components/admin/KPIAnalytics.tsx` | Hero net profit card, color-coded revenue/expenses |
| Edit | `src/components/admin/StudentManagement.tsx` | Delete button with confirmation |
| Edit | `src/pages/LawyerDashboardPage.tsx` | Background color, sidebar color update |
| Edit | `src/pages/InfluencerDashboardPage.tsx` | Background color, header color update |
| Edit | `src/pages/StudentDashboardPage.tsx` | Background color |
| Edit | `src/components/dashboard/DashboardHeader.tsx` | Background update |
| Edit | `src/components/dashboard/DashboardSidebar.tsx` | Active state styling |

### Implementation Order
1. Global theme (fonts, colors, border-radius, backgrounds)
2. Delete functionality with confirmation dialogs
3. Sidebar grouping
4. Financial visual improvements
5. Stats cards zero-state and compact layout
