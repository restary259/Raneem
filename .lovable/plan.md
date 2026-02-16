

# Team Dashboard -- Verification Fixes

## Issues Found

### 1. Wrong Language School Names (CRITICAL)
**Line 37** has hardcoded wrong schools:
```
['Goethe-Institut', 'Humboldt-Institut', 'DID Deutsch-Institut', 'Carl Duisberg']
```
Must be changed to your actual 4 partners:
```
['F+U Academy of Languages', 'Alpha Aktiv', 'GO Academy', 'VICTORIA Academy']
```

### 2. "Submit for Application" Does NOT Move Case Forward (CRITICAL)
The `confirmPaymentAndSubmit` function tries `canTransition(profile_filled, PAID)` -- but the FSM requires `profile_filled -> services_filled -> paid`. Since teams skip `services_filled`, the transition always fails silently (status stays unchanged).

**Fix:** Update the FSM in `caseTransitions.ts` to allow `PROFILE_FILLED -> PAID` directly. Also add a fallback in `confirmPaymentAndSubmit` so that from `profile_filled` or `services_filled`, it forces the status to `paid`.

### 3. Case Filter Tabs Have No English Translation
The `FILTER_LABELS` object (lines 72-80) is hardcoded in Arabic only. When language is English, users still see Arabic labels.

**Fix:** Replace `FILTER_LABELS` with a bilingual lookup using the existing `lawyer.filters.*` i18n keys that already exist in the EN translation file.

### 4. Duplicate Gender Field in Services Tab
Gender dropdown appears in both the "Visa Info" tab (line 866) and "Services" tab (line 930). Remove the duplicate from "Services".

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/TeamDashboardPage.tsx` | 1. Fix `LANGUAGE_SCHOOLS` to the 4 real partners. 2. Replace `FILTER_LABELS` with bilingual i18n keys. 3. Add fallback in `confirmPaymentAndSubmit` for `profile_filled` cases. 4. Remove duplicate gender field from Services tab. |
| `src/lib/caseTransitions.ts` | Allow `PROFILE_FILLED -> PAID` directly (team members skip `services_filled`). |

## Technical Details

### Language Schools Fix
```typescript
const LANGUAGE_SCHOOLS = ['F+U Academy of Languages', 'Alpha Aktiv', 'GO Academy', 'VICTORIA Academy'];
```

### FSM Transition Fix
```
PROFILE_FILLED -> [SERVICES_FILLED, PAID]  // was only SERVICES_FILLED
```

### Filter Labels Fix
Replace the hardcoded Arabic `FILTER_LABELS` with:
```typescript
const getFilterLabel = (filter: CaseFilterTab): string => {
  const labels: Record<CaseFilterTab, { ar: string; en: string }> = {
    all: { ar: 'الكل', en: 'All' },
    new: { ar: 'جديد', en: 'New' },
    contacted: { ar: 'تم التواصل', en: 'Contacted' },
    appointment_stage: { ar: 'مرحلة الموعد', en: 'Appointments' },
    profile_filled: { ar: 'ملفات مكتملة', en: 'Completed Files' },
    submitted: { ar: 'تم الإرسال للمسؤول', en: 'Submitted' },
    sla: { ar: 'تنبيه SLA', en: 'SLA Alert' },
  };
  return isAr ? labels[filter].ar : labels[filter].en;
};
```

### Submit Flow Fix
In `confirmPaymentAndSubmit`, add fallback:
```typescript
if (canTransition(c.case_status, CaseStatus.PAID)) {
  targetStatus = CaseStatus.PAID;
} else if (['profile_filled', 'services_filled'].includes(c.case_status)) {
  targetStatus = CaseStatus.PAID; // Force transition for team workflow
}
```

