
## Full Dashboard Scan — Findings & Fix Plan

### Pages scanned:
1. TeamTodayPage ✅ — mostly fine, but has issues
2. TeamCasesPage ✅ — just fixed, looks good
3. TeamAppointmentsPage ⚠️ — header overflows on mobile
4. TeamStudentsPage ✅ — clean
5. TeamAnalyticsPage ✅ — clean
6. BagrutConverter ✅ — clean
7. TeamStudentProfilePage ⚠️ — header squishes on mobile
8. SubmitNewStudentPage ⚠️ — hardcoded strings + grid overflows on mobile
9. MobileBottomNav ⚠️ — label truncation risk in AR

---

### Issues Found (5 total)

---

**Issue 1 — TeamAppointmentsPage header overflows on 390px**

Line 493: `flex items-center justify-between gap-3 flex-wrap` — the left group has `min-w-[200px]` on the date label plus prev/next/today buttons (~320px total), and the right group has the day/week/month toggles + "New Appointment" button (~250px). On 390px screen, both groups wrap to separate rows but the month label (`min-w-[200px]`) still bleeds into the prev/next controls on narrow RTL layouts. The "New Appointment" button text is also long in Arabic.

**Fix:** Remove `min-w-[200px]` from the header date label, make it `min-w-0 flex-1 text-center` instead. Hide button text "New Appointment" on mobile with `hidden sm:inline` and show only the `+` icon.

---

**Issue 2 — TeamTodayPage: hardcoded Arabic strings and `toLocaleDateString('ar-SA')` → Arabic-Indic digits**

Line 86: `new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", ...)` → produces `الأحد، ٨ مارس ٢٠٢٦` with Arabic-Indic numerals on Arabic locale.  
Lines 108–110, 123–124: hardcoded inline Arabic/English ternaries like `isAr ? "جار التحميل..." : "Loading..."` — violates i18n rules.  
Lines 118–120: `toLocaleString(isAr ? "ar-SA" : "en-US", ...)` on appointment datetime → Arabic-Indic numbers again.

**Fix:**
- Change line 86 to always `'en-US'` locale
- Change line 119 to always `'en-US'` locale
- Replace hardcoded ternary strings with `t()` keys (or at minimum replace `'ar-SA'` → `'en-US'` since that's the numeric safety rule)

---

**Issue 3 — TeamTodayPage: appointment cards — name + button fighting on narrow width**

Line 115: `flex items-center justify-between text-sm` with a long student name on the left and `<Button size="sm" variant="destructive">تسجيل</Button>` on the right. No `min-w-0` on the name span. On 360px, long Arabic names like `"أحمد محمود الخالد"` overflow into the button.

**Fix:** Add `min-w-0 flex-1 truncate` to the name/date `<span>` inside the overdue card row. Add `shrink-0` to the Record button.

---

**Issue 4 — TeamStudentProfilePage: header squishes on mobile (same pattern as CaseDetailPage before fix)**

Line 45: `flex items-center gap-4` with back button + `text-2xl font-bold` name + `<Badge>` all in one row — no `flex-wrap`, no `min-w-0` on name. On 390px, long names like "Ahmad Khalil Hassan" truncate and the badge falls off screen.

**Fix:** Apply the same 2-row pattern used in CaseDetailPage:
- Row 1: back button + name (`flex-1 min-w-0 truncate`)
- Row 2: status badge (own row with `ps-1`)

---

**Issue 5 — SubmitNewStudentPage: `Step 2` address grid 3-col collapses on mobile**

Line 615: `grid grid-cols-3 gap-2` for the address inputs (Street / House No. / Postcode) — `grid-cols-3` is hardcoded with no responsive breakpoint. On 390px, three inputs at ~110px each cause horizontal overflow out of the card.

Also line 502–508: the page header `flex items-center gap-4` has `text-2xl font-bold` name with no `flex-1 min-w-0` — the "Submit New Student" title can overflow on narrow screens.

**Fix:**
- Change `grid grid-cols-3` → `grid grid-cols-1 sm:grid-cols-3` for the address inputs
- Add `flex-1 min-w-0` to the `h1` in the page header

---

### Files to change (3 files)

| File | Issues | Lines |
|------|--------|-------|
| `src/pages/team/TeamAppointmentsPage.tsx` | Header overflow, button text | 499, 533–536 |
| `src/pages/team/TeamTodayPage.tsx` | Locale digits, row overflow | 86, 115–120 |
| `src/pages/team/TeamStudentProfilePage.tsx` | Header squish | 45–51 |
| `src/pages/team/SubmitNewStudentPage.tsx` | Address grid overflow, header | 503–508, 615 |

---

### Precise changes

**TeamAppointmentsPage.tsx line 499:**
```tsx
// before
<button className="text-sm font-semibold min-w-[200px] text-center ...">
// after
<button className="text-sm font-semibold min-w-0 flex-1 text-center ...">
```
**Lines 533–536 — hide "New Appointment" text on mobile:**
```tsx
<Button size="sm" className="gap-1.5 rounded-full px-3 sm:px-4 h-8 shadow-sm" onClick={() => openNew()}>
  <Plus className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">{t("team.appointments.newAppointment")}</span>
</Button>
```

**TeamTodayPage.tsx line 86:**
```tsx
// before
const dateStr = new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", {...})
// after
const dateStr = new Date().toLocaleDateString("en-US", {...})
```
**Line 119:**
```tsx
// before
{new Date(a.scheduled_at).toLocaleString(isAr ? "ar-SA" : "en-US", {...})}
// after
{new Date(a.scheduled_at).toLocaleString("en-US", {...})}
```
**Line 115 — fix overflow in overdue card rows:**
```tsx
// before
<div className="flex items-center justify-between text-sm">
  <span>{(a.case as any)?.full_name} — ...
// after
<div className="flex items-center justify-between gap-2 text-sm">
  <span className="min-w-0 flex-1 truncate">{(a.case as any)?.full_name} — ...
  // Button gets shrink-0
```

**TeamStudentProfilePage.tsx lines 45–51 — 2-row header:**
```tsx
<div className="space-y-1.5">
  <div className="flex items-center gap-2 min-w-0">
    <Button variant="ghost" size="sm" onClick={() => navigate('/team/students')} className="shrink-0">
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0 flex-1">{caseData.full_name as string}</h1>
  </div>
  <div className="ps-1">
    <Badge className={...}>{(caseData.status as string).replace(/_/g, ' ')}</Badge>
  </div>
</div>
```

**SubmitNewStudentPage.tsx line 615:**
```tsx
// before
<div className="grid grid-cols-3 gap-2 mt-1">
// after
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
```
**Lines 503–507 — header title overflow:**
```tsx
<h1 className="text-xl sm:text-2xl font-bold min-w-0 flex-1 truncate">
  {isAr ? "تسجيل طالب جديد" : "Submit New Student"}
</h1>
```
