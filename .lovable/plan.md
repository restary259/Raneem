
## Complete Translation Audit — All Remaining Hardcoded Strings

### Summary of Findings

After a full scan of every component and page, here are all files with remaining visible hardcoded strings not going through `t()`:

---

### FILES TO FIX

**1. `AdminProgramsPage.tsx`** — Has `useTranslation("dashboard")` but destructures `{ i18n }` only, never `t`. All ~80 JSX strings are hardcoded English. Locale keys already exist under `admin.programs.*`.
- Badges: `"Active"` / `"Inactive"` → `t('admin.programs.statusActive')` / `t('admin.programs.statusInactive')`
- Toast messages: `"Program created"`, `"School updated"`, etc → `t('admin.programs.programCreated')` etc
- Button labels: `"Edit"`, `"Pause"`, `"Activate"`, `"Delete"` → `t('admin.programs.btnEdit')` etc
- Save/Saving buttons: `saving ? "Saving…" : "Save"` → `t('admin.programs.btnSaving')` / `t('admin.programs.btnSave')`
- Tab labels: `"Programs"`, `"Schools"`, `"Accommodations"`, `"Insurance"` → `t('admin.programs.tab*')`
- Add/Edit dialog titles → `t('admin.programs.addProgram')` etc
- Form labels: `"English Name *"`, `"Arabic Name"`, `"Type"`, `"Price"`, `"Currency"`, `"Duration (text)"`, `"Lessons/Week"`, `"Duration (months)"`, `"Fixed Start Day"`, `"Description"`, `"City"`, `"Country"`, `"Linked School"`, `"Price / month"`, `"Tier"`, `"Name *"` → `t('admin.programs.label*')`
- Empty states: `"No programs yet."`, `"No schools yet."`, `"No accommodations yet."`, `"No insurance plans yet."` → `t('admin.programs.no*')`
- Loading: `"Loading…"` → `t('admin.programs.loading')`
- Count suffix: `"accommodation(s) linked"` → `t('admin.programs.accommodationsLinked', {count})`
- `toast({ description: "Name is required" })` → `t('admin.programs.nameRequired')`
- Page title: `"Programs & Catalog"` → `t('admin.programs.title')`
- SelectValue placeholder: `"Select school"` → `t('admin.programs.selectSchoolPlaceholder')`
- Card badge `"Active"/"Inactive"` inline → use `t()`
- `"{count}mo"` duration suffix needs no translation (numeric+unit abbreviation)
- `"lessons/wk"` → new key needed: `admin.programs.lessonsWk`
- `"Starts day {n}"` → new key: `admin.programs.startsDay` with `{{day}}` interpolation

**2. `AdminPipelinePage.tsx`** — 1 remaining `isRtl` ternary + several hardcoded strings:
- Line 621: `{isRtl ? "خصم" : "Discount"}` → `t('admin.pipeline.discount')`
- Line 467: `<p className="text-xs text-muted-foreground">Empty</p>` → `t('admin.pipeline.emptyColumn')`
- Line 531: `"Unassigned"` badge text → `t('admin.pipeline.unassigned')`
- Line 557: `placeholder="Assign"` → `t('admin.pipeline.assignPlaceholder')`
- Line 561: `"Unassigned"` select item → `t('admin.pipeline.unassigned')`
- Line 541: `"Has info"` → new key `admin.pipeline.hasInfo`
- Line 605: `STATUS_LABELS[selectedCase.status]?.en` — uses `.en` hardcode in sheet header → should be `label(selectedCase.status)` (already uses `label()` for Kanban, just needs same for sheet badge)
- Line 636: `"Edit Info"` button → `t('admin.pipeline.editInfo')`
- Line 653: `saving ? "Saving…" : "Save"` → use existing `t('admin.pipeline.saving')` / `t('admin.pipeline.btnSave')` — need to add `btnSave` key
- Line 663: `"Contact"` section → `t('admin.pipeline.contact')`
- Line 665: `"Phone / WhatsApp"` → `t('admin.pipeline.phoneWhatsapp')`
- Line 668: `"Submitted"` label → `t('admin.pipeline.submittedLabel')`
- Lines 680, 698, 758, 771: `"Identity"`, `"Education"`, `"Preferences"`, `"Notes"` section headers → `t('admin.pipeline.identity')` etc
- Lines 685: `"Passport Type"` → `t('admin.pipeline.passportType')`
- Line 703: `"Education Level"` → `t('admin.pipeline.educationLevel')`
- Lines 712, 722: `"English Units"`, `"Math Units"` → `t('admin.pipeline.englishUnits')`, `t('admin.pipeline.mathUnits')`
- Lines 751: `"English Proficiency"` → `t('admin.pipeline.englishProficiency')`
- Line 764: `"Preferred Major / Degree"` → `t('admin.pipeline.preferredMajor')`
- Line 785: `"No application info yet"` → `t('admin.pipeline.noAppInfoYet')`
- Line 787: `"Click Edit Info above..."` → `t('admin.pipeline.editInfoHint')`
- Line 797: `"Edit Application Info"` → `t('admin.pipeline.editAppInfo')`
- Lines 804, 817, 835, 863, 880, 902, 921, 933: form field labels → same keys as view mode
- Line 809: `placeholder="e.g. Haifa"` → no translation needed (placeholder content)
- Line 945: `saving ? "Saving…" : "Save Changes"` → `t('admin.pipeline.saving')` / `t('admin.pipeline.saveChanges')`
- Line 955: `"Delete This Case"` → `t('admin.pipeline.deleteCase')`
- Line 965: `"Assign to Team Member"` → `t('admin.pipeline.assignToTeam')`
- Line 974: `"Currently assigned to"` → `t('admin.pipeline.currentlyAssignedTo')`
- Line 989: `placeholder="Assign to team member"` → `t('admin.pipeline.assignToTeam')`
- Lines 993-994: `"Unassigned"` in select → `t('admin.pipeline.unassigned')`
- Line 1009: `"Assigning…"` → `t('admin.pipeline.assigningStatus')`
- Line 341: toast `"Info saved successfully ✓"` → `t('admin.pipeline.infoSaved')`
- Line 362: toast `"Case deleted"` → `t('admin.pipeline.caseDeleted')`
- Lines 431-435: filter select `"Filter by team member"`, `"All"`, `"Unassigned"` → `t('admin.pipeline.filterByTeam')`, `t('admin.pipeline.allTeam')`, `t('admin.pipeline.unassigned')`
- Lines 1023, 1025-1027: Delete dialog `"Delete Case"`, description → `t('admin.pipeline.deleteCase')`, `t('admin.pipeline.deleteCaseDesc', {name})`
- Line 1031: `"Cancel"` → `t('admin.pipeline.cancel')` (or reuse `t('common.cancel')`)
- Line 1037: `deleting ? "Deleting…" : "Yes, Delete Case"` → `t('admin.pipeline.deleting')`, `t('admin.pipeline.confirmDelete')`
- `"EN {units}"` / `"MA {units}"` — academic abbreviations, keep as-is (technical)
- sourceMeta labels: `"Apply"`, `"Form"`, `"Manual"`, `"Enroll"`, `"Referral"` — need keys

**3. `AdminSettingsPage.tsx`** — Several remaining `isRtl ? "AR" : "EN"` in the contact form labels:
- Lines 405-445: `isRtl ? "الاسم عربي" : "Arabic Name"` etc for all 7 form fields → `t('admin.settings.contactFormArabicName')` etc (keys already exist from previous sprint)
- Line 460: `isRtl ? "لا توجد جهات اتصال" : "No contacts yet"` → `t('admin.settings.noContacts')`
- Lines 466-468: `isRtl ? c.name_ar : c.name_en` — this is data display logic, not a UI string — acceptable to keep
- Line 450: `contactSaving ? "..." : t("common.save", "Save")` — `"..."` should be `t('admin.programs.btnSaving')` or a generic saving key

**4. `AdminStudentsPage.tsx`** — 1 remaining mixed ternary:
- Line 754: `{isRtl ? "معلومات الطالب" : t("admin.students.studentInfo")}` — has Arabic hardcoded, should simply be `t("admin.students.studentInfo")`

**5. `AdminCommandCenter.tsx`** — `formatTime` uses `'ar-EG'` locale for dates → per numeric safety rule must change to `'en-GB'` always:
- Line 143: `d.toLocaleString('ar-EG', ...)` → `d.toLocaleString('en-GB', ...)`

**6. `MoneyDashboard.tsx`** — 4 `.toLocaleString()` calls without `'en-US'`:
- Lines 267, 276, 285, 294, 317, 389, 429: `.toLocaleString()` → `.toLocaleString('en-US')`
- Line 438: `new Date(row.date).toLocaleDateString()` → `.toLocaleDateString('en-US')`
- Line 392: `new Date(row.date).toLocaleDateString()` → `.toLocaleDateString('en-US')`

**7. `InfluencerPayoutsTab.tsx`** — 2 remaining `.toLocaleDateString()` without locale:
- Line 355: `new Date(req.requested_at).toLocaleDateString()` → `.toLocaleDateString('en-US')`  
- Line 415: `new Date(r.created_at).toLocaleDateString()` → `.toLocaleDateString('en-US')`
- Line 355: `Number(req.amount).toLocaleString()` → `.toLocaleString('en-US')`
- Line 415: `Number(r.amount).toLocaleString()` → `.toLocaleString('en-US')`
- Line 327: `"{count} countdown"`, `"{count} ready"`, `"{count} overdue"` hardcoded inside DotBadge → need keys with count interpolation or keep as-is (they are numbers, acceptably bilingual)
- Line 574: `"${cd.daysRemaining}d"` and `"${Math.abs(cd.daysRemaining)}d overdue"` — technical/numeric, keep as-is

**8. `EarningsPanel.tsx`** (influencer component) — ~25 `isAr` ternaries throughout:
- `isAr ? 'يرجى إدخال اسم البنك' : 'Please enter bank name'` → `t('influencer.earnings.bankNameRequired')`
- `isAr ? 'رقم فرع غير صالح...' : 'Invalid branch number...'` → `t('influencer.earnings.invalidBranch')`
- `isAr ? 'رقم حساب غير صالح' : 'Invalid account number...'` → `t('influencer.earnings.invalidAccount')`
- `isAr ? 'رقم IBAN غير صالح' : 'Invalid IBAN...'` → `t('influencer.earnings.invalidIban')`
- `isAr ? 'تم حفظ بيانات البنك' : 'Bank details saved'` → `t('influencer.earnings.bankSaved')`
- `isAr ? 'المستخدم' : 'User'` (fallback name) → `t('influencer.earnings.defaultUserName')`
- `isAr ? 'تم إرسال الطلب!' : 'Request submitted!'` → `t('influencer.earnings.requestSubmitted')`
- `isAr ? 'أضف بيانات حسابك...' : 'Add your bank account details...'` → `t('influencer.earnings.bankBanner')`
- `isAr ? 'إضافة' : 'Add'` → `t('influencer.earnings.bankAdd')`
- `isAr ? 'جارٍ الإرسال...' : 'Sending...'` → `t('influencer.earnings.sending')`
- `isAr ? 'طلب سحب عبر واتساب' : 'Request Payout via WhatsApp'` → `t('influencer.earnings.requestPayoutWA')`
- `isAr ? 'تعديل بيانات البنك' : 'Edit bank details'` → `t('influencer.earnings.editBankDetails')`
- `isAr ? 'طلب قيد الانتظار' : 'Request pending'` → `t('influencer.earnings.requestPending')`
- `isAr ? 'تم استلام جميع العمولات' : 'All commissions received'` → `t('influencer.earnings.allReceived')`
- `isAr ? 'المكافآت قيد قفل 20 يوم' : '20-day lock active'` → `t('influencer.earnings.lockActive')`
- Bank modal title + all field labels → `t('influencer.earnings.bankModal*')` keys
- Footer cancel/save buttons → `t('influencer.earnings.cancel')`, `t('influencer.earnings.save')`
- `.toLocaleString()` without `'en-US'` on amounts → fix to `'en-US'`

**9. `DashboardLayout.tsx`** — 2 `isRtl` ternaries for visible text:
- `isRtl ? "الموقع الرئيسي" : "Main Site"` → `t('nav.mainSite')`
- `isRtl ? "العودة إلى الموقع الرئيسي" : "Back to Main Website"` → `t('nav.backToMainSite')`
- `{ i18n }` is used but `t` is not imported from `useTranslation("dashboard")` — needs `t` added

**10. `AppointmentOutcomeModal.tsx`** — ~12 `isAr` ternaries:
- Title: `isAr ? 'تسجيل نتيجة الموعد' : 'Record Appointment Outcome'` → `t('team.outcome.title')`
- Outcome labels and descriptions currently embedded in `OUTCOMES` array with `labelAr`/`descriptionAr` pattern → move labels/descriptions to locale
- `isAr ? 'التاريخ والوقت الجديد' : 'New Date & Time'` → `t('team.outcome.newDateTime')`
- `isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'` → `t('team.outcome.notes')`
- `isAr ? 'إلغاء' : 'Cancel'` → `t('common.cancel')`
- `isAr ? 'جار الحفظ...' : 'Saving...'` → `t('common.saving')`
- `isAr ? 'حفظ النتيجة' : 'Save Outcome'` → `t('team.outcome.saveOutcome')`
- `isAr ? 'تم تسجيل النتيجة' : 'Outcome recorded'` → `t('team.outcome.recorded')`
- `isAr ? 'يرجى تحديد تاريخ ووقت جديد' : 'Please provide a new date/time'` → `t('team.outcome.dateRequired')`

**11. `PaymentConfirmationForm.tsx`** — ~8 `isAr` ternaries:
- Description text → `t('team.payment.confirmDesc')`
- `'رسوم الخدمة (شيكل) *' : 'Service Fee (ILS) *'` → `t('team.payment.serviceFeeLabel')`
- `'رسوم الترجمة (شيكل)' : 'Translation Fee (ILS)'` → `t('team.payment.translationFeeLabel')`
- `'الإجمالي' : 'Total'` → `t('team.payment.total')`
- Checkbox label → `t('team.payment.confirmCheckbox', {amount})`
- Toast messages → `t('team.payment.confirmed')`, `t('team.payment.mustConfirm')`, `t('team.payment.feeRequired')`
- Saving button → `t('team.payment.confirming')`, `t('team.payment.confirmBtn')`

**12. `InAppBrowserBanner.tsx`** — 2 `isAr` ternaries, uses `useTranslation` but no `t`:
- `isAr ? 'للحصول على أفضل تجربة...' : 'For the best experience...'` → `t('common.inAppBannerText')` under `common.json`
- `isAr ? 'نسخ الرابط' : 'Copy link'` → `t('common.copyLink')`

**13. `PartnerEarningsPage.tsx`** — 3 remaining `isAr` ternaries (count label):
- Line 112, 124, 136: `{earningCases.length} {isAr ? "طالب" : "students"}` → `t('partner.earnings.studentCount', {count})` or `t('partner.studentsCount', {count: X})`
- Line 169: `new Date(c.created_at).toLocaleDateString(isAr ? "ar" : "en-GB")` → `.toLocaleDateString('en-GB')` always (per numeric safety rule)

**14. `PartnerOverviewPage.tsx`** — 1 remaining `isAr` date locale issue:
- Line 253: `new Date(c.created_at).toLocaleDateString(isAr ? "ar-SA" : "en-GB")` → `.toLocaleDateString('en-GB')` always

---

### NEW LOCALE KEYS NEEDED

**`public/locales/en/dashboard.json`** additions:

Under `admin.programs`:
```json
"lessonsWk": "lessons/wk",
"startsDay": "Starts day {{day}}"
```

Under `admin.pipeline`:
```json
"discount": "Discount",
"emptyColumn": "Empty",
"hasInfo": "Has info",
"btnSave": "Save",
"cancel": "Cancel",
"deleting": "Deleting…",
"confirmDelete": "Yes, Delete Case",
"identity": "Identity",
"education": "Education",
"preferences": "Preferences",
"notes": "Notes",
"sourceLabelApply": "Apply",
"sourceLabelForm": "Form",
"sourceLabelManual": "Manual",
"sourceLabelEnroll": "Enroll",
"sourceLabelReferral": "Referral"
```

Under `admin.settings`:
```json
"noContacts": "No contacts yet",
"contactFormArabicName": "Arabic Name",
"contactFormEnglishName": "English Name",
"contactFormRoleAr": "Role (Arabic)",
"contactFormRoleEn": "Role (English)",
"contactFormPhone": "Phone",
"contactFormEmail": "Email",
"contactFormLink": "Link",
"contactFormCategory": "Category",
"contactFormOrder": "Display Order"
```

Under `influencer.earnings` (in `dashboard.json`):
```json
"bankNameRequired": "Please enter bank name",
"invalidBranch": "Invalid branch number (2-4 digits)",
"invalidAccount": "Invalid account number (4-12 digits)",
"invalidIban": "Invalid IBAN — please check the number and try again",
"bankSaved": "Bank details saved",
"defaultUserName": "User",
"requestSubmitted": "Request submitted!",
"bankBanner": "Add your bank account details to speed up payment (optional)",
"bankAdd": "Add",
"sending": "Sending...",
"requestPayoutWA": "Request Payout via WhatsApp",
"editBankDetails": "Edit bank details",
"requestPending": "Request pending",
"allReceived": "All commissions received",
"lockActive": "20-day lock active",
"bankModalTitle": "Israeli Bank Account Details",
"bankName": "Bank Name",
"bankBranch": "Branch Number",
"bankAccount": "Account Number",
"bankIban": "IBAN (optional)",
"bankIbanHint": "Checksum will be validated automatically",
"bankCancel": "Cancel",
"bankSaveBtn": "Save"
```

Under `nav` (already in `dashboard.json` under nav keys):
```json
"mainSite": "Main Site",
"backToMainSite": "Back to Main Website"
```

Under `team.outcome`:
```json
"title": "Record Appointment Outcome",
"completed": "Completed",
"completedDesc": "Meeting happened — move to profile completion",
"delayed": "Delayed",
"delayedDesc": "Needs a new date — schedule another appointment",
"cancelled": "Cancelled",
"cancelledDesc": "Meeting cancelled — return to contacted",
"rescheduled": "Rescheduled",
"rescheduledDesc": "New date set — create replacement appointment",
"noShow": "No Show",
"noShowDesc": "Student did not appear — mark as forgotten",
"newDateTime": "New Date & Time",
"notes": "Notes (optional)",
"saveOutcome": "Save Outcome",
"recorded": "Outcome recorded",
"dateRequired": "Please provide a new date/time"
```

Under `team.payment`:
```json
"confirmDesc": "Enter service amounts and confirm payment has been received from the student.",
"serviceFeeLabel": "Service Fee (ILS) *",
"translationFeeLabel": "Translation Fee (ILS)",
"total": "Total",
"confirmCheckbox": "I confirm that payment of {{amount}} ILS has been received in full.",
"confirmed": "Payment confirmed",
"mustConfirm": "You must confirm payment was received",
"feeRequired": "Service fee must be greater than 0",
"confirming": "Saving...",
"confirmBtn": "Confirm Payment Received"
```

Under `common`:
```json
"saving": "Saving…",
"cancel": "Cancel",
"inAppBannerText": "For the best experience, open in Safari or Chrome",
"copyLink": "Copy link"
```

Under `partner.earnings`:
```json
"studentCount": "{{count}} students"
```

**`public/locales/ar/dashboard.json`** — matching Arabic for all the above keys.

---

### FILES TO CHANGE

```
public/locales/en/dashboard.json  — add ~60 new keys
public/locales/ar/dashboard.json  — add ~60 matching Arabic keys
src/pages/admin/AdminProgramsPage.tsx        — wire t(), replace ~80 strings
src/pages/admin/AdminPipelinePage.tsx        — fix 1 ternary + ~30 remaining strings
src/pages/admin/AdminSettingsPage.tsx        — fix 9 remaining ternaries in contact form
src/pages/admin/AdminStudentsPage.tsx        — fix 1 mixed ternary on line 754
src/pages/admin/AdminCommandCenter.tsx       — fix date locale 'ar-EG' → 'en-GB'
src/components/admin/MoneyDashboard.tsx      — fix .toLocaleString() without locale
src/components/admin/InfluencerPayoutsTab.tsx — fix .toLocaleString() / .toLocaleDateString()
src/components/influencer/EarningsPanel.tsx  — add t(), replace ~25 ternaries
src/components/layout/DashboardLayout.tsx    — add t, replace 2 ternaries
src/components/team/AppointmentOutcomeModal.tsx — add t, replace ~12 ternaries
src/components/team/PaymentConfirmationForm.tsx — add t, replace ~8 ternaries
src/components/common/InAppBrowserBanner.tsx — add t(), replace 2 ternaries
src/pages/partner/PartnerEarningsPage.tsx    — fix 3 remaining ternaries + date locale
src/pages/partner/PartnerOverviewPage.tsx    — fix date locale
```

**No logic, data, or behavior changes. Translations and number/date formatting only.**
