
## Root Cause: English `admin.students` block is missing `managementTitle` and other keys used by `AdminStudentsPage`

### The Exact Problem

In `public/locales/en/dashboard.json`, there are **two separate `"students"` objects**:

1. **`admin.students`** (line 625) — lives inside `"admin"` → incomplete, missing `managementTitle`, `noRegistered`, all field labels (`fieldEmail`, `fieldPhone`, etc.), column headers (`colStudent`, etc.), reset password labels, and delete labels.

2. **`team.students`** (line 1105) — lives inside `"team"` → complete with ALL the keys that `AdminStudentsPage.tsx` needs.

`AdminStudentsPage.tsx` uses `t("admin.students.managementTitle")` etc., which resolves to `admin → students → managementTitle`. Since the `admin.students` EN block at line 625 **has no `managementTitle`**, i18next returns the key itself or falls back — and since the AR locale's `admin.students` block (line 626) **does have `managementTitle`**, React renders the Arabic value in both languages.

### Why Arabic Shows in Both Modes

i18next's `fallbackLng: 'ar'` means when an EN key is missing, it falls back to Arabic. So `t("admin.students.managementTitle")` in English → key not found in EN → fall back to AR → returns "إدارة الطلاب". Same for `noRegistered`, `searchPlaceholder`, all field/column labels.

### Fix: Merge the complete `team.students` keys into `admin.students` in the EN locale

The `admin.students` block in EN (lines 625–656) needs all the missing keys that are already present in `team.students` (lines 1105–1202). These include:

```
managementTitle, selfRegistered, noRegistered, studentInfo, edit, cancel, save,
adminActions, resetPassword, selectiveDelete, uploadNewDocument, docCategory,
docName, docNamePlaceholder, chooseFile, uploading, referrals, documents,
visaInfo, fieldEmail, fieldPhone, fieldCity, fieldEmergency, fieldArrival,
fieldGender, fieldDob, fieldNationality, fieldAddress, fieldUniversity,
fieldIntake, fieldLastUpdated, fieldCreated, fieldCreatedBy, fieldFullName,
fieldPhoneNumber, colStudent, colEmail, colPhone, colCreated, colCreatedBy,
resetPasswordConfirm, resetTitle, resetBtn, newCredentials, credentialsWarning,
copyCredentials, copied, softDeleteLabel, softDeleteDesc, hardDeleteLabel,
hardDeleteDesc, selectiveDeleteTitle, selectCategories, deleteMode,
hardDeleteWarning, adminPassword, delete, deleting, downloadTitle,
deleteDocTitle, noDocuments, deleted, visaSaved, changesSaved, fileUploaded,
docDeleted, catContactInfo, catDocuments, catCase, refresh
```

### Files to Change

| File | Change |
|---|---|
| `public/locales/en/dashboard.json` | Add ~40 missing keys to `admin.students` block (lines 625–656) |

**AR file already has all these keys** in `admin.students` (lines 626–739) — no change needed there.

### No code changes needed — purely a locale JSON fix.

The `admin.students` EN block at line 625 closes at line 656. We need to add all the missing keys before that closing `}`. The keys already exist in `team.students` (lines 1134–1202) with correct English values, so we just copy them into `admin.students`.
