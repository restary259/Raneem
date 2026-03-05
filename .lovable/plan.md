
## What Needs to Change

### Current state analysis:
1. **`create-student-from-case` edge function**: Creates user with `admin.createUser` + temp password and returns it in the response body. Uses `email_confirm: true` (immediate access). Sends back `temp_password` in JSON. The spec says: prefer `inviteUserByEmail` (magic link), fallback to temp password with copy button + WhatsApp deep link.

2. **`CaseDetailPage.tsx`**: Has no "Create Student Account" button/modal. The student account creation flow needs a button that opens a modal asking for email, calls the edge function, then shows credentials.

3. **`MyApplicationTab.tsx`**: Uses old `student_cases` table (via `student_profile_id`), old `case_payments` table (doesn't exist in new schema), old CASE_STEPS (`assigned`, `contacted`, `paid`, `ready_to_apply`, `visa_stage`, `completed`). **This is completely broken** — the new schema uses `cases` table with `student_user_id`, and the progress steps need to be the canonical statuses: `contacted → appointment_scheduled → profile_completion → payment_confirmed → submitted → enrollment_paid`.

4. **`StudentProfile.tsx`**: Currently all fields are editable. Spec says core fields (name, phone, passport, education) should be READ-ONLY for students — only agency-editable fields should be mutable.

5. **Profile pre-population**: When student account is created, the edge function already copies `full_name`, `phone_number` to the profile, but it doesn't copy `city`, `education_level`, `passport_type`, `degree_interest` from the cases table row.

### Plan:

**1. Update `create-student-from-case` edge function:**
- Switch to `supabaseAdmin.auth.admin.inviteUserByEmail()` instead of `createUser` + password. This sends a magic link email — student clicks it, sets their own password.
- If `inviteUserByEmail` fails (e.g., user already exists), fall back to temp password approach.
- When creating the profile, copy ALL case data: `city`, `education_level`, `passport_type`, `degree_interest`, `intake_notes` from the cases row.
- For fallback temp password: still return it in response (team member sees it once in UI).
- Remove `must_change_password` from invite flow (not needed since they set their own password on invite acceptance).

**2. Add "Create Student Account" UI to `CaseDetailPage.tsx`:**
- Add button in the page (visible when `status = 'profile_completion'` or above AND `student_user_id` is null).
- Modal with email input field + confirm.
- On success: if `inviteUserByEmail` → show "Invite sent to [email]" toast. If fallback (temp password returned) → show modal with temp password + Copy button + WhatsApp deep link.
- The WhatsApp message pre-filled in Arabic: `مرحبا [Name], إليك بيانات تسجيل الدخول لبوابة DARB: darb.agency/login | البريد: [email] | كلمة المرور المؤقتة: [password] | يرجى تغيير كلمة المرور عند أول دخول.`

**3. Fix `MyApplicationTab.tsx` completely:**
- Switch from `student_cases` to `cases` table, using `student_user_id = userId`.
- Update CASE_STEPS to canonical: `contacted`, `appointment_scheduled`, `profile_completion`, `payment_confirmed`, `submitted`, `enrollment_paid`.
- Fix appointments query to use `cases` → `appointments` via `case_id`.
- Remove broken `case_payments` table query (doesn't exist in new schema). Show `case_submissions` data instead (service_fee, program dates).
- Add i18n keys for new step names.

**4. Update `StudentProfile.tsx` — make core fields read-only:**
- Fields that are READ-ONLY (set by agency): `full_name`, `phone_number`, `city`, `education_level` (if exists in profile), passport fields.
- Fields students CAN edit: `gender`, `eye_color`, `has_changed_legal_name`, `previous_legal_name`, `has_criminal_record`, `criminal_record_details`, `has_dual_citizenship`, `second_passport_country`, `notes`.
- Show a notice: "Core profile fields are managed by the DARB team."
- Remove the agency-read-only fields from `handleSave` update payload.

**5. Update translation files:**
- Add `application.steps` keys for new canonical statuses in both `en/dashboard.json` and `ar/dashboard.json`.

### Files to change:
| File | Change |
|------|--------|
| `supabase/functions/create-student-from-case/index.ts` | Switch to `inviteUserByEmail`, copy all case fields to profile |
| `src/pages/team/CaseDetailPage.tsx` | Add "Create Student Account" button + email modal + credentials display |
| `src/components/dashboard/MyApplicationTab.tsx` | Fix table reference (`cases` not `student_cases`), fix CASE_STEPS to canonical statuses, fix submissions query |
| `src/components/dashboard/StudentProfile.tsx` | Make agency-collected fields read-only, show "managed by team" notice |
| `public/locales/en/dashboard.json` | Add new `application.steps.*` keys for canonical statuses |
| `public/locales/ar/dashboard.json` | Arabic translations for new step keys |

### No DB migration needed:
- `cases` table already has `student_user_id` column
- `profiles` table already has `city`, `phone_number`, `full_name`
- `appointments` table already links to `cases.id` via `case_id`
- `case_submissions` already exists

### Execution order:
1. Edge function update (invite flow + full profile pre-fill)
2. CaseDetailPage: Create Student Account button + modal + credentials display
3. MyApplicationTab: complete rewrite to use new schema + canonical statuses
4. StudentProfile: make core fields read-only
5. Translation keys

### Edge function invite flow detail:
```typescript
// Try inviteUserByEmail first
const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(student_email, {
  data: { full_name: student_full_name },
  redirectTo: 'https://darb-agency.lovable.app/student-auth'
});

if (inviteError) {
  // fallback: createUser with temp password
}
```
When invite succeeds: assign role, upsert profile with all case fields, link case. Return `{ success: true, invited: true }`.
When fallback: assign role, upsert profile, link case. Return `{ success: true, invited: false, temp_password: ... }`.

### CaseDetailPage additions:
- `showCreateAccountModal` state (boolean)
- `studentEmail` input state
- `tempPasswordResult` state (string | null) for fallback display
- Button: shows when `!caseData.student_user_id && ['profile_completion','payment_confirmed','submitted','enrollment_paid'].includes(caseData.status)`
- After creation: if `invited: true` → toast success. If `invited: false` → show credentials modal with:
  - Temp password in a code block
  - Copy button
  - WhatsApp link: `https://wa.me/?text=...`

### MyApplicationTab canonical steps:
```typescript
const CASE_STEPS = [
  'contacted',
  'appointment_scheduled',
  'profile_completion',
  'payment_confirmed',
  'submitted',
  'enrollment_paid',
] as const;
```
Query: `supabase.from('cases').select('*, case_submissions(*)').eq('student_user_id', userId).maybeSingle()`
Appointments: `supabase.from('appointments').select('*').eq('case_id', caseData.id).gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(3)`

### StudentProfile read-only changes:
- Wrap `full_name`, `phone_number`, `city` fields in a "read-only section" with lock icon.
- These fields still render but `disabled={true}` always (not toggled by `isEditing`).
- Remove them from `handleSave` payload.
- Add a small banner: "ℹ️ Core fields are managed by the DARB team and cannot be edited."
- Keep `isEditing` for the editable section (legal/visa fields, gender, eye color, notes).
