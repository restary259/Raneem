
## Plan: Team Analytics Money KPI + Submit New Student Arabic Translation

### Change 1 — Money KPI in Team Analytics Page

**What:** Add a "My Commission" KPI card to `TeamAnalyticsPage.tsx` that shows the team member's `commission_amount` from `team_member_commission_overrides`, plus an "Earned This Month" figure that sums the `rewards` rows created for this team member this calendar month.

**Data sources:**
- `team_member_commission_overrides` → `commission_amount` for `team_member_id = user.id` (the per-case override, i.e. what they earn each time a case is paid)
- `rewards` table → sum of `amount` WHERE `user_id = user.id` AND `created_at >= start of month` (accrued commissions this month)

**New KPI cards to add (after existing 3):**
1. **Commission Per Case** — shows `commissionOverride` (e.g. ₪100). Label: `t('lawyer.analytics.commissionPerCase')`
2. **Earned This Month** — shows sum of rewards created this month. Label: `t('lawyer.analytics.earnedThisMonth')`

**i18n keys to add** to `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` inside `lawyer.analytics`:
```
"commissionPerCase": "Commission Per Case"  / "عمولة لكل ملف"
"earnedThisMonth": "Earned This Month"       / "مكتسب هذا الشهر"
```

**File:** `src/pages/team/TeamAnalyticsPage.tsx` — add 2 new state vars, add to `fetchData` Promise.all, add 2 KPI cards (using `DollarSign` icon, green color).

---

### Change 2 — Arabic Translation for SubmitNewStudentPage

**Current problem:** The page uses hardcoded English strings throughout all 4 steps. The `useTranslation("dashboard")` hook is already imported and `isAr` is set but only used in 2 places (title and program/accommodation names from DB).

**Approach:** Add a `submitStudent` namespace block in both locale JSON files, then replace every hardcoded label/placeholder/button text in the component with `t()` calls.

**New i18n key block** — `submitStudent` nested inside `lawyer` in dashboard.json (to avoid new namespace):

```json
"submitStudent": {
  "title": "Submit New Student",
  "stepStudentInfo": "Student Info",
  "stepContactDetails": "Contact Details",
  "stepProgram": "Program & Accommodation",
  "stepPayment": "Payment & Documents",
  "firstName": "First Name",
  "middleName": "Middle Name",
  "lastName": "Last Name",
  "dateOfBirth": "Date of Birth",
  "year": "Year",
  "month": "Month",
  "day": "Day",
  "ageYears": "Age: {{age}} years",
  "gender": "Gender",
  "genderMale": "Male",
  "genderFemale": "Female",
  "genderOther": "Other",
  "genderSelect": "Select",
  "cityOfBirth": "City of Birth",
  "email": "Email",
  "phone": "Phone",
  "emergencyName": "Emergency Contact Name",
  "emergencyPhone": "Emergency Contact Phone",
  "address": "Address",
  "street": "Street",
  "houseNo": "House No.",
  "postcode": "Postcode",
  "city": "City",
  "program": "Program",
  "selectProgram": "Select program",
  "lessonsPerWeek": "lessons/wk",
  "school": "School",
  "selectSchool": "Select school",
  "intakeMonth": "Intake Month",
  "selectIntakeMonth": "Select intake month",
  "arrivalDate": "Arrival Date",
  "courseStart": "Course Start",
  "courseEnd": "Course End",
  "autoCalc": "Auto-calculated",
  "accommodation": "Accommodation",
  "selectAccomFirst": "Select a school first",
  "noAccomForSchool": "No accommodations for this school",
  "selectAccom": "Select accommodation",
  "noAccom": "None",
  "serviceFee": "Service Fee (ILS)",
  "total": "Total",
  "confirmPayment": "I confirm full payment of {{amount}} ILS has been received.",
  "documents": "Documents",
  "documentsHint": "Upload documents now or skip — the student can upload later via their dashboard.",
  "docPassport": "Passport",
  "docBiometric": "Biometric Photo",
  "docTranslation": "Translations",
  "docOther": "Other Documents",
  "addFile": "Add file",
  "skipDocuments": "Skip — student will upload documents later",
  "next": "Next",
  "back": "Back",
  "submit": "Submit & Enroll",
  "submitting": "Submitting...",
  "successTitle": "Student submitted & enrolled",
  "errorRequired": "Please fill in the required fields.",
  "errorFirstName": "First name is required",
  "errorLastName": "Last name is required",
  "errorEmail": "Valid email is required",
  "errorPhone": "Phone number is required",
  "errorServiceFee": "Service fee is required",
  "errorPayment": "You must confirm payment was received"
}
```

Arabic equivalent added to `public/locales/ar/dashboard.json`.

**Component changes:** Replace every hardcoded English string in `SubmitNewStudentPage.tsx` with `t('lawyer.submitStudent.KEY')`. Also add `dir` attribute to the root container so RTL layout works.

---

### Files to Change

| File | Change |
|------|--------|
| `src/pages/team/TeamAnalyticsPage.tsx` | Fetch `team_member_commission_overrides` + `rewards` this month; add 2 KPI cards |
| `public/locales/en/dashboard.json` | Add `lawyer.analytics.commissionPerCase`, `earnedThisMonth`; add `lawyer.submitStudent.*` block |
| `public/locales/ar/dashboard.json` | Same keys in Arabic |
| `src/pages/team/SubmitNewStudentPage.tsx` | Replace all hardcoded English strings with `t()` calls; add `dir` to root div |

### No DB migration needed — reads existing `team_member_commission_overrides` and `rewards` tables.
