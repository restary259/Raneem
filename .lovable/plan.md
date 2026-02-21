

# Fix Team Dashboard Tabs: Add "Paid" Tab and Correct "Submitted" Filter

## Problem

Currently in `src/pages/TeamDashboardPage.tsx`:
- The "Submitted" tab filter shows `paid` cases (line 89) instead of `services_filled` cases
- There is no separate "Paid" tab for cases the admin has marked as paid
- The `getNeonBorder` function maps `paid` to the submitted border color (line 66)
- The `profile_filled` filter incorrectly groups `services_filled` with it (line 88)

## Changes (single file: `src/pages/TeamDashboardPage.tsx`)

### 1. Add "paid" to the filter tab type and array
- Update `CaseFilterTab` type to include `'paid'`
- Add `'paid'` to `CASE_FILTER_TABS` array (after `'submitted'`, before `'sla'`)

### 2. Add neon border for "paid" tab
- Add `paid: 'border-[hsl(140,80%,45%)] shadow-[0_0_6px_hsl(140,80%,45%/0.3)]'` to `NEON_BORDERS`

### 3. Fix `getNeonBorder` function
- `profile_filled` only (remove `services_filled` from this group)
- `services_filled` maps to `NEON_BORDERS.submitted`
- `paid` maps to new `NEON_BORDERS.paid`

### 4. Fix `matchesFilter` function
- `profile_filled` filter: only `profile_filled` (not `services_filled`)
- `submitted` filter: only `services_filled`
- New `paid` filter: only `paid`

### 5. Add "Paid" label to `FILTER_LABELS`
- Arabic: "مدفوع"
- English: "Paid"

### 6. Update "Submitted" label for clarity
- Change English from "Submitted" to "Submitted to Admin"
- Change Arabic from "تم الإرسال للمسؤول" (already correct)

## Complete Profile Button Verification

The "Complete Profile" button calls `confirmCompleteFile()` which uses `canTransition(case_status, PROFILE_FILLED)`. The transition map allows:
- `appointment_scheduled` -> `profile_filled` (allowed)
- `appointment_waiting` -> `profile_filled` (allowed)
- `appointment_completed` -> `profile_filled` (allowed)

This is correct and will work as expected when clicking "Complete Profile" from appointment-stage cases.

## Technical Details

All changes are in lines 50-91 of `src/pages/TeamDashboardPage.tsx`:
- Line 57: Add paid neon border
- Line 62-67: Update getNeonBorder
- Line 70-71: Add 'paid' to type and array
- Line 79-81: Update filter labels, add paid label
- Line 83-91: Fix matchesFilter logic

