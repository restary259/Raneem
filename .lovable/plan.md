

# Sync Influencer Dashboard with System-Wide Data

## Problem Summary

Three issues on the Influencer Dashboard:

1. **Eligibility display**: Status badges and filter logic already use admin-set `lead.status` correctly (eligible/not_eligible). No logic bug here -- this is working as intended.

2. **Bottom navigation styling mismatch**: The influencer bottom nav uses a plain `bg-card border-t` style with `text-primary` active color, while the team dashboard uses a polished `bg-white border-gray-200` with orange active states, rounded-lg buttons, and `active:scale-95` press feedback. These need to match.

3. **Missing payout eligible date**: When a case is paid and the 20-day timer starts, the influencer student card only shows "X days left" but does NOT show the actual date when payout can be requested. This date needs to be calculated (`paid_at + 20 days`) and displayed.

---

## Changes

**Single file: `src/pages/InfluencerDashboardPage.tsx`**

### 1. Add Payout Eligible Date to Student Cards

Update the `getTimerInfo` function to also return the unlock date:

```typescript
const getTimerInfo = (paidAt: string | null) => {
  if (!paidAt) return null;
  const paidDate = new Date(paidAt);
  const unlockDate = new Date(paidDate.getTime() + LOCK_DAYS * 24 * 60 * 60 * 1000);
  const elapsed = Math.floor((Date.now() - paidDate.getTime()) / (1000 * 60 * 60 * 24));
  const remaining = LOCK_DAYS - elapsed;
  return { elapsed, remaining, ready: remaining <= 0, unlockDate };
};
```

Then in the timer display section, add the payout eligible date:

- When locked: show "X days left -- Payout available on DD/MM/YYYY"
- When ready: show "Payout available" (as now)

Also add the **paid date** display: "Paid on DD/MM/YYYY" below the payment status line.

### 2. Match Bottom Navigation to Team Dashboard Style

Replace the current bottom nav with the same visual pattern used by TeamDashboardPage:

- `bg-white border-t border-gray-200` container
- `rounded-lg` button style with `active:scale-95` press feedback
- Orange active color (`text-orange-500`) instead of generic `text-primary`
- `min-w-[56px] min-h-[44px]` touch targets
- `safe-area-inset-bottom` padding
- Import `useIsMobile` hook to only show bottom nav on mobile (matching team pattern)

### 3. Add `useIsMobile` Import

Import `useIsMobile` from `@/hooks/use-mobile` so the bottom nav only renders on mobile, matching the team dashboard behavior. On desktop, the tab navigation still works via the bottom bar but uses the same consistent styling.

---

## Technical Details

- Only `src/pages/InfluencerDashboardPage.tsx` is modified
- No database changes needed -- `paid_at` is already available on cases
- Date formatting will use the browser's locale-aware `toLocaleDateString()` for proper Arabic/English date display
- The `unlockDate` is derived client-side from `paid_at + 20 days`, keeping it in sync with the same calculation used in `request_payout` RPC and the admin `InfluencerPayoutsTab`

