# Role-aware notification settings

## Goal
Each dashboard's notification settings only show switches for things that person can actually be notified about. Delivery and existing saved preferences keep working unchanged.

## What changes for users
- Admin: Messages, Appointments, Cases, Payments, Documents, Recruitment, Calls, System
- Team member: Messages, Appointments, Cases, Documents, Student profile, Calls, System
- Agent / Partner / Ambassador: Messages, Recruitment, Payments (earnings), Cases (referral milestones), Calls, System
- Student: Messages, Appointments, Cases, Payments, Documents, Profile, Calls, System
- Labels get small role-specific descriptions (e.g. "Referral milestones" for partners instead of "Cases").

## Steps
1. Confirm the matrix against real producers: search the database notification functions (notify_case_event, recruitment/payout/document/appointment triggers) for which roles each category reaches. Adjust the matrix above to match the evidence before building.
2. Add one shared category catalog (single source of truth) listing every category, its preference column, and which roles see it. Used by the frontend; the push function gets the same list via a small shared file so the two can't drift.
3. Pass the dashboard role from DashboardLayout into NotificationBell and on into PushNotificationSettings; render only that role's categories.
4. Hidden categories are never switched off silently — their saved value is left untouched, so delivery is unchanged.
5. Add role descriptions in en + ar (and he if present) translations.
6. Tests: unit test that every role's list only uses known categories, that every backend category exists in the catalog (drift guard), and i18n parity.

## Technical details
- New `src/lib/notificationCategories.ts`: `NOTIFICATION_CATEGORIES` with `{ key, column, roles }` and `categoriesForRole(role)`.
- `supabase/functions/_shared/notificationCategories.ts` mirrors keys→columns; `push-dispatch` imports it instead of its local `CATEGORY_COLUMN`. A vitest guard compares both files.
- `NotificationBell` gets a `role` prop (DashboardLayout already knows it); `PushNotificationSettings` takes `role` and filters.
- Upsert keeps full existing row, so hidden `cat_*` values persist.
- No database schema change needed.
