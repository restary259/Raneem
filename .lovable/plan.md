
## Plan: Add Arabic Translations to TeamAppointmentsPage

### Inventory of All Hardcoded English Strings

From scanning `TeamAppointmentsPage.tsx`, every hardcoded English string that needs a translation key:

**Status labels (in `apptStyle` function, lines 83–114):**
- "Upcoming", "Completed", "No Show", "Rescheduled"

**Header / Calendar UI (lines 511–677):**
- "Today" (nav button)
- "day" / "week" / "month" (view toggle pills)
- "New Appointment" (already has `isAr ? "موعد جديد" : "New Appointment"` — must replace with `t()`)
- "· Today" (day view pill suffix, line 557)
- "Drop to schedule here" (drag hint, line 581)
- "Drop here" (week view hint, line 657)
- Day abbreviations: "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" (month view header, line 677)
- "+{n} more" (overflow pill, line 728)

**New/Edit modal (lines 756–909):**
- "Edit Appointment" / "New Appointment" (title)
- "Student" (label)
- "Select existing case…" (placeholder)
- "Manual" (button)
- "Enter student name…" (placeholder)
- "Date" (label)
- "Pick date" (placeholder)
- "Time (8 am – 8 pm)" (label)
- "Duration" (label)
- "Notes" (label)
- "What was discussed, action items, follow-ups…" (placeholder)
- "Cancel" (button)
- "Save Changes" / "Create Appointment" (button)

**Detail modal (lines 956–997):**
- "Notes" (label above notes block)
- "Edit" (button)
- "Delete" (button)
- "View Case" (button)
- "Record Outcome" (button)

**Reschedule confirm (lines 1014–1036):**
- "Reschedule Appointment?" (title)
- "Move **{name}** to:" (text)
- "Previously: {date}" (text)
- "Cancel" (button)
- "Confirm Reschedule" (button)

**Delete confirm (lines 1050–1065):**
- "Delete Appointment?" (title)
- "Remove the appointment with **{name}** on {date}? This cannot be undone." (text)
- "Cancel" (button)
- "Delete" (button)

**Toast messages (lines 230, 268, 310–326, 346, 378, 397):**
- "Appointments can only be scheduled between 8 am and 8 pm."
- "Rescheduled"
- "Please select a date"
- "Please select a case or enter a student name"
- "Please enter a student name"
- "Appointments must be between 8 am and 8 pm."
- "Appointment updated"
- "Appointment created"
- "Appointment deleted"

---

### Translation Keys to Add

**In `public/locales/en/dashboard.json`** — extend the existing `team.appointments` block and add a new `team.apptPage` block:

```json
"appointments": {
  "title": "Appointments",
  "needOutcome": "Need Outcome",
  "today": "Today",
  "upcoming": "Upcoming",
  "past": "Past Appointments",

  "statusUpcoming": "Upcoming",
  "statusCompleted": "Completed",
  "statusNoShow": "No Show",
  "statusRescheduled": "Rescheduled",

  "navToday": "Today",
  "viewDay": "Day",
  "viewWeek": "Week",
  "viewMonth": "Month",
  "newAppointment": "New Appointment",
  "dropHere": "Drop here",
  "dropSchedule": "Drop to schedule here",
  "moreCount": "+{{n}} more",

  "labelStudent": "Student",
  "labelDate": "Date",
  "labelTime": "Time (8 am – 8 pm)",
  "labelDuration": "Duration",
  "labelNotes": "Notes",
  "placeholderCase": "Select existing case…",
  "placeholderManualName": "Enter student name…",
  "placeholderDate": "Pick date",
  "placeholderNotes": "What was discussed, action items, follow-ups…",
  "manualBtn": "Manual",
  "editTitle": "Edit Appointment",
  "newTitle": "New Appointment",
  "btnCancel": "Cancel",
  "btnSaveChanges": "Save Changes",
  "btnCreate": "Create Appointment",
  "btnEdit": "Edit",
  "btnDelete": "Delete",
  "btnViewCase": "View Case",
  "btnRecordOutcome": "Record Outcome",

  "rescheduleTitle": "Reschedule Appointment?",
  "rescheduleMoveText": "Move {{name}} to:",
  "rescheduleOldDate": "Previously: {{date}}",
  "btnConfirmReschedule": "Confirm Reschedule",

  "deleteTitle": "Delete Appointment?",
  "deleteBody": "Remove the appointment with {{name}} on {{date}}? This cannot be undone.",
  "btnConfirmDelete": "Delete",

  "toastRescheduled": "Rescheduled",
  "toastCreated": "Appointment created",
  "toastUpdated": "Appointment updated",
  "toastDeleted": "Appointment deleted",
  "errNoDate": "Please select a date",
  "errNoCase": "Please select a case or enter a student name",
  "errNoName": "Please enter a student name",
  "errWorkHours": "Appointments must be between 8 am and 8 pm.",
  "errDropWorkHours": "Appointments can only be scheduled between 8 am and 8 pm.",

  "dayAbbrevSun": "Sun",
  "dayAbbrevMon": "Mon",
  "dayAbbrevTue": "Tue",
  "dayAbbrevWed": "Wed",
  "dayAbbrevThu": "Thu",
  "dayAbbrevFri": "Fri",
  "dayAbbrevSat": "Sat",
  "todayPill": "· Today"
}
```

**In `public/locales/ar/dashboard.json`** — same block with Arabic values:

```json
"appointments": {
  "title": "المواعيد",
  "needOutcome": "تحتاج نتيجة",
  "today": "اليوم",
  "upcoming": "القادمة",
  "past": "المواعيد السابقة",

  "statusUpcoming": "قادم",
  "statusCompleted": "مكتمل",
  "statusNoShow": "لم يحضر",
  "statusRescheduled": "أُعيد جدولته",

  "navToday": "اليوم",
  "viewDay": "يوم",
  "viewWeek": "أسبوع",
  "viewMonth": "شهر",
  "newAppointment": "موعد جديد",
  "dropHere": "أفلت هنا",
  "dropSchedule": "أفلت لجدولة موعد هنا",
  "moreCount": "+{{n}} أكثر",

  "labelStudent": "الطالب",
  "labelDate": "التاريخ",
  "labelTime": "الوقت (8 ص – 8 م)",
  "labelDuration": "المدة",
  "labelNotes": "ملاحظات",
  "placeholderCase": "اختر حالة موجودة…",
  "placeholderManualName": "أدخل اسم الطالب…",
  "placeholderDate": "اختر تاريخاً",
  "placeholderNotes": "ما الذي نوقش، عناصر العمل، المتابعات…",
  "manualBtn": "يدوي",
  "editTitle": "تعديل الموعد",
  "newTitle": "موعد جديد",
  "btnCancel": "إلغاء",
  "btnSaveChanges": "حفظ التغييرات",
  "btnCreate": "إنشاء الموعد",
  "btnEdit": "تعديل",
  "btnDelete": "حذف",
  "btnViewCase": "عرض الحالة",
  "btnRecordOutcome": "تسجيل النتيجة",

  "rescheduleTitle": "إعادة جدولة الموعد؟",
  "rescheduleMoveText": "نقل {{name}} إلى:",
  "rescheduleOldDate": "السابق: {{date}}",
  "btnConfirmReschedule": "تأكيد إعادة الجدولة",

  "deleteTitle": "حذف الموعد؟",
  "deleteBody": "إزالة الموعد مع {{name}} في {{date}}؟ لا يمكن التراجع عن هذا الإجراء.",
  "btnConfirmDelete": "حذف",

  "toastRescheduled": "تمت إعادة الجدولة",
  "toastCreated": "تم إنشاء الموعد",
  "toastUpdated": "تم تحديث الموعد",
  "toastDeleted": "تم حذف الموعد",
  "errNoDate": "يرجى اختيار تاريخ",
  "errNoCase": "يرجى اختيار حالة أو إدخال اسم الطالب",
  "errNoName": "يرجى إدخال اسم الطالب",
  "errWorkHours": "يجب أن تكون المواعيد بين الساعة 8 صباحاً و8 مساءً.",
  "errDropWorkHours": "لا يمكن جدولة المواعيد إلا بين الساعة 8 صباحاً و8 مساءً.",

  "dayAbbrevSun": "أحد",
  "dayAbbrevMon": "إثن",
  "dayAbbrevTue": "ثلا",
  "dayAbbrevWed": "أرب",
  "dayAbbrevThu": "خمي",
  "dayAbbrevFri": "جمع",
  "dayAbbrevSat": "سبت",
  "todayPill": "· اليوم"
}
```

---

### Code Changes in `TeamAppointmentsPage.tsx`

1. **Line 126**: Add `t` to destructure: `const { i18n, t } = useTranslation("dashboard")`

2. **`apptStyle` function** — it currently returns hardcoded `label` strings. Since it's a plain function (not a component), it can't call `t()`. Fix: return a label key instead and call `t()` at the call sites:
   - Change `label: "Upcoming"` → `label: "team.appointments.statusUpcoming"`
   - etc. for all 4 statuses
   - At render sites (line 937, line 83, line 92, etc.) use `t(s.label)` instead of `{s.label}`

3. **Line 511**: `"Today"` nav button → `{t("team.appointments.navToday")}`

4. **Line 522–528**: view toggle — replace `` `capitalize` `` + `{v}` with `t(\`team.appointments.view${v.charAt(0).toUpperCase() + v.slice(1)}\`)`

5. **Line 533**: Replace `isAr ? "موعد جديد" : "New Appointment"` → `{t("team.appointments.newAppointment")}`

6. **Line 557**: `· Today` → `{t("team.appointments.todayPill")}`

7. **Line 581**: `"Drop to schedule here"` → `{t("team.appointments.dropSchedule")}`

8. **Line 657**: `"Drop here"` → `{t("team.appointments.dropHere")}`

9. **Line 677**: Day abbrev array `["Sun","Mon",...]` → `[t("...Sun"), t("...Mon"), ...]`

10. **Line 728**: `+{n} more` → `{t("team.appointments.moreCount", { n: dayAppts.length - 3 })}`

11. **Modal labels/placeholders** (lines 756–909): replace all 13 hardcoded strings with `t()` calls

12. **Detail modal** (lines 956–997): replace 4 button labels + "Notes" with `t()` calls

13. **Reschedule confirm** (lines 1014–1036): replace 5 strings with `t()` calls; update Reschedule confirm `dir` from always `"ltr"` → `dir={isAr ? 'rtl' : 'ltr'}` since it now has Arabic content

14. **Delete confirm** (lines 1050–1065): replace 4 strings with `t()` calls; same dir fix

15. **Toast messages** (lines 230, 268, 310–326, 346, 378, 397): replace 9 hardcoded English strings with `t()` calls

---

### Files to Change

| File | Change |
|------|--------|
| `public/locales/en/dashboard.json` | Extend `team.appointments` block with ~40 new keys |
| `public/locales/ar/dashboard.json` | Add same 40 keys in Arabic |
| `src/pages/team/TeamAppointmentsPage.tsx` | Replace all hardcoded strings with `t()` calls |
