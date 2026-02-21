

# Translation Earnings Attribution and Real-Time Sync

## Overview

This plan adds a `translation_added_by_user_id` column to `student_cases`, updates the `auto_split_payment` trigger to generate a translation reward for the team member who added the service, and ensures all dashboards stay in sync via existing real-time subscriptions.

---

## 1. Database Migration

Add a new column to track who added the translation service:

```sql
ALTER TABLE public.student_cases
ADD COLUMN translation_added_by_user_id uuid DEFAULT NULL;
```

Update the `auto_split_payment()` trigger to create a translation reward for the team member:

```sql
-- Inside the "CREATE rewards when moving TO paid" block, after the Lawyer reward section:

-- Translation reward -- attribute to the team member who added translation
IF NEW.has_translation_service AND NEW.translation_fee > 0 AND NEW.translation_added_by_user_id IS NOT NULL THEN
  INSERT INTO rewards (user_id, amount, status, admin_notes)
  VALUES (
    NEW.translation_added_by_user_id,
    NEW.translation_fee,
    'pending',
    'Auto-generated translation commission from case ' || NEW.id::text
  )
  ON CONFLICT DO NOTHING;
END IF;
```

Also handle the cancellation path: when moving AWAY from paid, the existing cancellation logic (`UPDATE rewards SET status = 'cancelled' WHERE admin_notes LIKE ...`) already covers this since the admin_notes contain the case ID.

---

## 2. Team Dashboard: Store `translation_added_by_user_id`

**File: `src/pages/TeamDashboardPage.tsx`**

### In `saveProfileCompletion` (line ~358)
When the team member toggles `has_translation_service` ON, set `translation_added_by_user_id` to the current user's ID:

```typescript
// Add to updateData:
translation_added_by_user_id: profileValues.has_translation_service ? user?.id : null,
```

**Key rule**: Only set `translation_added_by_user_id` if it is currently null on the case (preserve original creator even after reassignment). If the case already has a `translation_added_by_user_id`, don't overwrite it.

```typescript
// Before building updateData, check:
const preserveTranslationCreator = profileCase.translation_added_by_user_id && profileValues.has_translation_service;
// In updateData:
translation_added_by_user_id: preserveTranslationCreator
  ? profileCase.translation_added_by_user_id
  : (profileValues.has_translation_service ? user?.id : null),
```

### In `openProfileModal` (line ~335)
Add `translation_added_by_user_id` to the values loaded from the case:

```typescript
translation_added_by_user_id: c.translation_added_by_user_id || null,
```

---

## 3. Real-Time Subscription Audit

All dashboards already have comprehensive real-time subscriptions. Here is the current state:

| Dashboard | Tables Subscribed | Status |
|-----------|------------------|--------|
| Admin | leads, student_cases, commissions, rewards, payout_requests, profiles | Complete |
| Team | student_cases, appointments, leads, commissions, payout_requests | Complete |
| Influencer | leads, student_cases, rewards, payout_requests, commissions | Complete |
| EarningsPanel | rewards, payout_requests (via own fetchData + parent refetch) | Complete |

### Missing subscription: `rewards` on Team Dashboard

The Team Dashboard does not subscribe to the `rewards` table. When the admin marks a case as paid and the `auto_split_payment` trigger creates rewards, the Team member's EarningsPanel won't update until they manually refresh.

**Fix**: Add `useRealtimeSubscription('rewards', refetch, authReady)` to `TeamDashboardPage.tsx` (after line 206).

### EarningsPanel internal sync

The `EarningsPanel` component has its own `fetchData` function and its own `useRealtimeSubscription` calls for `rewards` and `payout_requests`. This means it will independently refetch when rewards change. No additional work needed here.

---

## 4. Prevent Double Counting and Race Conditions

The `auto_split_payment` trigger already uses `ON CONFLICT DO NOTHING` for all reward inserts, which prevents duplicates if the trigger fires multiple times.

The `useDashboardData` hook has an `isFetchingRef` guard that prevents concurrent fetches (line 48-49 in `useDashboardData.ts`). This prevents race conditions from multiple real-time events firing in rapid succession.

No additional changes needed for race condition prevention.

---

## 5. Performance: No Flicker, No Blocking Spinners

The current architecture already handles this:
- **No full-page rerenders**: Real-time events call `refetch()` which updates state without unmounting components
- **No blocking spinners**: `DashboardContainer` only shows loading on initial load; subsequent refetches update data in-place
- **Team dashboard skeleton**: Already implemented (shimmer layout instead of spinner)
- **Tab content**: Uses conditional rendering, preserving component state

No additional performance changes needed.

---

## Files Modified Summary

| File | Changes |
|------|---------|
| Database migration | Add `translation_added_by_user_id` column; update `auto_split_payment` trigger |
| `src/pages/TeamDashboardPage.tsx` | Store `translation_added_by_user_id` on save; add `rewards` real-time subscription |

## What Does NOT Change

- Financial KPI calculations (source of truth remains `student_cases` columns)
- Influencer commission logic (unchanged in trigger)
- Lawyer commission logic (unchanged)
- RLS policies (new column inherits existing `student_cases` policies)
- 20-day lock timer logic
- Payout request flow

---

## Technical: E2E Test Flow

After implementation, the following flow validates correctness:

1. Team member opens case, enables "Translation Service" checkbox, completes profile
2. Verify `translation_added_by_user_id` is set to the team member's user ID in the database
3. Admin marks case as paid via admin-mark-paid edge function
4. `auto_split_payment` trigger fires, creating a translation reward for the team member
5. Team member's EarningsPanel updates in real-time (via `rewards` subscription) showing the new pending reward
6. Reassign the case to a different team member
7. New team member opens the case -- `translation_added_by_user_id` still points to the original creator
8. Verify the reward remains attached to the original team member, not the new assignee

