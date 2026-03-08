
## Root Cause (Confirmed)

The `cases` table has a PostgreSQL CHECK constraint:
```sql
cases_source_check: source = ANY (ARRAY['apply_page', 'manual', 'submit_new_student', 'social_media_partner', 'referral'])
```

The contact form sends `source: 'contact_form'` — which violates this constraint, causing a 500 error on every new submission.

The fix is two-pronged:

**1. Add `contact_form` to the database check constraint** (migration)

```sql
ALTER TABLE public.cases DROP CONSTRAINT cases_source_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_source_check 
  CHECK (source = ANY (ARRAY[
    'apply_page', 'manual', 'submit_new_student', 
    'social_media_partner', 'referral', 'contact_form'
  ]));
```

**2. No frontend or edge function code changes needed** — the edge function already correctly sends `source: 'contact_form'` (from the body destructuring default is `apply_page` but the contact form explicitly passes `contact_form`). The only issue is the DB constraint rejecting it.

## Files Changed
- Database migration only (no code files)
