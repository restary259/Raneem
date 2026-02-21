

# Language-Year Optimization: Visa Removal, Housing Merge, and Performance

## Overview

This plan simplifies the team and admin case workflow by removing visa-related fields from the active pipeline (keeping DB structure intact), merging two housing fields into one free-text "Housing Type" field, and applying performance and UX improvements.

---

## 1. Remove Visa Tab from Team Profile Modal

**File: `src/pages/TeamDashboardPage.tsx`**

### Remove the "Visa Info" tab (lines 940, 959-990)
- Delete the `<TabsTrigger value="visa">` from the TabsList (line 940)
- Delete the entire `<TabsContent value="visa">` block (lines 959-990)
- This removes: Height, Eye Color, Gender selector, Legal Name Change, Criminal Record, Dual Citizenship fields
- **Keep `gender` in the "Personal Info" tab** since it is a required profile field (part of `requiredProfileFields` on line 316). Move the Gender `<Select>` from the Visa tab to the bottom of the Personal Info tab.

### Remove visa fields from `openProfileModal` (lines 269-287)
- Remove initialization of: `height`, `eye_color`, `has_changed_legal_name`, `previous_legal_name`, `has_criminal_record`, `criminal_record_details`, `has_dual_citizenship`, `second_passport_country`
- Keep: `gender` (required field)

### Remove visa fields from `saveProfileCompletion` (lines 290-311)
- The update payload only writes fields explicitly listed. Since visa fields (eye_color, height, etc.) are not in the `updateData` object on lines 293-311, no change needed here -- they were never persisted from this function.
- Confirm: `gender` stays in `updateData` (line 309) -- already correct.

### No change to `requiredProfileFields` (line 313-317)
- Gender stays required. No visa fields were in this list.

---

## 2. Merge Housing Fields into Single "Housing Type"

### Current state
- `accommodation_status` (Select dropdown: dorm, private_apartment, shared_flat, homestay, other)
- `housing_description` (Free text: "Housing / Room Type")

### Target state
- Single free-text field called "Housing Type" stored in `housing_description` column
- Remove `accommodation_status` from UI (keep column in DB)
- Team members type freely (e.g., "Shared flat with bathroom", "Student dorm single room")

### Changes in `src/pages/TeamDashboardPage.tsx`

**Services tab in profile modal (lines 993-1041):**
- Remove the `accommodation_status` Select dropdown (lines 1018-1026)
- Rename the `housing_description` field label to "Housing Type" / "نوع السكن"
- Keep it as a free-text `<Input>` field (already is)

**Remove `accommodation_status` from required fields (line 316):**
- Remove `'accommodation_status'` from `requiredProfileFields` array
- This reduces required fields from 14 to 13

**Remove from `openProfileModal` (line 282):**
- Remove `accommodation_status` initialization

**Remove from `saveProfileCompletion` updateData (line 306):**
- Remove `accommodation_status` line

**Remove `ACCOMMODATION_OPTIONS` constant (line 38):**
- No longer needed

### Changes in `src/components/admin/StudentCasesManagement.tsx`

**Case detail dialog, Services tab (lines 248-253):**
- The housing_description display is already present. No change needed -- it already shows "Housing / Room Type".
- Update label to "Housing Type" for consistency.

### Changes in `src/components/admin/ReadyToApplyTable.tsx`

**Profile edit modal (lines 357-366):**
- Replace the `accommodation_status` Select with a plain Input for "Housing Type" writing to `housing_description`
- Update table column header from "Accommodation" to "Housing Type"
- Update table cell to show `housing_description` instead of `accommodation_status`

**Save profile function (line 149):**
- Remove `accommodation_status` from update payload
- Ensure `housing_description` is saved

### Data Migration (safe, non-destructive)
- For existing cases where `accommodation_status` has a value but `housing_description` is empty, concatenate: `housing_description = accommodation_status`
- For cases where both exist, prepend: `housing_description = accommodation_status + ' - ' + housing_description`
- Do NOT drop the `accommodation_status` column

```sql
UPDATE student_cases
SET housing_description = COALESCE(accommodation_status, '')
WHERE housing_description IS NULL AND accommodation_status IS NOT NULL;

UPDATE student_cases
SET housing_description = accommodation_status || ' - ' || housing_description
WHERE housing_description IS NOT NULL AND accommodation_status IS NOT NULL
AND housing_description != '' AND accommodation_status != '';
```

---

## 3. Remove Visa References from Admin Case Workflow

### `src/components/admin/StudentCasesManagement.tsx`
- The case detail Profile tab (lines 213-234) does not show any visa fields -- no change needed.
- Housing display in Services tab (line 249): update label to "Housing Type".

### `src/components/admin/StudentProfilesManagement.tsx`
- The "Legal / Visa Section" (lines 239-263) stays as-is. This is the student profiles management, not the case pipeline. Visa data remains viewable here for admins reviewing student profiles (not part of the case workflow).

### `src/components/admin/MoneyDashboard.tsx` (line 126)
- Update legacy status filter: change `['paid', 'completed', 'ready_to_apply', 'registration_submitted', 'visa_stage', 'settled']` to just `['paid']` since all legacy statuses now map to Paid.

---

## 4. Performance Optimizations

### Eliminate unnecessary re-renders in TeamDashboardPage
- Wrap `renderCaseActions` in `useCallback` to prevent re-creation on every render
- Memoize `todayAppointments` with `useMemo`
- Memoize `getLeadInfo` with `useCallback`

### Smooth tab switching
- The current implementation conditionally renders tab content (`{activeTab === 'cases' && ...}`). This causes unmount/remount on every switch. Replace with CSS visibility toggling:
  ```tsx
  <div style={{ display: activeTab === 'cases' ? 'block' : 'none' }}>...</div>
  ```
  This preserves scroll position and avoids re-render flashes.

### Loading state
- Replace the full-page spinner (lines 497-503) with a skeleton/shimmer that matches the layout, preventing white flash.

### Dialog performance
- Add `key={profileCase?.id}` to the profile modal Dialog to prevent stale state bleed between cases.

---

## 5. Regression Verification Checklist

The following must remain unchanged (code review confirms they are not affected):

| Area | Status |
|------|--------|
| Influencer attribution (leads.source_id) | Untouched -- no changes to leads table or source logic |
| Commission logic (auto_split_payment trigger) | Untouched -- DB trigger, no code changes |
| Financial tabs (MoneyDashboard) | Only status filter cleanup (legacy -> paid) |
| Status flow (caseTransitions.ts) | No changes in this plan |
| 20-day lock timer | Untouched |
| Payout requests | Untouched |
| Reassignment logic | Untouched |
| RLS policies | No changes |
| Real-time subscriptions | No changes |

---

## 6. UI/UX Improvement Suggestions

These are recommendations for future implementation:

1. **Profile modal autosave**: Add debounced autosave (500ms) on field changes instead of requiring manual Save click. Show a subtle "Saving..." indicator.

2. **Inline field editing on case cards**: Allow clicking a field value (e.g., city, school) directly on the card to edit in-place, avoiding full modal open for quick changes.

3. **Case card compact mode**: Add a toggle between "detailed" and "compact" card views. Compact shows only name + status + action buttons in a single row.

4. **Filter badge counts with color coding**: Show red badge count on SLA, green on Paid, blue on New -- currently all use the same style.

5. **Keyboard shortcuts**: Add Ctrl+K search, Escape to close modals, Tab to navigate between fields in the profile modal.

6. **Empty state illustrations**: Replace plain text empty states with SVG illustrations for better visual feedback.

7. **Drag-and-drop case reassignment**: Allow dragging case cards between team member columns in a Kanban-style view.

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/pages/TeamDashboardPage.tsx` | Remove visa tab, merge housing fields, move gender to personal tab, memoize functions, CSS tab switching |
| `src/components/admin/StudentCasesManagement.tsx` | Update housing label |
| `src/components/admin/ReadyToApplyTable.tsx` | Replace accommodation dropdown with housing type input |
| `src/components/admin/MoneyDashboard.tsx` | Clean legacy status filter to just 'paid' |
| Database migration | Merge accommodation_status into housing_description for existing data |

