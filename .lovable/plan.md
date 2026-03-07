
## Full Production Audit & Fix — DARB Platform

This is a large-scale audit covering all 4 dashboards. I will organize it into a manageable set of concrete file changes, prioritized by impact.

### Findings Summary

**What's already correct:**
- `NAV_CONFIG` in `DashboardLayout.tsx` has all required entries for all roles
- `App.tsx` routes all match sidebar entries; `/team/bagrut` → `BagrutConverter` is registered
- Both `en/dashboard.json` and `ar/dashboard.json` contain all required `nav.*` keys including `nav.bagrut` and `nav.spreadsheet`
- The `verify-admin-password` edge function uses correct `admin_audit_log` columns with `.catch()` — already correct
- `AdminStudentsPage` omits `deleted_at` filter with proper comment — already correct
- `BagrutConverter` uses `bagrutToGermanGrade()` from `gradeConverter.ts`
- `generateIntakeMonths()` utility exists and is used in `SubmitNewStudentPage`
- `TeamStudentsPage` create-student flow is functional
- Partner sidebar is missing `/partner/link` — shows `nav.analytics` for overview instead of `nav.overview`, and has no `nav.myLink` entry

**What needs fixing:**

1. **Partner Sidebar** — Missing `/partner/link` entry. Current config shows `nav.analytics` as label for `/partner` (overview). Partner `nav.myLink` entry is missing from sidebar nav (it exists only in mobile nav).

2. **`CopyButton` component missing** — Referenced in the audit requirements (Section 11) but `src/components/common/CopyButton.tsx` does not exist. Must be created and added to the `AdminStudentsPage` detail sheet.

3. **`AdminStudentsPage` — No copy buttons** on student info fields in the detail sheet. Need to wire up `CopyButton` next to each field (email, phone, name, emergency contact, arrival date, created by, case ID, document URLs).

4. **`PartnerOverviewPage`** — Hardcoded bilingual strings instead of `t()` calls throughout.

5. **`PartnerLinkPage`** — Desktop-only block hides the link on mobile. This is poor UX; on mobile the link should still be copyable (just simpler UI).

6. **`TeamStudentsPage`** — Student list uses hardcoded English strings (`"Students"`, `"Manage student accounts..."`, `"Create Student Account"`, etc.) instead of `t()` calls.

7. **`AdminCommandCenter`** — Missing loading skeleton for KPIs; values could show `NaN` if data is empty. Needs defensive `|| 0` and skeleton states.

8. **`MobileBottomNav`** — Partner role shows `nav.overview` pointing to `/partner` but there's no `nav.myLink` shortcut on mobile. The `shortLabel` map is fine but `social_media_partner` only has 4 items, which is acceptable.

9. **`StudentVisaPage`** — Read-only. Status is not editable by student (correct per spec). No issues.

10. **`StudentReferPage`** — Delegates to `ReferralForm` and `ReferralTracker` components which need checking.

### Implementation Plan

**Phase 1 — New reusable `CopyButton` component**
- Create `src/components/common/CopyButton.tsx` exactly as specified in Section 11

**Phase 2 — `AdminStudentsPage` — Add copy buttons to detail sheet**
- In the student info display section (lines ~824–870), add `<CopyButton value={field.value} />` inline with each data row
- For documents section, add copy URL button next to each document's download button

**Phase 3 — Fix Partner sidebar nav label**
- In `DashboardLayout.tsx`, change `social_media_partner` nav entry for `/partner` from `nav.analytics` to `nav.overview` (it already shows "Overview" in mobile nav; desktop sidebar shows wrong label)

**Phase 4 — Fix `PartnerLinkPage` mobile block**
- Remove the mobile-only restriction. Show a simplified but functional link card on all viewports

**Phase 5 — Fix hardcoded strings in `TeamStudentsPage`**
- Replace hardcoded English strings with `t()` calls using existing `team.students.*` translation keys

**Phase 6 — `AdminCommandCenter` defensive null handling**
- Add `|| 0` guards and loading skeleton cards to prevent `NaN` display

**Phase 7 — UI/UX polish on `AdminStudentsPage` document row**
- Add file size and upload date display to each document row (already partially there, just needs cleaner presentation)

### Files to change

```
NEW:
  src/components/common/CopyButton.tsx

EDIT:
  src/components/layout/DashboardLayout.tsx
    → Fix social_media_partner nav: /partner label from nav.analytics → nav.overview
    → Add nav.myLink entry to partner sidebar

  src/pages/admin/AdminStudentsPage.tsx
    → Import CopyButton
    → Add CopyButton next to each detail field
    → Add CopyButton next to each document URL

  src/pages/partner/PartnerLinkPage.tsx
    → Remove desktop-only restriction
    → Show link on all screen sizes

  src/pages/team/TeamStudentsPage.tsx
    → Replace hardcoded strings with t() calls

  src/pages/admin/AdminCommandCenter.tsx
    → Add defensive || 0 to all KPI values
    → Add loading skeletons
```

### Key Details

**`CopyButton` component** — exact spec from Section 11, uses `navigator.clipboard.writeText`, shows `Check` for 2 seconds then reverts to `Copy`.

**Partner sidebar fix** — The current config has:
```ts
social_media_partner: [
  { key: "nav.analytics", icon: BarChart2, href: "/partner" },  // WRONG LABEL
  { key: "nav.students",  icon: GraduationCap, href: "/partner/students" },
  { key: "nav.earnings",  icon: TrendingUp, href: "/partner/earnings" },
]
```
Should be:
```ts
social_media_partner: [
  { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
  { key: "nav.myLink",   icon: Link2, href: "/partner/link" },
  { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
  { key: "nav.earnings", icon: TrendingUp, href: "/partner/earnings" },
]
```
Both `nav.overview` and `nav.myLink` already exist in both locale files — no locale changes needed.

**CopyButton placement in `AdminStudentsPage`** — Each info row in the read-only view (lines ~864–869) renders as `{icon} {label} {value}`. We add `<CopyButton value={raw_value} />` after the value span. For documents: add next to the existing download button.

**`PartnerLinkPage` mobile fix** — Remove the `if (isMobile)` early return that shows "Desktop Only". The full link card works on mobile; the `navigator.share` API is especially good on mobile.

**`AdminCommandCenter` defensive values** — The `counts` calculation uses `.filter().length` which always returns a number, so `NaN` is not actually possible there. But the `fetchData` runs inside `Promise.all` and if one fails, the whole thing fails. The fix is to use `Promise.allSettled` or individual try/catch per query so partial failures show partial data rather than nothing.

**No locale file changes needed** — Both `nav.*` keys for all required entries already exist in both `en/dashboard.json` and `ar/dashboard.json`.

**No route changes needed** — `App.tsx` already has all routes properly configured.

**No edge function changes needed** — `verify-admin-password`, `create-student-from-case` are both correct per audit spec.
