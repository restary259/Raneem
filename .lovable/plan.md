
## Problem

The `admin/students` page shows raw translation keys (e.g., `admin.students.managementTitle`, `admin.students.refresh`, `admin.students.noRegistered`, etc.) instead of Arabic text because the Arabic locale file (`public/locales/ar/dashboard.json`) is missing ~60 keys under `admin.students`.

The English locale (`en/dashboard.json`) has a full `team.students` block (lines 1086-1183) with all keys the page uses. The Arabic `admin.students` block (lines 613-644) only has a small subset.

## Root Cause

The `AdminStudentsPage.tsx` calls `t("admin.students.<key>")` for keys like:
- `managementTitle`, `refresh`, `noRegistered`
- `selfRegistered`, `studentInfo`, `edit`, `cancel`, `save`
- `adminActions`, `resetPassword`, `selectiveDelete`
- All field labels: `fieldEmail`, `fieldPhone`, `fieldCity`, `fieldEmergency`, `fieldArrival`, `fieldGender`, `fieldDob`, `fieldNationality`, `fieldAddress`, `fieldUniversity`, `fieldIntake`, `fieldLastUpdated`, `fieldCreated`, `fieldCreatedBy`, `fieldFullName`, `fieldPhoneNumber`
- All column headers: `colStudent`, `colEmail`, `colPhone`, `colCreated`, `colCreatedBy`
- All delete-related: `softDeleteLabel`, `softDeleteDesc`, `hardDeleteLabel`, `hardDeleteDesc`, `selectCategories`, `deleteMode`, `hardDeleteWarning`, `adminPassword`, `delete`, `deleting`, `catContactInfo`, `catDocuments`, `catCase`, `deleted`
- All document-related: `uploadNewDocument`, `docCategory`, `docName`, `docNamePlaceholder`, `chooseFile`, `uploading`, `referrals`, `visaInfo`, `noDocuments`, `fileUploaded`, `docDeleted`, `downloadTitle`, `deleteDocTitle`
- `changesSaved`, `visaSaved`, `resetTitle`, `resetBtn`, `newCredentials`, `credentialsWarning`, `copyCredentials`, `copied`, `selectiveDeleteTitle`

## Fix

**Single file change**: Add all missing keys to the `admin.students` block inside `public/locales/ar/dashboard.json` (expanding from 644 to include the ~60 missing keys with proper Arabic translations).

No code changes needed — only locale file update.
