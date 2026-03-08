
## Root Cause

Both `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` contain **two separate `"admin"` root-level keys** and **two `"common"` root-level keys**. JSON parsers silently discard the first occurrence when a duplicate key exists — the second block overwrites the entire first one. This causes every key from the first `admin` block to be missing at runtime, explaining raw key strings like `admin.students.noRegistered`, `admin.pipeline.title`, `admin.commandCenter.title`, etc.

### What's lost (first `admin` block, lines 245–532 in EN):
- `admin.commandCenter.*` (all 14 keys)
- `admin.pipeline.*` (all ~35 keys)
- `admin.team.*` (title, createMember, fullName, email, role, tempPassword, createBtn, noMembers)
- `admin.programs.*` (old minimal block — superseded by second but some keys differ: `programs`, `accommodations`, `freePrice`, `labelName`)
- `admin.submissions.*` (title, subtitle, empty, markEnrolled)
- `admin.financials.title` (old block — superseded)
- `admin.analytics.title` (old block — superseded)  
- `admin.activity.title`, `admin.activity.search`
- `admin.settings.*` (all 35 keys — CRITICAL: contact form labels, visa manager, reset panel)
- `admin.spreadsheet.*` (all 20 keys including column headers)
- `admin.tabs.spreadsheet`
- `admin.students.*` (all 32 keys including `noRegistered`, `managementTitle`, `colStudent`, etc.)

### What's lost (first `common` block, lines 596–608 in EN):
- `common.refresh`, `common.save`, `common.done`, `common.cancel`, `common.delete`, `common.edit`, `common.loading`, `common.error`, `common.success`, `common.saving`, `common.inAppBannerText`, `common.copyLink`

The second `common` block (lines 1707–1714) only has: `loadMore`, `loading`, `refresh`, `done`, `save`, `cancel` — so `common.saving`, `common.edit`, `common.delete`, `common.error`, `common.success`, `common.inAppBannerText`, `common.copyLink` are all missing.

## Fix

Merge both `"admin"` blocks into one and both `"common"` blocks into one in both locale files. The merged result must contain all keys from both blocks — where a key exists in both, keep the more complete/detailed version (the first block's `admin.programs` had some extra keys like `labelName`, `programs`, `accommodations`, `freePrice`, `lessonsWk`, `startsDay` that the second block lacks).

### Files to change:
```
public/locales/en/dashboard.json  — merge duplicate "admin" + "common" blocks
public/locales/ar/dashboard.json  — merge duplicate "admin" + "common" blocks
```

### Strategy:
1. Remove the second `"admin": { ... }` block (lines 1527–1705 EN / 1539–1717 AR)
2. Into the first `"admin"` block, add all the new sub-keys that exist only in the second block: `financials` (full), `analytics` (full), `commission` (full), `submissions` (full), `activity.noActivity`, `team` (new keys: `teamMemberRole`, `partnerRole`, `creating`, `allFieldsRequired`, `accountCreated`, `credentialsHint`)
3. Update the first `"admin".programs` block to include the extra keys added in the second block: `tierBasic`, `tierStandard`, `tierPremium`, `typeLanguageSchool`, `typeCourse`, `typeUniversity`, `typeOther` (these were missing from the first block)
4. Remove the second `"common": { ... }` block (lines 1707–1714 EN / 1719–1726 AR)
5. Into the first `"common"` block, add `loadMore` (the only key that exists in second but not first)

No component changes. No logic changes. Pure JSON restructuring.
