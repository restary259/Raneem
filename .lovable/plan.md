
## DARB Portal — Full Production Overhaul Plan

### Current State Assessment

After a thorough scan of all relevant files, here's what exists and what needs fixing:

**What's already correct:**
- Status codes in `AdminPipelinePage`, `CaseDetailPage`, `TeamCasesPage` are already using canonical statuses (`new`, `contacted`, `appointment_scheduled`, `profile_completion`, `payment_confirmed`, `submitted`, `enrollment_paid`)
- Admin submissions page already queries `status = 'submitted'` on the `cases` table correctly
- `TeamCasesPage` already restricts "All" tab to `assigned_to = user.id OR source in (manual, submit_new_student)`
- `ProfileCompletionForm` already has the full 20-field Section A+B form
- `AdminPipelinePage` already uses sequential fetch with `name — email` in dropdown

**What's broken / missing:**

1. **`create-case-from-apply`** only saves `full_name`, `phone_number` — drops city, education, passport, english_units, math_units entirely. Apply page sends them but edge function ignores them. Cases table is also missing those columns.

2. **`PaymentConfirmationForm`** sets status → `submitted` directly (correct), but the **AdminSubmissionsPage** queries `cases` table but the `AdminSubmissionsPage` has a bug: it queries `cases` table not `student_cases`, but the `cases` table IS the right table. The real issue is `PaymentConfirmationForm` sets `submitted_at` and `payment_confirmed` on `case_submissions` but moves case status to `submitted` — this IS correct. Let me verify the flow: payment_confirmed → submitted (team side) → admin sees it in submissions → marks enrollment_paid. This appears to work. The confusion in the audit doc was about a `cases` vs old `student_cases` mismatch. The current code is correct.

3. **Team manual case creation modal** in `TeamCasesPage` doesn't require an appointment — it creates a case with status `new` and only 2 fields. Per spec it should require an appointment and create with `appointment_scheduled` status.

4. **`AppointmentOutcomeModal`** is English-only (hardcoded strings, no i18n), and while it calls the edge function, there's no clear "Complete Profile" CTA after `completed` outcome is recorded — the user just gets toast and refreshes.

5. **Duplicate phone detection** — not implemented anywhere.

6. **Cases table missing columns**: `city`, `education_level`, `bagrut_score`, `english_level`, `math_units`, `passport_type`, `degree_interest`, `intake_notes`.

7. **`create-case-from-apply`** edge function doesn't save extended fields.

8. **`ProfileCompletionForm`** doesn't pre-fill from `cases` table columns — it reads from `case_submissions.extra_data` only.

9. **SLA visual indicators** — `AdminPipelinePage` already shows stale cards (days ≥ 3 for new, ≥ 5 for contacted) with `AlertTriangle` but doesn't cover all SLA thresholds (14 days for appointment_scheduled, 7 days for profile_completion).

10. **Database trigger for status change audit** — not yet created.

11. **Arabic translations** for team dashboard — partially missing. `AppointmentOutcomeModal` is entirely hardcoded English.

12. **`PaymentConfirmationForm`** — the "two-stage" spec (first confirm payment received → then separately submit to admin) is collapsed into one step. Per audit, these should be two steps: `payment_confirmed` then `submitted`.

13. **Case detail page** `appointment_scheduled` block shows next action but if there's no appointment (edge case), the action block goes blank. Need to handle `appointment_scheduled` with no upcoming appointments.

14. **RLS on cases for team members** — currently team members can see ALL cases via `has_role(team_member)`. The RLS policy needs restricting to only `assigned_to = auth.uid()` OR source = manual.

---

## Implementation Plan — Phased

### PHASE 1 — Database Schema (Migration)

**Migration: Add columns to `cases` table**
```sql
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS bagrut_score numeric,
  ADD COLUMN IF NOT EXISTS english_level text,
  ADD COLUMN IF NOT EXISTS math_units integer,
  ADD COLUMN IF NOT EXISTS passport_type text,
  ADD COLUMN IF NOT EXISTS degree_interest text,
  ADD COLUMN IF NOT EXISTS intake_notes text;
```

**Migration: Fix RLS on cases for team_member role**
```sql
DROP POLICY IF EXISTS "Team can manage cases" ON public.cases;

CREATE POLICY "Team can manage assigned cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'team_member'::app_role) AND (
      assigned_to = auth.uid() OR
      source IN ('manual', 'submit_new_student')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'team_member'::app_role)
  );
```

**Migration: Database trigger for audit logging**
```sql
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'system',
      'status_changed_to_' || NEW.status,
      'case',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cases_status_change_trigger
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();
```

---

### PHASE 2 — Edge Function: `create-case-from-apply`

Update `supabase/functions/create-case-from-apply/index.ts` to:
1. Accept and save all new fields: `city`, `education_level`, `bagrut_score`, `english_level`, `math_units`, `passport_type`, `degree_interest`, `intake_notes`
2. Add duplicate phone detection: check `cases` table for existing `phone_number` before inserting → return `{ duplicate: true, case_id: existing_id }` with HTTP 409 if found
3. Add input validation: phone regex, name max 100 chars, strip HTML
4. Accept honeypot field — silently discard if present

Update `ApplyPage.tsx` to:
1. Pass all collected fields to the edge function call
2. Handle 409 duplicate response → show "We already have your application on file"

---

### PHASE 3 — Team Manual Case Creation Flow

**Update `TeamCasesPage.tsx`** — Expand the "New Case" modal to:
- Section 1: Full name + phone (with duplicate check on blur)
- Section 2: **Required appointment datetime** (date + time picker using `<Input type="datetime-local">`)
- On submit: Create case with `status: 'appointment_scheduled'` + simultaneously `INSERT` into `appointments` table
- If duplicate phone found: show warning modal with option to view existing case or create anyway
- Validation: show error "You must schedule an appointment to create a case" if datetime empty

---

### PHASE 4 — PaymentConfirmationForm Split (2-stage)

Per spec, the case should go through 2 distinct stages:

**Stage 1: `profile_completion` → `payment_confirmed`**
In `CaseDetailPage`, add a new action section for `payment_confirmed` status that currently shows `PaymentConfirmationForm`. The form should first **only confirm payment receipt** (service fee + translation fee + checkbox "I confirm payment received") → moves status to `payment_confirmed`.

**Stage 2: `payment_confirmed` → `submitted`** 
A separate "Submit to Admin" button appears after payment is confirmed. Clicking it shows a confirmation dialog: "Have you reviewed all profile data? This will send the case to admin for enrollment." On confirm → status moves to `submitted`.

**Update `PaymentConfirmationForm`** to only set `payment_confirmed = true` and `status = 'payment_confirmed'` (not jump to `submitted`).

**Add new `SubmitToAdminButton` inline** in `CaseDetailPage` for the `payment_confirmed` status block.

---

### PHASE 5 — AppointmentOutcomeModal i18n + UX

**Update `AppointmentOutcomeModal.tsx`**:
- Add Arabic labels for all outcomes and buttons
- After recording `completed` outcome: instead of just toast + close, immediately navigate to the case detail page with the profile form shown (or trigger `onSuccess` and let `CaseDetailPage` reflect `profile_completion` status)
- The status update happens inside `record-appointment-outcome` edge function (already moves to `profile_completion` on `completed` outcome) — verify this is correct

---

### PHASE 6 — SLA Enhancements

**Update `AdminPipelinePage.tsx`** to extend SLA thresholds:
- `new` + `contacted`: ≥ 3 days / ≥ 5 days (already done)  
- `appointment_scheduled`: ≥ 14 days → red border  
- `profile_completion`: ≥ 7 days → orange border  
- Add SLA breach count to `AdminCommandCenter`

---

### PHASE 7 — ProfileCompletionForm Pre-fill from `cases`

**Update `CaseDetailPage.tsx`** to:
- Fetch `cases.*` (including new columns: city, education_level, etc.)
- Pass those as `existingData` to `ProfileCompletionForm`

**Update `ProfileCompletionForm`** props interface to accept `caseData` (the full cases row) and pre-fill:
- `city` → city field in section A
- `education_level` → populate education dropdown
- `passport_type` → populate passport dropdown
- `math_units`, `english_level` → populate number fields
- These are pre-filled but editable

---

### PHASE 8 — Translation Completeness

**Update `public/locales/en/dashboard.json`** and **`public/locales/ar/dashboard.json`** with:
- All team tab labels
- All case status labels (human-readable)
- All action button strings
- AppointmentOutcomeModal labels in Arabic

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/` | Add cases columns + fix RLS + add audit trigger |
| `supabase/functions/create-case-from-apply/index.ts` | Save all fields + duplicate detection + validation |
| `src/pages/ApplyPage.tsx` | Pass all fields to edge fn + handle 409 duplicate |
| `src/pages/team/TeamCasesPage.tsx` | Expand new case modal: appointment required, duplicate check, status = appointment_scheduled |
| `src/components/team/PaymentConfirmationForm.tsx` | Split into 2 stages: payment_confirmed only (not submitted) |
| `src/pages/team/CaseDetailPage.tsx` | Add "Submit to Admin" stage, pre-fill ProfileCompletionForm from cases row, fetch new columns |
| `src/components/team/AppointmentOutcomeModal.tsx` | Full i18n, improved UX after completed outcome |
| `src/pages/admin/AdminPipelinePage.tsx` | Extended SLA thresholds (14d appt, 7d profile) |
| `src/pages/admin/AdminCommandCenter.tsx` | Add SLA breach count card |
| `public/locales/en/dashboard.json` | Missing translation keys |
| `public/locales/ar/dashboard.json` | Arabic translations for all new/missing keys |

---

## Execution Order

```
1. DB migration: add cases columns + fix RLS + audit trigger
2. Update create-case-from-apply edge function
3. Update ApplyPage to pass all fields + handle duplicate
4. Expand TeamCasesPage new case modal (appointment required)
5. Split PaymentConfirmationForm into 2 stages
6. Update CaseDetailPage (Submit to Admin stage + pre-fill)
7. Update AppointmentOutcomeModal (i18n)
8. Extend SLA thresholds in AdminPipelinePage
9. Add SLA count to AdminCommandCenter
10. Add missing translation keys (en + ar)
```

---

## What This Does NOT Change (already correct per audit)

- Admin Submissions page logic — already queries `cases WHERE status = 'submitted'` correctly
- TeamCasesPage visibility restrictions — already restricts "All" tab
- AdminPipelinePage team member sequential fetch — already fixed
- ProfileCompletionForm 20-field form — already complete
- Status code canonical set — already aligned across all files
- DashboardLayout nav items — already clean
