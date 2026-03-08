
## Full Team Dashboard Audit — Findings & Fix Plan

### Root Cause Analysis

**Bug 1 — BirthdayPicker in `ProfileCompletionForm` is broken (the reported issue)**

`ProfileCompletionForm.tsx` has its OWN local `BirthdayPicker` (lines 109–170) that uses `Date | undefined` as its value type and calls `onChange(new Date(\`${y}-${m}-${d}\`))`. The problem:

```
update = (y, m, d) => { if (y && m && d) onChange(new Date(`${y}-${m}-${d}`)) }
```

When you first pick a **Year only**, `selMonth` and `selDay` are empty strings → `update(y, "", "")` → condition `if (y && m && d)` fails → nothing changes. Then when you pick Month, it calls `update(y, m, selDay || "01")` which auto-sets day to "01" before the user chose it. This is functionally broken.

**Compare to `SubmitNewStudentPage.tsx`**: It already has the FIXED version — BirthdayPicker accepts `value: string` (ISO), stores year/month/day as separate `useState` strings, and uses `normalizeDate()` from `dateUtils.ts`. It handles partial state correctly.

**Bug 2 — `ProfileCompletionForm` uses `Date` objects; `SubmitNewStudentPage` uses ISO strings**

The two forms are out of sync in every date field:

| Field | `ProfileCompletionForm` | `SubmitNewStudentPage` |
|-------|------------------------|----------------------|
| DOB | `Date \| undefined` (broken BirthdayPicker) | `string` ISO + `normalizeDate` (fixed) |
| Arrival Date | `Date \| undefined` (Popover `<Calendar>`) | `string` ISO + `<Input type="date">` |
| Course Start | `Date \| undefined` (Popover `<Calendar>`) | `string` ISO + `<Input type="date">` |
| Course End | `Date \| undefined` (auto-calc) | `string` ISO (auto-calc) |

The Popover `<Calendar>` based `DatePick` component inside `ProfileCompletionForm` also has the known pointer-events CSS issue in modals/dialogs.

**Bug 3 — `ProfileCompletionForm` still imports `Popover, Calendar` for DatePick (legacy broken component)**

`DatePick` uses `<Popover><Calendar>` — this is the widget with the pointer-events issue. The same fix already applied to `SubmitNewStudentPage` (using `<Input type="date">`) needs to be applied here.

**Bug 4 — `TeamTodayPage.tsx` line 86: date uses `"ar-EG"` locale**

```typescript
const dateStr = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-GB", {...})
```
This violates `numeric-safety-v1` — `ar-EG` renders Arabic-Indic numerals. Must use `"en-US"` always.

**Non-bugs found during audit:**
- `TeamCasesPage.tsx` — works correctly, creates case at `new` status ✓
- `CaseDetailPage.tsx` pipeline progression — all 7 stages wired correctly ✓
- `TeamAppointmentsPage.tsx` — calendar with drag-and-drop works ✓
- `TeamTodayPage.tsx` — KPI cards and overdue detection work ✓
- RLS: `Partner can view all cases` policy means partner sees ALL cases (not filtered by `partner_id`) — this is by design per the "pool mode" setting ✓

---

### What to Fix

**File 1: `src/components/team/ProfileCompletionForm.tsx`**

Replace the broken local `BirthdayPicker` (lines 109–170) with the fixed version from `SubmitNewStudentPage`:
- Change `value: Date | undefined` → `value: string` (ISO string)
- Use separate `year/month/day` useState strings
- Call `normalizeDate()` from `dateUtils.ts`
- Import `DOB_MONTHS, DOB_YEARS, normalizeDate, daysInMonth` from `@/utils/dateUtils`

Replace the broken `DatePick` component (Popover/Calendar) with `<Input type="date">` — matching `SubmitNewStudentPage`'s `SimpleDateField`.

Update all state variables:
- `dob`: `Date | undefined` → `string` (ISO or "")
- `arrivalDate`: `Date | undefined` → `string`
- `courseStart`: `Date | undefined` → `string`
- `courseEnd`: `Date | undefined` → `string`

Update `handleSave` to use `dob` string directly (no `format(dob, ...)` needed).

Update the Review step display to format ISO strings correctly.

Remove unused imports: `Popover, PopoverContent, PopoverTrigger, Calendar, CalendarIcon` — these are only needed by the broken `DatePick`.

**File 2: `src/pages/team/TeamTodayPage.tsx`**

Line 86: `isAr ? "ar-EG" : "en-GB"` → `"en-US"` (numeric safety fix).

---

### Files to Change

| File | Change |
|------|--------|
| `src/components/team/ProfileCompletionForm.tsx` | Fix BirthdayPicker + DatePick to use ISO strings, matching SubmitNewStudentPage |
| `src/pages/team/TeamTodayPage.tsx` | Line 86: locale → `"en-US"` |
