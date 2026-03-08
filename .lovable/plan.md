
## Full Translation Rescan — What's Left

### Current State

After the previous sprint, the locale files already contain ALL needed keys (both `en` and `ar`). The `admin.students.*`, `admin.settings.*`, `admin.spreadsheet.*`, `admin.pipeline.*`, `case.detail.*`, `team.students.*`, and `partner.*` namespaces are complete in both files.

The problem is: **the page files still use `isRtl ? "AR" : "EN"` ternaries instead of `t()` calls**, even though the corresponding keys already exist in the locale files.

### Files That Still Need `isRtl`/`isAr` Replaced with `t()`

**1. `AdminStudentsPage.tsx` (~25 ternaries)**
- Line 234: `{ i18n }` — needs `t` added: `const { t, i18n } = useTranslation("dashboard")`
- Line 648: `isRtl ? "إدارة الطلاب" : "Student Management"` → `t('admin.students.title')`
- Line 656: `isRtl ? "تحديث" : "Refresh"` → `t('common.refresh')`
- Line 665: `isRtl ? "بحث بالاسم..." : "Search..."` → `t('admin.students.searchPlaceholder')`
- Lines 675–679: table headers → `t('admin.students.col.*')` (these keys don't exist yet — need adding)
- Lines 693–719: loading/empty/self-registered → `t('common.loading')`, `t('admin.students.noStudents')`, `t('admin.students.selfRegistered')`
- Lines 764–900: all detail sheet field labels — `t('admin.students.fieldEmail')` etc
- Line 917: `"Admin Actions"` → `t('admin.students.adminActions')`
- Line 927: `"Reset Password"` → `t('admin.students.resetPassword')`
- Line 939: `"Selective Delete"` → `t('admin.students.selectiveDelete')`
- Lines 949–1003: doc upload section
- Lines 1013, 1092, 1102: section headers
- Lines 100–225 in `SelectiveDeleteDialog` sub-component — all use `isRtl` but the component doesn't call `useTranslation`. Need to either pass `t` as prop or add hook inside component.
- Lines 1188–1281: reset dialogs

**2. `AdminSpreadsheetPage.tsx` (15 hardcoded strings, no `t()` at all)**
- Missing `useTranslation` import and hook call
- All column labels in `ALL_COLUMNS` array hardcoded — need to move to `useMemo(() => [...], [t])` pattern
- Page title, buttons, filter labels, empty states, dialog labels — all need `t()`

**3. `CaseDetailPage.tsx` (~30 hardcoded strings)**
- `{ i18n }` exists; needs `t` destructured: `const { t, i18n } = useTranslation("dashboard")`
- `PIPELINE_LABELS` constant on line 145–153 — hardcoded English; needs to become a computed object using `t('case.status.*')`
- Line 460: `"Loading..."` → `t('case.detail.loading')`
- Line 461: `"Case not found"` → `t('case.detail.notFound')`
- Line 484: `{PIPELINE_LABELS[stage]}` → `{t(\`case.status.${stage}\`, stage)}`
- Line 502–680: all `renderNextAction()` strings → `t('case.detail.*')` keys (all exist)
- Line 716: `"Account Active"` → `t('case.detail.accountActive')`
- Line 727: `"Delete Case"` → `t('case.detail.deleteCase')`
- Line 738: `"Application Info"` → `t('case.detail.appInfo')`
- Lines 753–800: field labels → `t('case.fields.*')`
- Line 804: `"No application data recorded."` → `t('case.detail.noAppData')`
- Line 817: `"Student Profile"` → `t('case.detail.studentProfile')`
- Lines 826–850: resolved names labels → `t('case.detail.program')` etc
- Lines 878–934: financial summary labels → `t('case.detail.*')` keys
- Line 942: `"Next Action"` → `t('case.detail.nextAction')`
- Line 953: `"Appointments"` / `"+ Add"` → `t('case.detail.appointments')` / `t('case.detail.addAppointment')`
- Line 963: `"No appointments yet"` → `t('case.detail.noAppointments')`
- Line 983: `"Pending"` → `t('case.detail.pendingOutcome')`
- Lines 999, 1007: `"Reschedule"` / `"Outcome"` → `t('case.detail.reschedule')` / `t('case.detail.outcome')`
- Line 1032: `"Course & Program"` → `t('case.detail.courseProgram')`
- Lines 1038–1077: field labels → `t('case.detail.*')` keys
- Line 1095: `"Documents"` → `t('case.detail.documents')`
- Line 1110: `"Download"` → `t('case.detail.download')`
- Lines 1145–1172: submit dialog → `t('case.detail.submitCaseTitle')` etc
- Lines 1184–1197: delete case dialog → `t('case.detail.deleteCase')` etc
- Lines 1207–1221: delete appointment dialog → `t('case.detail.deleteApptTitle')` etc

**4. `TeamStudentsPage.tsx` (~8 remaining ternaries)**
- Lines 113, 121: toast errors → `t('team.students.namePartsRequired')`, `t('team.students.invalidEmail')` — keys exist
- Line 151: `"Account created successfully"` → `t('team.students.createdSuccess')` — key exists
- Lines 219–222: success message ternary → `t('team.students.createdFor', {name})` — key exists
- Lines 228–229: `"Email"` / `"Temporary Password"` labels → `t('team.students.tempEmail')` / `t('team.students.tempPassword')` — keys exist
- Lines 264–267: change password hint ternary → `t('team.students.changePasswordHint')` — key exists
- Line 286: `"Full Three-Part Name"` → `t('team.students.fullThreePart')` — key exists
- Lines 290, 301, 311: name part labels → `t('team.students.firstName')`, `t('team.students.fatherName')`, `t('team.students.familyName')` — keys exist
- Line 334: `"Email Address"` → `t('team.students.emailAddress')` — key exists
- Lines 349–350: creating state → `t('team.students.creating')` — key exists
- Lines 368: search placeholder → `t('team.students.searchPlaceholder')` — key exists
- Lines 377: `"Loading…"` → `t('team.students.loading')` — key exists
- Lines 383–386: no results → `t('team.students.noResults')` — key exists
- Line 188: refresh title attr → `t('common.refresh')` — key exists

**5. `PartnerOverviewPage.tsx` (~20 `isAr` ternaries)**
- Lines 104–133: KPI labels → `t('partner.totalApplications')`, `t('partner.paidCases')`, etc — all keys exist
- Lines 141–142: Welcome heading → `t('partner.welcomeGreeting')` + name — key exists
- Lines 145–148: subtitle → `t('partner.partnerDashboard')` — key exists
- Lines 154–163: earnings banner → `t('partner.projectedEarnings')`, `t('partner.projMultiplier', {paid, rate})`, `t('partner.paidOut', {amount})` — keys exist
- Line 189: `"Case List"` → `t('partner.caseList')` — key exists
- Lines 207–219: table headers → `t('partner.col.name')`, `t('partner.col.major')`, etc — keys exist
- Line 199: `"No cases yet"` → `t('partner.noCases')` — key exists
- Line 247: `"(متوقع)"/"(proj.)"` → `t('partner.projLabel')` — key exists
- Line 252: `"في الانتظار"/"Pending"` → `t('partner.pending')` — key exists

**6. `PartnerStudentsPage.tsx` (~10 `isAr` ternaries)**
- Line 90: `"الطلاب المسجلون"/"Registered Students"` → `t('partner.registeredStudents')` — key exists
- Line 99: search placeholder → `t('partner.searchByFirstName')` — key exists
- Line 112: `"الكل"/"All"` → `t('partner.all')` — key exists
- Line 129: `"لا يوجد..."/"No matching students"` → `t('partner.noMatchingStudents')` — key exists
- Lines 136–138: table headers → `t('partner.colName')`, `t('partner.colDate')`, `t('partner.colStage')` — keys exist
- Lines 161–163: privacy note → `t('partner.privacyNote')` — key exists

**7. `PartnerEarningsPage.tsx` (~15 `isAr` ternaries) — missed in plan, scanned now**
- Line 92: `"أرباحي"/"My Earnings"` → `t('partner.earningsTitle')` — key exists
- Line 99–102: commission rate info → `t('partner.commission.rateInfo', {rate})` — key exists
- Line 111: `"الإجمالي"/"Total"` → new key `partner.earnings.total` (currently `partner.earnings.totalEarned`)
- Line 123: `"معلق"/"Pending"` → `t('partner.earnings.pending')` → currently `"In Pipeline"` — need new key `partner.earnings.pendingLabel`
- Line 135: `"مؤكد"/"Confirmed"` → new key `partner.earnings.confirmedLabel`
- Line 148: `"تفاصيل الأرباح"/"Earnings Breakdown"` → `t('partner.earnings.breakdown')` — key exists
- Lines 158–162: table headers → need `partner.earnings.*` keys
- Line 153: `"لا يوجد طلاب..."` → `t('partner.earnings.noQualifying')` — key exists
- Lines 159–163: column headers → need new keys `partner.earnings.colStudent`, `partner.earnings.colPaymentStatus`, `partner.earnings.colStage`, `partner.earnings.colCommission`
- Line 195: pipeline section title → `t('partner.earnings.pending')` — close but not exact
- Line 211–214: privacy note → `t('partner.privacyNote')` — key exists

### New locale keys needed (small set — most already exist)

**In both `en/dashboard.json` and `ar/dashboard.json`, add under `admin.students`:**
```json
"studentInfo": "Student Information",
"selfRegistered": "Self-registered",
"adminActions": "Admin Actions",
"selectiveDelete": "Selective Delete",
"uploadNewDocument": "Upload New Document",
"docCategory": "Category",
"docName": "Document Name",
"docNamePlaceholder": "e.g. Birth Certificate",
"chooseFile": "Choose file to upload",
"uploading": "Uploading...",
"referrals": "Referrals",
"edit": "Edit",
"fieldEmail": "Email",
"fieldPhone": "Phone",
"fieldCity": "City of Birth",
"fieldEmergency": "Emergency Contact",
"fieldArrival": "Arrival Date",
"fieldGender": "Gender",
"fieldDob": "Date of Birth",
"fieldNationality": "Nationality",
"fieldAddress": "Home Address",
"fieldUniversity": "University",
"fieldIntake": "Intake Month",
"fieldLastUpdated": "Last Updated by Student",
"fieldCreated": "Created",
"fieldCreatedBy": "Created By",
"resetPasswordConfirm": "Reset password for {{name}}?",
"resetTitle": "Reset Password",
"newCredentials": "New Login Credentials",
"credentialsWarning": "Share these credentials with the student immediately. They won't be shown again.",
"copyCredentials": "Copy Credentials",
"copied": "Copied!",
"softDeleteLabel": "Soft Delete",
"hardDeleteLabel": "Hard Delete",
"selectiveDeleteTitle": "Selective Delete",
"cancel": "Cancel",
"delete": "Delete",
"deleting": "Deleting..."
```

**Under `partner.earnings`:**
```json
"total": "Total",
"pendingLabel": "Pending",
"confirmedLabel": "Confirmed",
"colStudent": "Student",
"colPaymentStatus": "Payment Status",
"colStage": "Stage",
"colCommission": "Commission",
"inPipeline": "In Pipeline (not yet earning)"
```

### Implementation Plan

**Phase 1 — Add missing locale keys** (~30 new keys in both `en` and `ar`)
- Add to `admin.students` section: studentInfo, selfRegistered, adminActions, selectiveDelete, field labels, upload labels, dialog labels
- Add to `partner.earnings` section: total, pendingLabel, confirmedLabel, column headers, inPipeline

**Phase 2 — Fix `AdminStudentsPage.tsx`**
- Change `const { i18n }` → `const { t, i18n }` at line 234
- Replace all `isRtl ? "AR" : "EN"` patterns with `t()` calls (both in main component AND in `SelectiveDeleteDialog` subcomponent — pass `t` as prop or add hook inside subcomponent)

**Phase 3 — Fix `AdminSpreadsheetPage.tsx`**
- Add `useTranslation` import and hook
- Move `ALL_COLUMNS` labels inside component as `useMemo` using `t()` for each label
- Replace all hardcoded page strings with `t('admin.spreadsheet.*')`

**Phase 4 — Fix `CaseDetailPage.tsx`**
- Change `const { i18n }` → `const { t, i18n }`
- Move `PIPELINE_LABELS` inside component as computed object using `t('case.status.*')`
- Replace ~30 hardcoded strings with `t()` calls

**Phase 5 — Finish `TeamStudentsPage.tsx`**
- Replace remaining 14 `isRtl` ternaries with `t()` calls using existing keys

**Phase 6 — Fix `PartnerOverviewPage.tsx`**
- Replace all ~20 `isAr` ternaries with `t()` calls

**Phase 7 — Fix `PartnerStudentsPage.tsx`**
- Replace all ~10 `isAr` ternaries with `t()` calls

**Phase 8 — Fix `PartnerEarningsPage.tsx`**
- Replace all ~15 `isAr` ternaries with `t()` calls

### Files to change
```
public/locales/en/dashboard.json  — add ~30 new keys
public/locales/ar/dashboard.json  — add ~30 matching Arabic keys
src/pages/admin/AdminStudentsPage.tsx    — add t, replace ~25 ternaries
src/pages/admin/AdminSpreadsheetPage.tsx — add useTranslation, replace ~15 strings
src/pages/team/CaseDetailPage.tsx        — add t, replace ~30 strings
src/pages/team/TeamStudentsPage.tsx      — replace ~14 remaining ternaries
src/pages/partner/PartnerOverviewPage.tsx  — replace ~20 ternaries
src/pages/partner/PartnerStudentsPage.tsx  — replace ~10 ternaries
src/pages/partner/PartnerEarningsPage.tsx  — replace ~15 ternaries
```

**No logic changes. No data changes. Translations only.**
