

# Purge All Test Data (Keep Admin Only)

## What Gets Deleted

All test/seed data will be removed, leaving only the admin account (`ranimdwahde3@gmail.com`) with a clean, empty database ready for production.

### Data to purge (in dependency order):

| Table | Rows | Action |
|-------|------|--------|
| rewards | 4 | DELETE all |
| commissions | 3 | DELETE all |
| notifications | 3 | DELETE all |
| student_cases | 3 | DELETE all |
| leads | 4 | DELETE all |
| login_attempts | 11 | DELETE all |
| admin_audit_log | 34 | DELETE all |
| user_roles | 3 rows (team + influencer roles, keep admin) | DELETE non-admin |
| profiles | 2 rows (team + influencer, keep admin) | DELETE non-admin |
| auth.users | 2 users (team + influencer) | DELETE via edge function |

### What stays untouched:
- Admin profile (`ranimdwahde3@gmail.com`)
- Admin user_roles entry (`admin` role)
- All schema, triggers, functions, RLS policies
- Configuration tables (eligibility_config, checklist_items, majors, etc.)

## Execution Steps

1. **Delete dependent records first** (rewards, commissions, notifications, student_cases, leads, login_attempts, audit_log) -- all rows, since they're all test data
2. **Delete non-admin user_roles** (team + influencer role entries, but keep admin's)
3. **Delete non-admin profiles** (team + influencer)
4. **Delete non-admin auth users** via the existing `purge-account` edge function for `team@gmail.com` and `influncer@gmail.com` -- OR directly via SQL DELETE on the data tables + auth admin API

Since we can't delete auth.users from SQL, we'll use the `purge-account` edge function. However, since we're manually cleaning tables first, we just need to call `supabase.auth.admin.deleteUser()` for the two test users via the existing edge function.

**Alternative simpler approach**: Delete all data from tables via SQL, then call purge-account for the two auth users. This avoids FK issues since we clear data first.

## Technical Details

### SQL execution order (to respect any implicit FK relationships):
```
1. DELETE FROM rewards;
2. DELETE FROM commissions;
3. DELETE FROM notifications;
4. DELETE FROM student_cases;
5. DELETE FROM leads;
6. DELETE FROM login_attempts;
7. DELETE FROM admin_audit_log;
8. DELETE FROM user_roles WHERE user_id != '4abfba8f-...';
9. DELETE FROM profiles WHERE id != '4abfba8f-...';
```

Then call purge-account edge function for the two test auth users to clean them from the auth system.

### Post-purge verification
- Confirm admin profile still intact
- Confirm all other tables empty
- Confirm admin dashboard loads with zero data (clean slate)

