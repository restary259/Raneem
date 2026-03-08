
## Translation Scan — Complete Findings

### Summary
After scanning all 7 key dashboard pages, I found **two categories** of missing translations:

1. **Hardcoded `isRtl ? "AR" : "EN"` ternaries** — the prohibited pattern that must become `t('key')` calls
2. **Fully English-only hardcoded strings** — no `isRtl` at all, just raw English strings in JSX

The locale files (`en/dashboard.json` and `ar/dashboard.json`) are already **very complete** — both files have matching key counts. The issue is that the page files are not using `t()` where they should.

---

### File-by-file breakdown

#### 1. `AdminCommandCenter.tsx` — 2 violations
- Line 169–172: `isRtl ? "⚠️ يوجد ${count} حالة منسية..." : "⚠️ ${count} forgotten cases..."` (forgotten cases alert)
- Line 181–183: `isRtl ? "⏱️ يوجد ${count} حالة..." : "⏱️ ${count} cases have breached SLA..."` (SLA alert)

**New keys needed:**
- `admin.commandCenter.forgottenAlert` = `"⚠️ {{count}} forgotten case(s) require attention — click to view in pipeline"` / `"⚠️ يوجد {{count}} حالة منسية — انقر لعرضها"`
- `admin.commandCenter.slaAlert` = `"⏱️ {{count}} case(s) have breached SLA thresholds — click to review"` / `"⏱️ يوجد {{count}} حالة تجاوزت مهلة الاستجابة — انقر لعرضها"`
- `admin.commandCenter.slaBreaches` = `"SLA Breaches"` / `"تجاوزات SLA"` (already referenced on line 123 but key missing)

#### 2. `AdminPipelinePage.tsx` — ~35 violations
Most are fully English-only (no `isRtl` at all):
- Line 190: `"Not filled — click Edit Info to add"` (InfoRowAlways empty state)
- Line 281: `isRtl ? "تم التعيين بنجاح" : "Case assigned successfully"` (toast)
- Line 341: `"Info saved successfully ✓"` (toast)
- Line 362: `"Case deleted"` (toast)
- Line 431–442: SelectTrigger `"Filter by team member"`, SelectItem `"All"`, `"Unassigned"` (filters)
- Line 467: `"Empty"` (kanban empty column)
- Line 531: `"Unassigned"` (card badge)
- Line 557: `"Assign"` (select placeholder)
- Line 561: `"Unassigned"` (select item)
- Line 605: Status shown as English `STATUS_LABELS[status]?.en` (not using `t()`)
- Line 621: `isRtl ? "خصم" : "Discount"` inline
- Line 636: `"Edit Info"` (button label)
- Line 653: `saving ? "Saving…" : "Save"` (button)
- Line 663: `"Contact"` (section header)
- Line 665: `"Phone / WhatsApp"` (InfoRow label)
- Line 668: `"Submitted"` (InfoRow label)
- Line 680: `"Identity"` (section header)
- Line 686: `"Passport Type"` (InfoRow label)
- Line 698: `"Education"` (section header)
- Line 704: `"Education Level"` (InfoRow label)
- Line 712–716: `"English Units"`, `"Math Units"` (InfoRow labels)
- Line 751: `"English Proficiency"` (InfoRow label)
- Line 759–760: `"Preferences"` / `"Notes"` (section headers)
- Line 765: `"Preferred Major / Degree"` (InfoRow label)
- Line 782–789: `"No application info yet"` / `"Click Edit Info above..."` (empty state)
- Line 798: `"Edit Application Info"` (section header)
- Lines 804–934: All edit mode field labels (`"City"`, `"Passport Type"`, `"Education Level"`, `"English Units"`, `"Math Units"`, `"English Proficiency"`, `"Preferred Major / Degree"`, `"Intake Notes"`)
- Line 945: `saving ? "Saving…" : "Save Changes"` (button)
- Line 955: `"Delete This Case"` (button)
- Line 965: `"Assign to Team Member"` (section header)
- Line 974: `"Currently assigned to"` (label)
- Line 989: `"Assign to team member"` (select placeholder)
- Line 994: `"Unassigned"` (select item)
- Line 1009: `"Assigning…"` (status text)
- Lines 1022–1027: Delete dialog — `"Delete Case"`, full description with student name
- Line 1031: `"Cancel"` / `saving ? "Deleting…" : "Yes, Delete Case"` (dialog buttons)

**New keys needed (pipeline section):**
```
admin.pipeline.editInfo, admin.pipeline.saving, admin.pipeline.saveChanges,
admin.pipeline.notFilledHint, admin.pipeline.caseAssigned, admin.pipeline.infoSaved,
admin.pipeline.caseDeleted, admin.pipeline.emptyColumn, admin.pipeline.unassigned,
admin.pipeline.assignPlaceholder, admin.pipeline.assignToTeam, admin.pipeline.currentlyAssignedTo,
admin.pipeline.assigningStatus, admin.pipeline.noAppInfoYet, admin.pipeline.editInfoHint,
admin.pipeline.contact, admin.pipeline.phoneWhatsapp, admin.pipeline.submittedLabel,
admin.pipeline.identity, admin.pipeline.passportType, admin.pipeline.education,
admin.pipeline.educationLevel, admin.pipeline.englishUnits, admin.pipeline.mathUnits,
admin.pipeline.englishProficiency, admin.pipeline.preferences, admin.pipeline.preferredMajor,
admin.pipeline.notesSection, admin.pipeline.editAppInfo, admin.pipeline.cityLabel,
admin.pipeline.deleteCase, admin.pipeline.deleteCaseDesc, admin.pipeline.discount,
admin.pipeline.filterByTeam, admin.pipeline.allTeam
```

#### 3. `AdminSettingsPage.tsx` — ~40 violations
All `isRtl ? "AR" : "EN"` ternaries. Not using `t()`. Examples:
- Line 175: `isRtl ? "تم حفظ الإعدادات" : "Settings saved"`
- Line 185: `isRtl ? "الاسم مطلوب" : "Name is required"`
- Line 201: `isRtl ? "تم إنشاء جهة الاتصال" : "Contact created"`
- Line 223: `isRtl ? "جميع الحقول مطلوبة" : "All fields are required"`
- Line 240: `isRtl ? "تم إضافة الحقل" : "Field added"`
- Line 287–308: handleDataReset toast messages
- Line 331: loading state
- Line 350: `isRtl ? "حقول التأشيرة" : "Visa Fields"` (tab trigger)
- Line 352: `isRtl ? "⚠️ مسح البيانات" : "⚠️ Data Reset"` (tab trigger)
- Line 366–373: Platform form labels
- Line 378: saving button
- Line 407–450: Contact form labels (Arabic Name, English Name, Role, Phone, Email, Link, Category, Display Order)
- Line 462: empty state
- Line 497–558: Visa fields manager labels
- Line 564–566: Visa loading/empty states
- Line 578: `"*required"` badge
- Lines 602–714: All data reset UI labels and dialog

Many of these have matching keys in the locale files already (e.g., `visa.*`, `settings.reset.*`). Some need new keys.

**New keys needed (settings section):**
```
admin.settings.settingsSaved, admin.settings.nameRequired, admin.settings.contactCreated,
admin.settings.allFieldsRequired, admin.settings.fieldAdded, admin.settings.saving,
admin.settings.newCaseDays, admin.settings.contactedDays,
admin.settings.visaTabLabel, admin.settings.resetTabLabel,
admin.settings.contactFormArabicName, admin.settings.contactFormEnglishName,
admin.settings.contactFormRoleAr, admin.settings.contactFormRoleEn,
admin.settings.contactFormPhone, admin.settings.contactFormEmail,
admin.settings.contactFormLink, admin.settings.contactFormCategory,
admin.settings.contactFormOrder, admin.settings.noContacts,
admin.settings.visaManagerTitle, admin.settings.visaManagerSubtitle,
admin.settings.visaFieldKey, admin.settings.newVisaField, admin.settings.noVisaFields,
admin.settings.visaRequired,
admin.settings.counting, admin.settings.previewCount, admin.settings.recordsUnit,
admin.settings.purgeSuccess, admin.settings.finalConfirmTitle, admin.settings.finalConfirmDesc,
admin.settings.deleting, admin.settings.confirmYesDelete
```

#### 4. `AdminStudentsPage.tsx` — ~25 violations (all `isRtl` ternaries)
- Line 648: `isRtl ? "إدارة الطلاب" : "Student Management"`
- Line 656: `isRtl ? "تحديث" : "Refresh"`
- Line 665: `isRtl ? "بحث بالاسم أو البريد..." : "Search by name or email..."`
- Lines 675–679: Table headers (Student, Email, Phone, Created, Created By)
- Lines 693–719: Loading/empty states, "Self-registered" label
- Line 764–801: All field labels in read-only view (Email, Phone, City of Birth, Emergency Contact, etc.)
- Line 917: `"Admin Actions"` section header
- Line 927: `"Reset Password"` button
- Line 939: `"Selective Delete"` button
- Lines 949–1003: Document upload section labels
- Line 1013: `"Visa Information"` section header
- Line 1092: `"Referrals"` section header
- Lines 1102: `"Documents"` section header

Most of these already have matching `admin.students.*` keys in locale files. Just need to replace ternaries with `t()` calls.

#### 5. `AdminSpreadsheetPage.tsx` — 15 violations (all English-only, no `t()` at all, no `isRtl`)
- Line 199: `"Student Spreadsheet"` (page title)
- Line 200: `"Configurable view of all student applications"` (subtitle)
- Lines 207–213: Button labels (`"Columns"`, `"Export PDF"`)
- Line 221: `"Intake Month:"` label
- Lines 227: `"All months"` select item
- Line 239: `"Clear"` button
- Line 242: `"students"` count
- Line 248: `"Loading…"` state
- Lines 252–254: Empty state text
- Lines 316: `"Configure Columns"` dialog title
- Lines 337–343: Dialog buttons (`"Select All"`, `"Done"`)
- Column labels in `ALL_COLUMNS` array (lines 43–59)

**New keys needed (spreadsheet section):**
```
admin.spreadsheet.title, admin.spreadsheet.subtitle, admin.spreadsheet.columns,
admin.spreadsheet.exportPDF, admin.spreadsheet.intakeMonth, admin.spreadsheet.allMonths,
admin.spreadsheet.clear, admin.spreadsheet.studentsCount, admin.spreadsheet.loading,
admin.spreadsheet.noStudents, admin.spreadsheet.noStudentsForMonth,
admin.spreadsheet.configColumns, admin.spreadsheet.selectAll, admin.spreadsheet.done,
admin.spreadsheet.col.name, admin.spreadsheet.col.email, admin.spreadsheet.col.phone,
admin.spreadsheet.col.city, admin.spreadsheet.col.program, admin.spreadsheet.col.school,
admin.spreadsheet.col.accommodation, admin.spreadsheet.col.insurance,
admin.spreadsheet.col.intakeMonth, admin.spreadsheet.col.courseStart,
admin.spreadsheet.col.courseEnd, admin.spreadsheet.col.programCost,
admin.spreadsheet.col.accommodationCost, admin.spreadsheet.col.insuranceCost,
admin.spreadsheet.col.totalCost, admin.spreadsheet.col.status
```

#### 6. `TeamStudentsPage.tsx` — ~15 violations (`isRtl` ternaries)
- Most already have matching `team.students.*` keys in locale files
- Lines 113, 121: Toast error messages (`"Please enter all three name parts"`, `"Invalid email address"`)
- Line 151: Success toast `"Account created successfully"`
- Line 228–246: Credentials display labels (`"Email"`, `"Temporary Password"`)
- Lines 284–317: Form field labels in create dialog (`"Full Three-Part Name"`, `"First Name"`, `"Father's Name"`, `"Family Name"`)
- Line 334: `"Email Address"` label
- Lines 349–351: Creating button states

**New keys needed:**
```
team.students.namePartsRequired, team.students.invalidEmail, team.students.createdSuccess,
team.students.fatherName, team.students.fullThreePart, team.students.emailAddress,
team.students.creating
```

#### 7. `CaseDetailPage.tsx` — ~30 violations (all English-only)
Page doesn't import `useTranslation` at the module scope in a way that reaches JSX. Everything is hardcoded English:
- Line 145–153: Pipeline labels in `PIPELINE_LABELS` constant
- Line 196: `"Admin Notes"` card title
- Lines 460–461: Loading/not found states
- Lines 484: Pipeline stage labels
- Lines 502–681: All `renderNextAction()` text (Mark as Contacted, Schedule an Appointment, etc.)
- Lines 712, 716–718, 727: Badge labels (`"Account Active"`, `"Delete Case"`)
- Lines 737–738: Card title `"Application Info"`
- Lines 751–804: Field labels (City, Passport, Education Level, English Units, Math Units, etc.)
- Line 804: `"No application data recorded."`
- Lines 816–817: `"Student Profile"` card title
- Lines 826–851: Resolved names labels (Program, School, Accommodation, Insurance)
- Lines 876–935: Financial Summary — all labels (Program, Accommodation, Service Fee, Total, etc.)
- Lines 942–944: `"Next Action"` card title
- Lines 952–953: `"Appointments"` card + `"+ Add"` button
- Lines 963: `"No appointments yet"`
- Lines 982–983: Appointment outcome badge `"Pending"`
- Lines 999–1007: `"Reschedule"` and `"Outcome"` buttons
- Lines 1032: `"Course & Program"` card title
- Lines 1038–1084: Field labels (Program, School, Accommodation, Start Date, End Date, etc.)
- Lines 1074–1076: `"Payment"` / `"✅ Confirmed"` / `"⏳ Pending"`
- Lines 1095: `"Documents"` count card title
- Line 1110: `"Download"` button label
- Lines 1144–1174: Submit confirm dialog — all text
- Lines 1183–1199: Delete case dialog — all text
- Lines 1207–1222: Delete appointment dialog — all text

Most fields already have matching `case.fields.*` and `lawyer.*` keys. The `PIPELINE_LABELS` object needs to use `case.status.*` keys.

**New keys needed (case detail section):**
```
case.detail.adminNotes, case.detail.loading, case.detail.notFound,
case.detail.accountActive, case.detail.appInfo, case.detail.noAppData,
case.detail.studentProfile, case.detail.financialSummary, case.detail.nextAction,
case.detail.appointments, case.detail.addAppointment, case.detail.noAppointments,
case.detail.pendingOutcome, case.detail.reschedule, case.detail.outcome,
case.detail.courseProgram, case.detail.startDate, case.detail.endDate,
case.detail.program, case.detail.school, case.detail.accommodation, case.detail.insurance,
case.detail.payment, case.detail.paymentConfirmed, case.detail.paymentPending,
case.detail.submitted, case.detail.submittedAt, case.detail.documents,
case.detail.download,
case.detail.markContacted, case.detail.markContactedDesc,
case.detail.scheduleAppt, case.detail.scheduleApptDesc,
case.detail.allOutcomesRecorded, case.detail.proceedToProfile,
case.detail.completeProfile, case.detail.profileComplete, case.detail.confirmPayment,
case.detail.paymentConfirmedReview, case.detail.submitToAdmin,
case.detail.submittedToAdmin, case.detail.waitingAdminReview,
case.detail.studentEnrolled, case.detail.caseComplete,
case.detail.forgottenCase, case.detail.reactivate,
case.detail.deleteCase, case.detail.deleteCaseDesc,
case.detail.submitCaseTitle, case.detail.submitCaseDesc, case.detail.submitWarning,
case.detail.confirmSubmit, case.detail.deleteApptTitle, case.detail.deleteApptDesc,
case.detail.programCost, case.detail.serviceFee, case.detail.translationFee,
case.detail.total, case.detail.amountPaid, case.detail.remaining, case.detail.paymentStatus,
case.detail.deleteCase, case.detail.cancel, case.detail.deleting
```

#### 8. `PartnerOverviewPage.tsx` — ~20 violations (all `isAr` ternaries)
- Lines 104–133: All KPI card labels (`isAr ? "إجمالي التسجيلات" : "Total Applications"`, etc.)
- Lines 141–148: Welcome heading and subtitle
- Lines 154–163: Earnings banner text
- Lines 189: `"Case List"` card title
- Lines 207–219: Table headers
- Lines 247: `"(متوقع)"` / `"(proj.)"` projection label
- Lines 252: `"في الانتظار"` / `"Pending"` status

Most have existing `partner.*` keys. Some need new ones.

**New keys needed:**
```
partner.totalApplications, partner.paidCases, partner.enrolled,
partner.totalPaidOut, partner.projectedEarnings, partner.perCaseComm,
partner.partnerDashboard, partner.caseList,
partner.col.name, partner.col.major, partner.col.status,
partner.col.commission, partner.col.date, partner.noCases,
partner.projMultiplier, partner.paidOut, partner.projLabel, partner.pending,
```

#### 9. `PartnerStudentsPage.tsx` — ~10 violations (all `isAr` ternaries)
- Line 90: `isAr ? "الطلاب المسجلون" : "Registered Students"`
- Line 99: search placeholder
- Line 112: `"All"` filter
- Line 129: empty state
- Lines 136–138: Table headers
- Line 163: privacy note

---

### Implementation Plan

**Phase 1 — Locale file additions:** Add all new `admin.pipeline.*`, `admin.spreadsheet.*`, `admin.settings.*`, `case.detail.*`, `partner.*`, and `team.students.*` keys to both `en/dashboard.json` and `ar/dashboard.json`.

**Phase 2 — Replace ternaries in 9 pages:** For each file, add/verify `const { t } = useTranslation('dashboard')` is imported and used, then replace every `isRtl ?` / `isAr ?` string with `t('key', 'fallback')`. For fully English-only strings (spreadsheet, case detail), same replacement.

### Files to change
```
public/locales/en/dashboard.json  — add ~120 new keys
public/locales/ar/dashboard.json  — add ~120 matching Arabic keys
src/pages/admin/AdminCommandCenter.tsx     — 2 fixes
src/pages/admin/AdminPipelinePage.tsx      — ~35 fixes
src/pages/admin/AdminSettingsPage.tsx      — ~40 fixes
src/pages/admin/AdminStudentsPage.tsx      — ~25 fixes
src/pages/admin/AdminSpreadsheetPage.tsx   — ~15 fixes (add t() import first)
src/pages/team/TeamStudentsPage.tsx        — ~15 fixes
src/pages/team/CaseDetailPage.tsx          — ~30 fixes (add t() import first)
src/pages/partner/PartnerOverviewPage.tsx  — ~20 fixes
src/pages/partner/PartnerStudentsPage.tsx  — ~10 fixes
```

**Total: ~210 string replacements, ~120 new locale keys added to both files.**

No logic changes, no data changes, no behavioral changes — only text extraction.
