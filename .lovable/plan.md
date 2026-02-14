

## Remaining Hardcoded Strings Audit and Fix

This plan covers all remaining components with hardcoded Arabic/English strings that need i18n translation keys.

---

### Audit Findings

**Components with ALL strings hardcoded (no i18n):**

| File | Hardcoded Strings Count | Language |
|------|------------------------|----------|
| `AppointmentCalendar.tsx` | ~25 strings | Arabic |
| `CustomNotifications.tsx` | ~12 strings | Arabic |
| `PasswordVerifyDialog.tsx` | ~8 strings | Arabic |
| `LeadsManagement.tsx` | ~50 strings | Arabic |

**Components with partial hardcoding (uses `t()` for some but not all):**

| File | Hardcoded Strings | Already i18n |
|------|-------------------|-------------|
| `AdminOverview.tsx` | ZERO_TIPS dict (13 Arabic strings), 5 stat labels | ~6 labels use `t()` |
| `EarningsPanel.tsx` | 4 strings (timer column header, waiting text, "ready", toast) | Most use `t()` |
| `StudentManagement.tsx` | Delete dialog (3 strings), toast "deleted" | Most use `t()` |
| `ContactsManager.tsx` | Delete dialog (3 strings), toast "deleted", error toast | Most use `t()` |
| `ChecklistManagement.tsx` | Delete dialog (3 strings) | Most use `t()` |
| `PayoutsManagement.tsx` | PasswordVerifyDialog title/desc props (2 strings), fallback name | Most use `t()` |

**Components fully translated (no changes needed):**

- `SecurityPanel.tsx` -- fully uses `t()`
- `AuditLog.tsx` -- fully uses `t()`
- `ReferralManagement.tsx` -- fully uses `t()`
- `ReferralLink.tsx` -- fully uses `t()`
- `MediaHub.tsx` -- fully uses `t()`

---

### Implementation Plan

#### Step 1: Add Missing Translation Keys to Locale Files

**`dashboard.json` (both en and ar)** -- Add keys for:

- `admin.overview.eligiblePct` / `closedPct` / `revenue` / `pendingPayouts` / `topLawyer` / `topAgent` labels
- `admin.overview.zeroTips.*` (13 zero-state hint strings)
- `admin.overview.ofTotal` ("of" connector for subtexts like "5 of 10")
- `admin.appointments.*` (~20 keys: title, newAppointment, addTitle, linkCase, studentName, date, time, duration, durationMinutes, location, locationPlaceholder, notes, saving, addBtn, deleted, appointmentsFor, noAppointments, upcoming, scheduled, selectCase, requiredFields)
- `admin.notifications.*` (~10 keys: title, notificationTitle, notificationBody, bodyPlaceholder, sendTo, lawyers, students, agents, all, sending, sendNow, sent, sentDesc, fillAllFields, notLoggedIn, sendFailed)
- `admin.passwordVerify.*` (~6 keys: title, description, password, placeholder, cancel, confirm, verifying, verifyFailed, wrongPassword, userNotFound)
- `admin.leads.*` (~35 keys: all lead management labels, statuses, source types, dialogs, buttons, eligibility display, CSV headers)
- `admin.shared.deleteTitle` / `deleteDesc` / `cancelBtn` / `deleteBtn` / `deleted` (shared delete dialog strings used in 4+ components)
- `influencer.earnings.timer` / `waitingPeriod` / `ready` / `waitingNotOver` / `days` (EarningsPanel timer strings)
- Day names for AppointmentCalendar (or use date-fns locale dynamically)

#### Step 2: Refactor Components

**Priority A -- Fully hardcoded components:**

1. **`LeadsManagement.tsx`**: Replace `STATUS_MAP` and `SOURCE_MAP` with `t()` calls. Replace all dialog titles, labels, buttons, toasts, CSV headers, eligibility text with `t()` keys. Import `useTranslation`.

2. **`AppointmentCalendar.tsx`**: Import `useTranslation`. Replace all labels, dialog fields, toasts, day names (use `date-fns` locale switching based on `i18n.language`), status badges with `t()` keys.

3. **`CustomNotifications.tsx`**: Import `useTranslation`. Replace `ROLE_OPTIONS` labels, card title, form labels, button text, toasts with `t()` keys.

4. **`PasswordVerifyDialog.tsx`**: Import `useTranslation`. Replace default props, labels, button text, toasts with `t()` keys.

**Priority B -- Partially hardcoded components:**

5. **`AdminOverview.tsx`**: Replace hardcoded `ZERO_TIPS` with `t()` lookups. Replace 5 remaining stat labels (`eligiblePct`, `closedPct`, `revenue`, `pendingPayouts`, `topLawyer`, `topAgent`) with `t()` keys. Replace "of" connector in subtexts.

6. **`EarningsPanel.tsx`**: Replace 4 remaining hardcoded strings: column header "timer", waiting period toast, "ready" text, "days" unit.

7. **`StudentManagement.tsx`**: Replace delete dialog (title, description, cancel, delete buttons) and "deleted" toast with `t()`.

8. **`ContactsManager.tsx`**: Replace delete dialog and error/deleted toasts with `t()`.

9. **`ChecklistManagement.tsx`**: Replace delete dialog with `t()`.

10. **`PayoutsManagement.tsx`**: Replace PasswordVerifyDialog title/desc props and fallback name with `t()`.

---

### Technical File Summary

| File | Action |
|------|--------|
| `public/locales/en/dashboard.json` | Add ~90 missing keys |
| `public/locales/ar/dashboard.json` | Add ~90 missing keys |
| `src/components/admin/LeadsManagement.tsx` | Full i18n refactor (~50 strings) |
| `src/components/lawyer/AppointmentCalendar.tsx` | Full i18n refactor (~25 strings) |
| `src/components/admin/CustomNotifications.tsx` | Full i18n refactor (~12 strings) |
| `src/components/admin/PasswordVerifyDialog.tsx` | Full i18n refactor (~8 strings) |
| `src/components/admin/AdminOverview.tsx` | Replace ZERO_TIPS + 5 labels with `t()` |
| `src/components/influencer/EarningsPanel.tsx` | Replace 4 remaining hardcoded strings |
| `src/components/admin/StudentManagement.tsx` | Replace delete dialog strings |
| `src/components/admin/ContactsManager.tsx` | Replace delete dialog + toast strings |
| `src/components/admin/ChecklistManagement.tsx` | Replace delete dialog strings |
| `src/components/admin/PayoutsManagement.tsx` | Replace dialog props + fallback |

### Implementation Order

1. Add all missing keys to both locale JSON files
2. Refactor Priority A components (LeadsManagement, AppointmentCalendar, CustomNotifications, PasswordVerifyDialog)
3. Refactor Priority B components (AdminOverview, EarningsPanel, delete dialogs in Student/Contacts/Checklist/Payouts)

