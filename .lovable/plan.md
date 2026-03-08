
## Deep Scan Results — Missing Translations & Number Formatting

### Problem 1: Numbers showing "." instead of "0" in Arabic
**Root cause:** Multiple files use `.toLocaleString()` with no locale argument, or `toLocaleString('ar-EG')`, which produces Arabic-Indic numerals (٠١٢) on Arabic locale devices. Per the `memory/design/localization/numeric-safety-v1` rule, ALL numbers must use `'en-US'` locale.

**Files with bad number formatting:**
- `AdminFinancialsPage.tsx` line 63: `const fmt = (n) => n.toLocaleString(isRtl ? 'ar-EG' : 'en-US')` → always use `'en-US'`
- `AdminFinancialsPage.tsx` lines 108, 110, 111: `.toLocaleString()` with no locale
- `AdminAnalyticsPage.tsx` — no number formatting issue, numbers are counts
- `MoneyDashboard.tsx` lines 247, 257, 267, 276, 285, 294, 317, 389, 429, 438: all `.toLocaleString()` with no locale
- `InfluencerPayoutsTab.tsx` line 44: `fmtCurrency` already uses `'en-US'` ✅ — but line 355, 415: `.toLocaleDateString()` with no locale
- `AdminSubmissionsPage.tsx` lines 324, 328: `.toLocaleString()` with no locale

**Fix:** Change all `.toLocaleString()` → `.toLocaleString('en-US')` and all `.toLocaleDateString()` → `.toLocaleDateString('en-US')` throughout these files.

---

### Problem 2: `AdminProgramsPage.tsx` — Zero translations (entire file English-only)
**File uses:** `const { i18n } = useTranslation("dashboard")` — has hook but NEVER calls `t()`. Over 80 hardcoded English strings throughout.

**Missing keys needed (new namespace `admin.programs`):**
```
title, tabPrograms, tabSchools, tabAccommodations, tabInsurance,
addProgram, editProgram, addSchool, editSchool, addAccommodation, editAccommodation,
addInsurance, editInsurance,
labelNameEn, labelNameAr, labelType, labelPrice, labelCurrency, labelDuration,
labelLessonsWeek, labelDurationMonths, labelFixedStartDay, labelDescription,
labelCity, labelCountry, labelTier, labelLinkedSchool, labelPriceMonth,
btnSave, btnSaving, btnEdit, btnPause, btnActivate, btnDelete,
statusActive, statusInactive,
noPrograms, noSchools, noAccommodations, noInsurance,
nameRequired, programCreated, programUpdated, schoolCreated, schoolUpdated,
accomCreated, accomUpdated, insCreated, insUpdated,
loading, accommodationsLinked,
tierBasic, tierStandard, tierPremium,
typeLanguageSchool, typeCourse, typeUniversity, typeOther
```

---

### Problem 3: `AdminFinancialsPage.tsx` — isRtl ternaries + number bug
**Missing keys needed (`admin.financials`):**
```
title, partnerCommissionRateInfo,
kpiTotalRevenue, kpiServiceFees, kpiTranslationFees,
kpiPartnerCommission, kpiEnrolledStudents, kpiReferralDiscounts,
recentEnrolled, noData
```
Also fix: `fmt` function uses `'ar-EG'` which causes Arabic-Indic digits. Change to always use `'en-US'`. Also fix `toLocaleDateString('ar-EG')` on line 108.

---

### Problem 4: `AdminAnalyticsPage.tsx` — isRtl ternaries throughout
**Missing keys needed (`admin.analytics`):**
```
title, kpiTotalCases, kpiActive, kpiEnrolled, kpiConversion,
conversionFunnel, sourceBreakdown, noData, avgDaysPerStage,
tooltipCases, tooltipDays,
statusNew, statusContacted, statusAppointment, statusProfile,
statusPayment, statusSubmitted, statusEnrolled, statusForgotten, statusCancelled,
sourceApplyPage, sourceManual, sourceDirect, sourcePartner
```

---

### Problem 5: `CommissionSettingsPanel.tsx` — Zero translations
**No `useTranslation` import at all.** Entire component in English.

**Missing keys needed (`admin.commission`):**
```
globalRates, partnerCommission, teamMemberCommission,
partnerCommissionDesc, teamMemberCommissionDesc,
exampleCalc, partner, teamMember, platformRevenue,
partnerDashboardVisibility, showAllCasesToPartners, showAllCasesDesc,
saveCommissionSettings, saving,
partnerOverrides, partnerOverridesTitle, teamOverridesTitle,
addUpdateOverride, selectPartner, selectTeamMember,
amountPlaceholder, notesOptional,
savePartnerOverride, saveTeamOverride,
caseVisibilityLabel, visGlobalDefault, visGlobalDefaultDesc,
visAllCases, visAllCasesDesc, visApplyOnly, visApplyOnlyDesc
```

---

### Problem 6: `AdminActivityPage.tsx` — 3 isRtl ternaries
- Line 97: `isRtl ? 'جار التحميل...' : 'Loading...'` → `t('common.loading')`
- Line 99: `isRtl ? 'لا يوجد نشاط' : 'No activity found'` → `t('admin.activity.noActivity')`  
- Line 123: `isRtl ? 'تحميل المزيد' : 'Load more'` → `t('common.loadMore')`

**New keys:** `admin.activity.noActivity`, `common.loadMore`

---

### Problem 7: `AdminTeamPage.tsx` — 7 isRtl ternaries
- Line 70: all fields required toast
- Line 89: account created toast
- Line 104-108: `roleLabel` function uses `isRtl` ternary per role
- Line 134: account created message
- Lines 164-165: SelectItem labels for roles
- Line 170-171: creating button states
- Line 183: loading state

**New keys:** `admin.team.teamMemberRole`, `admin.team.partnerRole`, `admin.team.creating`, `admin.team.loading`, `admin.team.allFieldsRequired`, `admin.team.credentialsHint`

---

### Problem 8: `AdminSubmissionsPage.tsx` — ~20 isRtl ternaries
- Lines 155, 190, 228, 245, 252, 276–294, 300, 319–345, 360, 369, 412, 448, 453-456, 476, 481-483, 486, 505, 508

**New keys (`admin.submissions`):**
```
basicInfo, phone, city, education, passport, submittedDate, payment,
paymentConfirmed, paymentPending, paymentDetails, serviceFee, translationFee,
startDate, endDate, total, programAccom, program, accommodation,
studentProfileData, documents, openFullCase, markEnrolled, processing,
confirmIdentity, confirmIdentityDesc, password, cancel, confirmEnroll,
totalFees, submittedLabel, incorrectPassword
```

---

### Implementation Plan

**Phase 1 — Locale files** — Add ~130 new keys to both `en/dashboard.json` and `ar/dashboard.json`:
- New namespaces: `admin.programs`, `admin.financials`, `admin.analytics`, `admin.commission`, `admin.submissions`
- New keys in existing namespaces: `admin.team.*`, `admin.activity.noActivity`, `common.loadMore`

**Phase 2 — Fix number formatting globally** — In ALL files, replace `.toLocaleString()` (no arg) with `.toLocaleString('en-US')` and `.toLocaleDateString()` (no arg) with `.toLocaleDateString('en-US')`. Change `'ar-EG'` occurrences to `'en-US'` in `AdminFinancialsPage.tsx`.

**Phase 3 — Fix `AdminProgramsPage.tsx`** — Add `t` to the hook, replace all ~80 hardcoded strings with `t('admin.programs.*')` keys. Keep form labels always in English as these are admin-only technical fields where bilingual labels help (Arabic Name / English Name are field labels, not UI text). Tab labels and buttons get translated.

**Phase 4 — Fix `AdminFinancialsPage.tsx`** — Replace 8 `isRtl` ternaries with `t('admin.financials.*')` calls. Fix `fmt()` to always use `'en-US'`.

**Phase 5 — Fix `AdminAnalyticsPage.tsx`** — Replace ~20 `isRtl` ternaries with `t('admin.analytics.*')` calls.

**Phase 6 — Fix `CommissionSettingsPanel.tsx`** — Add `useTranslation` import and hook, replace all ~30 hardcoded English strings.

**Phase 7 — Fix `AdminActivityPage.tsx`** — Replace 3 remaining ternaries.

**Phase 8 — Fix `AdminTeamPage.tsx`** — Replace 7 ternaries.

**Phase 9 — Fix `AdminSubmissionsPage.tsx`** — Replace ~20 ternaries.

### Files to change:
```
public/locales/en/dashboard.json   — add ~130 new keys
public/locales/ar/dashboard.json   — add ~130 matching Arabic keys
src/pages/admin/AdminProgramsPage.tsx      — add t(), ~80 replacements
src/pages/admin/AdminFinancialsPage.tsx    — fix numbers + ~8 ternaries
src/pages/admin/AdminAnalyticsPage.tsx     — replace ~20 ternaries
src/pages/admin/AdminActivityPage.tsx      — replace 3 ternaries
src/pages/admin/AdminTeamPage.tsx          — replace 7 ternaries
src/pages/admin/AdminSubmissionsPage.tsx   — replace ~20 ternaries
src/components/admin/CommissionSettingsPanel.tsx — add useTranslation, ~30 replacements
src/components/admin/MoneyDashboard.tsx    — fix .toLocaleString() → 'en-US' everywhere
src/components/admin/InfluencerPayoutsTab.tsx — fix .toLocaleDateString() locale
```

**AdminSpreadsheetPage.tsx stays English-only (as requested by user).**  
**No logic changes. No data changes. No behavior changes. Translations + number formatting only.**
