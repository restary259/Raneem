# Real-Time Data Sync -- Gap Analysis and Fix Plan

## Current State

The system already has real-time subscriptions on 3 of 4 dashboards using a `useRealtimeSubscription` hook. However, there are critical gaps causing stale data.

## Identified Issues

### 1. Missing Realtime Publication for Key Tables

These tables are subscribed to in code but **NOT enabled** in the database realtime publication:

- `profiles` (Admin subscribes to it)
- `rewards` (Admin and Influencer subscribe to it)

This means those subscriptions silently do nothing.

**Fix:** Add a migration to enable realtime for `profiles` and `rewards`.

### 2. Student Dashboard Has Zero Realtime Subscriptions

The Student Dashboard (`StudentDashboardPage.tsx`) fetches profile data once on load and never updates. If admin changes student status, case stage, or marks payment -- the student sees stale data until they manually refresh.

**Fix:** Add realtime subscriptions to the Student Dashboard for `profiles`, `student_cases`, `notifications`, and `student_checklist`.

### 3. No Window Focus Refetch

When a user switches tabs/windows and comes back, data could be minutes old. None of the dashboards refetch on window focus.

**Fix:** Add a `visibilitychange` listener to refetch data when the user returns to the app.

### 4. No Post-Mutation Refetch Guarantee

Some child components (like `NextStepButton`, case status updates) call `onRefresh` but others may not propagate correctly.

**Fix:** Ensure all mutation callbacks trigger the parent's refetch function.

---

## Implementation Plan

### Step 1: Database Migration

Enable realtime for `profiles` and `rewards` tables:

```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;
```

### Step 2: Enhance useRealtimeSubscription Hook

Add an optional `refetchOnFocus` parameter. When enabled, it will also refetch data when the browser tab regains focus using the `visibilitychange` event.

### Step 3: Add Realtime to Student Dashboard

Add subscriptions for:

- `profiles` -- profile changes (status, visa, etc.)
- `student_cases` -- case stage updates
- `notifications` -- new notifications
- `student_checklist` -- checklist updates

Also add window-focus refetch so the student always sees fresh data.

### Step 4: Add Window Focus Refetch to All Dashboards

Update Admin, Team, and Influencer dashboards to also refetch on window focus, providing a safety net even if a realtime event is missed.

---

## Files to Modify


| File                                    | Change                                               |
| --------------------------------------- | ---------------------------------------------------- |
| New migration SQL                       | Enable realtime for `profiles` and `rewards`         |
| `src/hooks/useRealtimeSubscription.ts`  | Add `visibilitychange` listener for refetch on focus |
| `src/pages/StudentDashboardPage.tsx`    | Add realtime subscriptions + focus refetch           |
| `src/pages/AdminDashboardPage.tsx`      | Add focus refetch                                    |
| `src/pages/TeamDashboardPage.tsx`       | Add focus refetch                                    |
| `src/pages/InfluencerDashboardPage.tsx` | Add focus refetch                                    |


## Security Note

No new RLS policies needed. Existing policies already control which rows each role can see. Realtime respects RLS -- users only receive events for rows they have SELECT access to.

&nbsp;

**Prompt: Pull-to-Refresh for Tables**

&nbsp;

&nbsp;

Implement pull-to-refresh only for table/list views on the Darb_Study dashboards.

&nbsp;

Requirements:

&nbsp;

1. Pull-to-refresh triggers only on top of the table/list scroll, not anywhere else.
2. On refresh:  

  - Fetch the latest data from the server/API for that table only.
  - Do not reload the entire page.
  - Update the table data in-place, keeping pagination, filters, and scroll position intact.
3. &nbsp;
4. Disable pull-to-refresh on pages with active forms, uploads, or payment processing.
5. Show a standard “refresh spinner” while fetching data.
6. Prevent duplicate API calls if the user repeatedly pulls during the same fetch.
7. Ensure real-time updates also reflect changes made on other dashboards:  

  - Admin → Student status / revenue
  - Influencer → commission / referral data
  - Team → appointments / case assignments
8. &nbsp;
9. Add a fallback auto-refresh every 20–30 seconds in case pull-to-refresh is not triggered.
10. Ensure compatibility with both mobile and desktop scroll behaviors.
11. After refresh, the table should retain user-applied filters, sorting, and search.

&nbsp;

&nbsp;

Goal: Allow users to get the latest table data safely and quickly without losing context or interrupting other workflows.

&nbsp;