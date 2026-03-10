
## Root Cause: Duplicate `"admin"` Root Keys in Both JSON Files

### The Core Bug
Both `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` have **two separate `"admin": { ... }` blocks** at the root level — one starting at line 245 (large, containing all admin sections) and another at line 1918 (small, containing only `referralsMgmt`, `payouts`, `partnerPayouts`, `financials`, `students.studentCount`).

JSON specification prohibits duplicate keys. Every JSON parser silently **discards the first block** and keeps only the last one. This means at runtime, `admin.commandCenter`, `admin.pipeline`, `admin.team`, `admin.programs`, `admin.submissions`, `admin.analytics`, `admin.activity`, `admin.settings`, `admin.spreadsheet`, and the `admin.students` full block are all thrown away. All those page sections show raw key strings.

### Additionally Missing Keys (Never Added to Either Block)
- `admin.leads.*` — used across 7 files (LeadsManagement, StudentCasesManagement, StudentProfilesManagement, MoneyDashboard, ReadyToApplyTable, AuditLog, StudentManagement): `all`, `searchPlaceholder`, `namePhoneRequired`, `added`, `deleted`, `updated`, `qualifiedAndCaseCreated`, `caseCreationError`, `markEligible`, `markNotEligible`, `assignTeamMember`, `scoreUpdated`, `teamMemberAssigned`, `phone`, `city`, `source`, `view`, `new`, `eligible`, `not_eligible`, `notEligible`, `contacted`, `assignModal`, `delete`, `deleteConfirm`, `assignNotes`, `scoreLabel`
- `admin.ready.*` — used across 4 files: `fullName`, `email`, `phone`, `age`, `address`, `passportNumber`, `nationality`, `countryOfBirth`, `languageProficiency`, `destinationCity`, `schoolLabel`, `intensiveCourse`, `staff`, `filterCity`
- `admin.tabs.*` — used across 5 files: `students`, `teamMembers`, `influencers`, `referrals`, `security`, `audit`, `eligibility`, `notifications`
- `admin.referralsMgmt.*` — exists only in the second (winning) `admin` block but is missing: `name`, `referredBy`, `type`, `email`, `family`, `status`, `date`, `all`, `familyType`, `noReferrals`, `statusUpdated`, `deleted`, `deleteDesc`

### Fix Strategy
**Merge both `"admin"` blocks into one** — take the large first block (lines 245-762 in EN, 245-781 in AR), add all the keys from the small second block into it, add the missing `admin.leads`, `admin.ready`, `admin.tabs`, `admin.referralsMgmt` (full) keys, then remove the duplicate second `admin` block entirely.

### Files to Change
| File | Change |
|------|--------|
| `public/locales/en/dashboard.json` | Merge second `admin` block into first; add all missing `admin.leads`, `admin.ready`, `admin.tabs`, `admin.referralsMgmt` full blocks; remove duplicate |
| `public/locales/ar/dashboard.json` | Same — merge and add all Arabic translations for the same missing keys |

### New Keys to Add Inside the Single Merged `admin` Block

**`admin.leads` (EN)**
```json
"leads": {
  "all": "All",
  "searchPlaceholder": "Search by name or phone...",
  "namePhoneRequired": "Name and phone are required",
  "added": "Lead added",
  "deleted": "Lead deleted",
  "updated": "Lead updated",
  "qualifiedAndCaseCreated": "{{name}} qualified and case created",
  "caseCreationError": "Failed to create case",
  "markEligible": "Mark Eligible",
  "markNotEligible": "Not Eligible",
  "assignTeamMember": "Assign Team Member",
  "scoreUpdated": "Score updated",
  "teamMemberAssigned": "Team member assigned",
  "phone": "Phone",
  "city": "City",
  "source": "Source",
  "view": "View",
  "new": "New",
  "eligible": "Eligible",
  "not_eligible": "Ineligible",
  "notEligible": "Ineligible",
  "contacted": "Contacted",
  "delete": "Delete",
  "deleteConfirm": "Are you sure you want to delete this lead?",
  "assignNotes": "Notes",
  "scoreLabel": "Eligibility Score"
}
```

**`admin.ready` (EN)**
```json
"ready": {
  "fullName": "Full Name",
  "email": "Email",
  "phone": "Phone",
  "age": "Age",
  "address": "Address",
  "passportNumber": "Passport Number",
  "nationality": "Nationality",
  "countryOfBirth": "Country of Birth",
  "languageProficiency": "Language Level",
  "destinationCity": "Destination City",
  "schoolLabel": "Language School",
  "intensiveCourse": "Intensive Course",
  "staff": "Team Member",
  "filterCity": "Filter by City"
}
```

**`admin.tabs` (EN)**
```json
"tabs": {
  "students": "Students",
  "teamMembers": "Team Members",
  "influencers": "Partners",
  "referrals": "Referrals",
  "security": "Security",
  "audit": "Audit Log",
  "eligibility": "Eligibility",
  "notifications": "Notifications"
}
```

**`admin.referralsMgmt` (EN) — complete block**
```json
"referralsMgmt": {
  "agent": "Partner",
  "student": "Student",
  "name": "Name",
  "referredBy": "Referred By",
  "type": "Type",
  "email": "Email",
  "family": "Family",
  "status": "Status",
  "date": "Date",
  "all": "All",
  "familyType": "Family",
  "noReferrals": "No referrals found",
  "statusUpdated": "Status updated",
  "deleted": "Referral deleted",
  "deleteDesc": "This will permanently delete this referral. This action cannot be undone."
}
```

All of the above get Arabic equivalents in `ar/dashboard.json`:

**`admin.leads` (AR)**
```json
"leads": {
  "all": "الكل",
  "searchPlaceholder": "البحث بالاسم أو الهاتف...",
  "namePhoneRequired": "الاسم والهاتف مطلوبان",
  "added": "تمت إضافة العميل",
  "deleted": "تم حذف العميل",
  "updated": "تم تحديث العميل",
  "qualifiedAndCaseCreated": "تم تأهيل {{name}} وإنشاء ملف",
  "caseCreationError": "فشل إنشاء الملف",
  "markEligible": "تأهيل",
  "markNotEligible": "غير مؤهل",
  "assignTeamMember": "تعيين عضو فريق",
  "scoreUpdated": "تم تحديث النقاط",
  "teamMemberAssigned": "تم تعيين عضو الفريق",
  "phone": "الهاتف",
  "city": "المدينة",
  "source": "المصدر",
  "view": "عرض",
  "new": "جديد",
  "eligible": "مؤهل",
  "not_eligible": "غير مؤهل",
  "notEligible": "غير مؤهل",
  "contacted": "تم التواصل",
  "delete": "حذف",
  "deleteConfirm": "هل أنت متأكد من حذف هذا العميل؟",
  "assignNotes": "ملاحظات",
  "scoreLabel": "نقاط الأهلية"
}
```

**`admin.ready` (AR)**
```json
"ready": {
  "fullName": "الاسم الكامل",
  "email": "البريد الإلكتروني",
  "phone": "الهاتف",
  "age": "العمر",
  "address": "العنوان",
  "passportNumber": "رقم جواز السفر",
  "nationality": "الجنسية",
  "countryOfBirth": "بلد الميلاد",
  "languageProficiency": "مستوى اللغة",
  "destinationCity": "مدينة الوجهة",
  "schoolLabel": "مدرسة اللغة",
  "intensiveCourse": "دورة مكثفة",
  "staff": "عضو الفريق",
  "filterCity": "تصفية حسب المدينة"
}
```

**`admin.tabs` (AR)**
```json
"tabs": {
  "students": "الطلاب",
  "teamMembers": "أعضاء الفريق",
  "influencers": "الشركاء",
  "referrals": "الإحالات",
  "security": "الأمان",
  "audit": "سجل التدقيق",
  "eligibility": "الأهلية",
  "notifications": "الإشعارات"
}
```

**`admin.referralsMgmt` (AR)**
```json
"referralsMgmt": {
  "agent": "الشريك",
  "student": "الطالب",
  "name": "الاسم",
  "referredBy": "أُحيل من",
  "type": "النوع",
  "email": "البريد الإلكتروني",
  "family": "عائلة",
  "status": "الحالة",
  "date": "التاريخ",
  "all": "الكل",
  "familyType": "عائلة",
  "noReferrals": "لا توجد إحالات",
  "statusUpdated": "تم تحديث الحالة",
  "deleted": "تم حذف الإحالة",
  "deleteDesc": "سيؤدي هذا إلى حذف الإحالة نهائياً. لا يمكن التراجع."
}
```

### Execution Plan
1. **Edit `public/locales/en/dashboard.json`**: Remove lines 1918-2017 (the duplicate `admin` stub). Inside the original `admin` block (lines 245-762), add the four new sub-blocks (`leads`, `ready`, `tabs`, full `referralsMgmt`) and merge the keys from the removed stub (`payouts`, `partnerPayouts`, `financials`, `students.studentCount`).

2. **Edit `public/locales/ar/dashboard.json`**: Same operation — remove the duplicate `admin` stub at lines 1949-2048, merge into the original `admin` block, adding all Arabic equivalents.

### What This Fixes
- Every admin page tab (Pipeline, Team, Submissions, Analytics, Activity, Settings, Spreadsheet, Students) that was showing raw keys
- All Leads management labels
- All "Ready to Apply" profile completion form labels
- All tab labels in Settings and Partners sections
- All Referrals management table headers
- All Payouts management labels
- All Partner Payouts panel labels
- All Financials KPI labels

No component files need changes — the components are correct; only the broken JSON is the issue.
