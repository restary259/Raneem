

# Fix Missing Translation Key and Minor Cleanup

## Issues Found During Testing

1. **Missing translation key**: `admin.overview.activeCases` displays as raw text in the admin dashboard Overview tab. Needs to be added to both Arabic and English dashboard locale files.

2. **Minor inconsistency**: AdminOverview.tsx line 91 sparkline filter still includes `'completed'` alongside `'paid'`. Should be cleaned to just `['paid']` for consistency with the simplified pipeline.

## Changes

### 1. Add missing translation key

**File: `public/locales/ar/dashboard.json`**
- Add `"activeCases": "الحالات النشطة"` under `admin.overview`

**File: `public/locales/en/dashboard.json`**
- Add `"activeCases": "Active Cases"` under `admin.overview`

### 2. Clean sparkline filter

**File: `src/components/admin/AdminOverview.tsx`**
- Line 91: Change `['paid', 'completed']` to `['paid']`

## Verified Working

The following were confirmed correct during testing:
- Funnel shows 9 granular stages ending at Paid (no post-paid stages)
- Student Cases tab filters to only profile_filled / services_filled / paid
- Mark Paid button calls the admin-mark-paid edge function (server-side admin check)
- NextStepButton cannot transition to Paid (empty transitions for services_filled)
- Transition map is correct: Paid is terminal, no post-paid transitions exist
- Legacy statuses (ready_to_apply, visa_stage, completed) all resolve to Paid

