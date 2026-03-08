

## Two fixes needed

### Problem 1: Commission change → not reflected in real time on partner dashboard
`PartnerOverviewPage` and `PartnerEarningsPage` each fetch commission data once on mount. There are no real-time subscriptions on `partner_commission_overrides` or `platform_settings`. When admin saves a new rate, the partner must manually refresh.

**Fix**: Add `useRealtimeSubscription` hooks to both partner dashboard pages for `partner_commission_overrides` and `platform_settings`. When either table changes, the page refetches and the displayed commission rate + projected earnings update immediately.

---

### Problem 2: "الطلاب المسجلون" shows empty — apply/contact form cases never appear
`PartnerStudentsPage` queries:
```
.from("cases").eq("partner_id", uid)
```
Apply page submissions are created with `partner_id: null` (line 159 of `ApplyPage.tsx`). The partner has no `partner_id` on those cases so they never show up.

The correct behavior (matching `PartnerOverviewPage`'s existing logic): respect the partner's **visibility setting** from `partner_commission_overrides.show_all_cases`:
- `true` → show all cases (no filter)
- `false` → show only `source IN ('apply_page', 'contact_form')` cases (the auto-generated ones)
- `null` → show only cases where `partner_id = uid` (referral-linked cases only)

**Fix**: Rewrite `PartnerStudentsPage.load()` to:
1. First fetch the partner's override from `partner_commission_overrides` to get `show_all_cases`
2. Build the cases query based on that visibility value — identical to what `PartnerOverviewPage` already does
3. Add real-time subscriptions for `cases` and `partner_commission_overrides`

---

### Files to change — 3 files

| File | Change |
|---|---|
| `src/pages/partner/PartnerStudentsPage.tsx` | Rewrite `load()` to use visibility-based case fetching (same logic as `PartnerOverviewPage`). Add realtime subscriptions for `cases` and `partner_commission_overrides`. |
| `src/pages/partner/PartnerOverviewPage.tsx` | Add `useRealtimeSubscription` for `partner_commission_overrides`, `platform_settings`, and `cases` so KPIs and commission rate update in real time. |
| `src/pages/partner/PartnerEarningsPage.tsx` | Add `useRealtimeSubscription` for `partner_commission_overrides` so per-partner commission rate is always fresh. Also fix it to check `partner_commission_overrides` first (currently it only reads global `platform_settings`). |

### How visibility logic works (consistent across all 3 pages)
```
override.show_all_cases === true  → query all cases (no source filter, no partner_id filter)
override.show_all_cases === false → query WHERE source IN ('apply_page', 'contact_form')
override.show_all_cases === null  → query WHERE partner_id = uid
```

### Real-time subscription wiring
```tsx
// After load() is defined, add:
useRealtimeSubscription('cases', () => load(userId), !!userId);
useRealtimeSubscription('partner_commission_overrides', () => load(userId), !!userId);
```
When admin saves a new commission amount in `CommissionSettingsPanel`, the `partner_commission_overrides` table changes → triggers `load()` on the partner's active dashboard pages → commission rate and projected earnings update without page refresh.

