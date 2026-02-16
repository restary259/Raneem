# Admin Dashboard Final Audit & Fix Plan

## Issues Found

### 1. Build Error in StudentCasesManagement.tsx (Line 123)

TypeScript error: `t()` with a plain string fallback returns a union type incompatible with React children. The call `t('cases.statuses.${c.case_status}', c.case_status)` needs to use `{ defaultValue: c.case_status }` syntax or wrap with `String()`.

**Fix:** Change line 123 and any similar pattern to use `String(t(...))`.

### 2. Chat Widget Not Hidden on Admin Route

The ChatWidget checks for `/admin-dashboard` but the actual admin route is `/admin`. The AI advisor icon still appears on the admin dashboard.

**Fix:** Update the path check from `/admin-dashboard` to `/admin`.

### 3. Admin Dashboard Mobile Navigation

Currently uses a `<select>` dropdown on mobile instead of a bottom hamburger/tab navigation matching the Influencer and Team dashboards.

**Fix:** Replace the mobile `<select>` in `AdminLayout.tsx` with a hamburger menu (using Sheet/drawer) that slides out with all sidebar items, similar to the bottom-nav pattern used in Influencer and Team dashboards. Add a fixed bottom nav with the 4 most relevant admin actions: Overview, Leads, Student Cases, Money.

---

## Technical Changes

### File 1: `src/components/admin/StudentCasesManagement.tsx`

- Line 123: Wrap `t()` call with `String()` to fix TS2322 build error
- Also fix lines 78, 95, and 126 which use the same pattern with `defaultValue`

### File 2: `src/components/chat/ChatWidget.tsx`

- Line 17: Change `/admin-dashboard` to `/admin`

### File 3: `src/components/admin/AdminLayout.tsx`

- Add a Sheet-based hamburger menu for mobile (replacing the `<select>` dropdown)
- Add a fixed bottom navigation bar with 4 key tabs: Overview, Leads, Student Cases, Money
- Match the styling of Influencer/Team dashboards (dark header, bottom nav with icons and labels)
- Keep the desktop sidebar unchanged     *"Conduct a thorough final audit of this system/document/process. Identify any hidden issues, inconsistencies, security risks, or potential failures that may not be immediately visible. Provide a clear summary of findings with actionable recommendations for correction or improvement."*