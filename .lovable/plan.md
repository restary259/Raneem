

# Multi-Fix: Translation, Freeze Prevention, Payout UX, Bottom Nav, and Session Modal

## Fix 1: Translation Keys Broken (ROOT CAUSE FOUND)

**Problem**: The "common.save" and "common.cancel" buttons show as raw keys in the ProfileCompletionModal.

**Root Cause**: Both `en/dashboard.json` and `ar/dashboard.json` have **duplicate `"common"` keys**. JSON does not support duplicate keys -- the second one (line 1207) overwrites the first one (line 761). The first `"common"` block has `save`, `cancel`, `loading`, `error`, etc. The second `"common"` block only has `"lastRefreshed"`. So all the save/cancel/etc. keys are silently lost.

**Fix**: Merge the second `"common"` block into the first one and remove the duplicate. The `lastRefreshed` key already exists in the first block, so the second block is entirely redundant.

| File | Change |
|---|---|
| `public/locales/en/dashboard.json` | Remove duplicate `"common"` block at line 1207-1209 |
| `public/locales/ar/dashboard.json` | Remove duplicate `"common"` block at line 1207-1209 |

---

## Fix 2: Influencer Dashboard -- Replace 20-Day Timer with "Commission Received"

**Problem**: When admin marks a case as paid and the reward is already paid (via early release or manual mark), the influencer dashboard still shows "20 days left" countdown. It should show "Commission Received" or "Case Closed" instead.

**Current Logic** (InfluencerDashboardPage.tsx line 124-131): `getTimerInfo()` only checks `paidAt` date math, never checks reward status.

**Fix**: Check the rewards data. If the linked reward for this case has `status === 'paid'`, show a green "Commission Received" badge instead of the countdown timer.

Also in EarningsPanel.tsx (line 265-267): The "20-day lock active" badge shows when `eligibleRewards.length === 0` even if all rewards are already paid. Fix: only show it when there are pending (not paid) rewards still in the lock window.

| File | Change |
|---|---|
| `src/pages/InfluencerDashboardPage.tsx` | Fetch rewards alongside leads/cases. In student card, check if linked reward is paid -- show "Commission Received" badge instead of timer |
| `src/components/influencer/EarningsPanel.tsx` | Fix lock badge to not show when all rewards are already paid |

---

## Fix 3: WhatsApp Payout Button Should Light Up After Early Release

**Problem**: When admin does early release, the WhatsApp button stays disabled because `eligibleRewards` is empty (rewards are marked as `paid`, not `pending`).

**Current Logic**: The button requires `eligibleRewards.length > 0` but early-released rewards have `status: 'paid'`, so they're excluded from `eligibleRewards`.

**Analysis**: This is actually correct behavior -- after early release, the admin has already paid, so there's nothing for the influencer to request. The button should remain disabled. BUT the UX message should change from "20-day lock active" to "All commissions received" to make this clear.

| File | Change |
|---|---|
| `src/components/influencer/EarningsPanel.tsx` | Add a new badge state: when all rewards are paid and none pending, show "All commissions received" instead of "20-day lock active" |

---

## Fix 4: Bottom Navigation Must Not Scroll Away (Team Dashboard)

**Problem**: On mobile, the bottom nav can scroll up with the page content.

**Current Code** (TeamDashboardPage.tsx line 594): Already uses `position: fixed; bottom: 0`. However, the main content area has `overflow-auto` on line 402, and the outer `div` has `min-h-screen`. The issue is likely the content wrapper `div.flex-1.overflow-auto` -- when this scrolls, the fixed nav should stay, but on some mobile browsers the fixed positioning can break inside a flex scroll container.

**Fix**: Ensure the bottom nav is outside the scrollable flex container, at the root level of the component. Move it outside the `div.flex` wrapper.

| File | Change |
|---|---|
| `src/pages/TeamDashboardPage.tsx` | Move bottom nav outside the flex container to be a direct child of the root div |

---

## Fix 5: Session Kick "OK" Button Fix

**Problem**: The OK button on the session kick modal doesn't close it (visible in screenshot 192).

**Analysis**: The `acknowledgeKick` function was fixed in the previous edit to call `setKicked(false)`. However, the `AlertDialog` in App.tsx has `open={kicked}` but no `onOpenChange` handler. This means clicking outside or pressing Escape won't close it. The OK button click calls `acknowledgeKick` which does `setKicked(false)` then `signOut()` then `navigate()`. The navigate happens after signOut -- but since the user is already on `/student-auth`, the navigate may be a no-op, and the `setKicked(false)` should work. Let me check if the issue is that `acknowledgeKick` awaits `signOut()` and the promise rejection prevents `navigate()`.

Looking at the hook (line 100-106 from session guard): `acknowledgeKick` calls `setKicked(false)` first, then tries to sign out and navigate. This should work. The issue may be that the auto-dismiss timer (10 seconds) fired first and already called `signOut()`, so the user's session is gone, and when they click OK, the `acknowledgeKick` runs but `signOut()` fails silently because they're already signed out -- this is fine.

The real issue: `AlertDialog` has `open={kicked}` but NO `onOpenChange` prop. If the component unmounts before `setKicked(false)` takes effect (due to navigation), the modal stays. Add `onOpenChange` to handle the dialog close properly.

| File | Change |
|---|---|
| `src/App.tsx` | Add `onOpenChange` to AlertDialog that calls `acknowledgeKick` when closed |

---

## Fix 6: Merge Pending Payments in Admin Money Tab

**Problem**: The admin Money tab shows two separate sections -- "Payout Requests" (blue card) and "Pending Payouts" (amber card) -- which are visually redundant and confusing.

**Fix**: Merge the "Pending Payouts" (individual rewards) section into the "Payout Requests" section when a payout request exists for those rewards. Only show standalone pending rewards that have NO associated payout request.

| File | Change |
|---|---|
| `src/components/admin/MoneyDashboard.tsx` | Filter out pending rewards that are already linked to a payout request (their IDs appear in `linked_reward_ids`). Only show orphaned pending rewards separately. |

---

## Summary of All Changes

| Priority | Issue | Files | Risk |
|---|---|---|---|
| CRITICAL | Duplicate `common` key in JSON | 2 JSON files | Zero -- removes redundant key |
| HIGH | Timer shows instead of "Commission Received" | `InfluencerDashboardPage.tsx`, `EarningsPanel.tsx` | Low -- display only |
| HIGH | Session modal OK button | `App.tsx` | Low -- adds `onOpenChange` |
| MEDIUM | Bottom nav scrolling | `TeamDashboardPage.tsx` | Low -- DOM restructure |
| LOW | Merge pending payments | `MoneyDashboard.tsx` | Low -- display only |

## What Will NOT Change
- Commission calculation formulas
- Case status definitions and transitions
- Payment marking logic
- RLS policies
- Database schema
- Edge functions
- Role permissions

