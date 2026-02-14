

## Phase 6: In-App Notification Center

This phase adds a persistent in-app notification system with a bell icon, unread badge, and notification dropdown -- visible across all four dashboards (Admin, Student, Lawyer, Influencer). Admin-sent notifications from CustomNotifications will write to this new table instead of (or in addition to) the push subscription flow.

---

### 6A. Database: `notifications` Table

Create a new table to store per-user notifications:

```text
notifications
- id: uuid PK
- user_id: uuid NOT NULL (references no FK to auth.users, just stores user ID)
- title: text NOT NULL
- body: text NOT NULL
- is_read: boolean NOT NULL DEFAULT false
- created_at: timestamptz NOT NULL DEFAULT now()
- source: text DEFAULT 'system' (e.g. 'admin', 'system', 'status_change')
- metadata: jsonb DEFAULT '{}'
```

RLS Policies:
- Users can SELECT own notifications: `auth.uid() = user_id`
- Users can UPDATE own notifications (mark read): `auth.uid() = user_id`
- No direct INSERT by users (only via edge function or admin)
- Admins can SELECT all: `has_role(auth.uid(), 'admin')`

Enable realtime on the table so new notifications appear instantly.

---

### 6B. Update `send-custom-notification` Edge Function

Modify the existing edge function to INSERT rows into `notifications` table for each target user (instead of only attempting push). For each role selected, find all user_ids with that role and batch-insert notification rows using the service role client.

This ensures every admin broadcast creates persistent in-app notifications.

---

### 6C. `NotificationBell` Component

Create `src/components/common/NotificationBell.tsx` -- a reusable bell icon button with:

1. **Unread count badge** -- red circle with count (max "9+")
2. **Dropdown popover** on click showing recent notifications (last 20)
3. Each notification shows title, body preview (truncated), and relative time
4. "Mark all as read" button at the top
5. Click a notification to mark it as read
6. Unread items have a blue dot indicator
7. Empty state: "No notifications yet"
8. Realtime subscription: listens for new INSERT events on `notifications` table filtered by `user_id = auth.uid()` to update the list live

---

### 6D. Integrate Bell into All Dashboard Headers

Add `NotificationBell` to each dashboard header:

1. **Student Dashboard** (`DashboardHeader.tsx`): Add bell between the back button and sign-out button
2. **Lawyer Dashboard** (`LawyerDashboardPage.tsx`): Add bell in the header bar (line ~195 area where LogOut and ArrowLeftCircle are)
3. **Influencer Dashboard** (`InfluencerDashboardPage.tsx`): Add bell in the header bar
4. **Admin Dashboard** (`AdminLayout.tsx`): Add bell in the admin header area

All instances use the same `NotificationBell` component -- it self-fetches based on the current authenticated user.

---

### 6E. Status Change Notifications (Automatic)

Create a database trigger function that fires on UPDATE of `student_cases.case_status`. When the status changes, it inserts a notification for the `student_profile_id` user:

```sql
CREATE OR REPLACE FUNCTION notify_case_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.case_status IS DISTINCT FROM OLD.case_status AND NEW.student_profile_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, source, metadata)
    VALUES (
      NEW.student_profile_id,
      'Application Status Updated',
      'Your application status changed to: ' || NEW.case_status,
      'status_change',
      jsonb_build_object('case_id', NEW.id, 'old_status', OLD.case_status, 'new_status', NEW.case_status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_status_notify
  AFTER UPDATE OF case_status ON student_cases
  FOR EACH ROW EXECUTE FUNCTION notify_case_status_change();
```

This means students automatically get notified when their case progresses through the funnel.

---

### 6F. Translation Keys

**English (`dashboard.json`)**:
```json
"notifications": {
  "title": "Notifications",
  "markAllRead": "Mark all read",
  "noNotifications": "No notifications yet",
  "justNow": "Just now",
  "minutesAgo": "{{count}}m ago",
  "hoursAgo": "{{count}}h ago",
  "daysAgo": "{{count}}d ago",
  "statusChanged": "Application Status Updated",
  "statusChangedBody": "Your application status changed to: {{status}}"
}
```

**Arabic (`dashboard.json`)**: Mirror of above.

---

### Technical File Summary

| File | Action |
|------|--------|
| DB Migration | Create `notifications` table + RLS + realtime + trigger |
| `supabase/functions/send-custom-notification/index.ts` | Add INSERT into `notifications` table |
| `src/components/common/NotificationBell.tsx` | New component: bell + popover + realtime |
| `src/components/dashboard/DashboardHeader.tsx` | Add NotificationBell |
| `src/pages/LawyerDashboardPage.tsx` | Add NotificationBell in header |
| `src/pages/InfluencerDashboardPage.tsx` | Add NotificationBell in header |
| `src/components/admin/AdminLayout.tsx` | Add NotificationBell in header |
| `public/locales/en/dashboard.json` | Add notification keys |
| `public/locales/ar/dashboard.json` | Add notification keys |

### Implementation Order

1. Create `notifications` table with RLS, realtime, and trigger via migration
2. Update `send-custom-notification` edge function to write to the new table
3. Create `NotificationBell` component with realtime subscription
4. Add `NotificationBell` to all four dashboard headers
5. Add translation keys
6. Deploy edge function and test end-to-end

