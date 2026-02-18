
# Stage 3 — Polish & Pre-Launch Features (Items 11–19)

## Scope Overview

9 items across 4 categories:
- **UI/UX features**: #11 (workflow mirror), #12 (admin notes), #13 (reassign), #17 (sort), #18 (WhatsApp)
- **Bug fixes**: #14 (email), #15 (account deletion), #16 (fraud thresholds)
- **DB hardening**: #19 (referral link uniqueness)

---

## Item-by-Item Analysis

### #11 — Influencer Workflow Mirror (Show case_status in student cards)

**Root cause**: The student card in `InfluencerDashboardPage.tsx` (lines 231–265) shows only a static Eligible/Ineligible/Paid badge. It does NOT show what stage the team member is at (e.g. "Contacted", "Appointment Scheduled").

**The data is already fetched**: `cases` array is already in scope via `useDashboardData`. Each case has `case_status` and `paid_at`.

**Fix**: In the student card render loop, compute `linkedCase.case_status` and display it as an Arabic/English status chip. Only show this for influencer-referred cases (which they all are on this dashboard). Already real-time via `useRealtimeSubscription('student_cases', refetch, authReady)` — so no extra subscription needed.

**Status map (Arabic)**:
```
assigned → "قيد المراجعة"
contacted → "تم التواصل"
appointment_scheduled → "موعد مجدوّل"
appointment_completed → "تم الموعد"
profile_filled → "تم ملء الملف"
paid → "مدفوع ✓"
visa_stage → "مرحلة التأشيرة"
completed → "مكتمل ✓"
```

**File**: `src/pages/InfluencerDashboardPage.tsx`

---

### #12 — Admin Notes Before Assignment

**Currently**: No `admin_notes` column on `student_cases`. The assign flow in `LeadsManagement.tsx` creates the case via a direct `INSERT` into `student_cases`.

**DB Change needed**: Add `admin_notes text` column to `student_cases`.

**UI Change**: In the `LeadsManagement` assignment modal (the Dialog where admin selects a lawyer), add a `<Textarea>` for "Internal Notes" above the lawyer Select. On submit, pass the notes value in the INSERT.

**Team Dashboard visibility**: In `TeamDashboardPage.tsx`, in the case card or expanded view, show `admin_notes` as a highlighted info box (only if non-empty). This requires no data fetch changes — `admin_notes` will be returned as part of `student_cases SELECT *`.

**Files**: 
- DB migration: `ALTER TABLE student_cases ADD COLUMN admin_notes text`
- `src/components/admin/LeadsManagement.tsx`
- `src/pages/TeamDashboardPage.tsx`

---

### #13 — Reassign Case Feature (Team → Team)

**New feature**: A team member can reassign their case to another team member.

**DB Changes needed**:
- Add `reassigned_from uuid` (previous lawyer ID) to `student_cases`
- Add `reassignment_notes text` to `student_cases`
- Add `reassignment_history jsonb[]` (array of `{from, to, at, by, notes}`) to track full log

**UI**: In `TeamDashboardPage.tsx`, in the case card action bar (visible in "All" tab), add a "Reassign" button that opens a small Dialog:
- Shows current assignee
- Select dropdown with other team members (fetched from `user_roles` WHERE `role = 'lawyer'`)
- Optional notes field
- On confirm: `UPDATE student_cases SET assigned_lawyer_id = newId, reassigned_from = oldId, reassignment_notes = notes, reassignment_history = array_append(...)`

**Team visibility**: The new assignee sees the case in their dashboard normally. The case card shows a badge "Assigned from [Name]" when `reassigned_from` is set.

**Files**:
- DB migration
- `src/pages/TeamDashboardPage.tsx`

---

### #14 — Reset Password Email Not Working

**Current state**: Supabase Auth handles password reset emails natively (via SMTP settings in dashboard). The app has `ResetPasswordPage.tsx`.

**Most likely root cause**: The `emailRedirectTo` in `supabase.auth.resetPasswordForEmail()` points to `window.location.origin` which in production resolves to the **published** URL but in development may point to localhost. Additionally, the **Supabase auth email redirect URL** whitelist may not include the published domain (`darb-agency.lovable.app` and `darb.agency`).

**Fix**:
1. Audit `ResetPasswordPage.tsx` and `StudentAuthPage.tsx` — check the `emailRedirectTo` parameter
2. The redirect URL must be set to the production URL: `https://darb-agency.lovable.app/reset-password`
3. This URL must be in the **allowed redirect URLs** in Supabase Auth settings
4. For edge function emails (status updates, lead notifications): verify `send-event-email` and `send-branded-email` edge functions are deployed and have correct secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

**File**: `src/pages/StudentAuthPage.tsx` — update `emailRedirectTo`

---

### #15 — Account Deletion (Hard Delete)

**Current state**: No hard delete exists. Student dashboard has a profile section but no deletion option.

**Flow**:
1. User clicks "Delete Account Permanently" in their profile settings
2. AlertDialog with typed confirmation ("DELETE" to confirm)
3. Backend call: Edge function `delete-account` that:
   - Uses `service_role_key` to call `supabase.auth.admin.deleteUser(userId)`
   - Cascades via `ON DELETE CASCADE` on `profiles` (already set in DB via trigger)
   - Cancels any pending rewards and commissions linked to this user
   - Removes from `user_roles`
   - Removes leads where `source_id = userId` (influencer deletion) OR marks them organic

**DB**: The `profiles` table has `id` as PK. `auth.users` has `ON DELETE CASCADE` to `profiles`. However, `rewards.user_id`, `payout_requests.requestor_id`, `user_roles.user_id` all have FK to `auth.users` with `ON DELETE CASCADE` — meaning deleting the auth user cascades correctly.

**The `leads.source_id`** is NOT a FK to auth users — it's a plain uuid. So deleting the auth user won't null out leads' `source_id`. The edge function must explicitly `UPDATE leads SET source_id = NULL, source_type = 'organic' WHERE source_id = userId`.

**New edge function**: `supabase/functions/delete-account/index.ts`

**UI**: Add "Danger Zone" section to `StudentProfile.tsx` with the delete button + AlertDialog.

**Files**:
- `supabase/functions/delete-account/index.ts` (new)
- `src/components/dashboard/StudentProfile.tsx`

---

### #16 — Fraud Detection Calibration

**Current state**: `leads.fraud_flags` is a `text[]` column. Looking at `SecurityPanel.tsx`, it reads fraud-flagged leads.

**What's wrong**: The fraud detection logic (wherever it runs) flags leads when multiple come from the same `source_id`. But for influencers, many leads from the same `source_id` is expected and normal.

**Fix**: The fraud detection runs in `SecurityAuditPanel.tsx` or similar. Need to:
1. Change the "same source_id = fraud" logic to: only flag if `source_type = 'organic'` (multiple from same IP/device) but NOT when `source_type = 'influencer'`
2. Ensure `fraud_flags` contains a human-readable reason (e.g., "Duplicate phone: +972...") so admins understand why a lead was flagged
3. Add an "unflag" action for false positives

**Files**: `src/components/admin/SecurityAuditPanel.tsx` and/or `src/components/admin/SecurityPanel.tsx`

---

### #17 — Team Performance — Sort by Lead Count

**Location**: The influencer/team performance table is in `InfluencerManagement.tsx` (the "Team" tab in admin).

**Fix**: In the performance table that renders influencer or team member stats, sort the array by lead count descending before rendering:
```typescript
const sorted = [...influencers].sort((a, b) => (b.leadCount ?? 0) - (a.leadCount ?? 0));
```

This is a pure frontend sort — no DB changes needed. The lead counts are derived from `leads.source_id` matching each influencer's ID.

**File**: `src/components/admin/InfluencerManagement.tsx`

---

### #18 — WhatsApp Community After Application Submit

**Already partially done** in Stage 1 — `ApplyPage.tsx` was updated to include a WhatsApp button and auto-redirect on success. Need to verify it's working correctly and is mobile-optimized.

**Verification needed**: Check the current state of `ApplyPage.tsx` success screen. If the button/redirect is already there, just ensure:
- `window.open` target is `_blank` (correct)
- Button uses `whatsapp://` deep link on mobile: `https://wa.me/join/...` or `https://chat.whatsapp.com/...` both work in mobile browsers
- Button is prominently styled (green, full width)

**File**: `src/pages/ApplyPage.tsx` — verify, no changes likely needed

---

### #19 — Influencer Link Protection & Uniqueness

**Current state**: The referral link is `{origin}/apply?ref={userId}` — derived from the user's UUID. UUID is already globally unique and tied to `auth.users`. It can never be duplicated or regenerated because it IS the user's ID.

**Verification**:
- `profiles.id` is the user's UUID (PK, unique by definition)
- `leads.source_id` stores this UUID — no duplicates possible at the referral level
- `user_roles` has `UNIQUE (user_id, role)` constraint

**DB Hardening**: Add a `UNIQUE` constraint on `leads.ref_code` (currently no unique constraint exists — confirmed from DB query). Also verify `profiles` has no duplicate `id` values.

**Additional protection**: Add a DB check that `user_roles` records for influencers can't be accidentally deleted without admin action (already covered by RLS — only admins can DELETE from `user_roles`).

**File**: DB migration to add `UNIQUE` constraint on `leads.ref_code`

---

## Files to Change

| # | File | Type of Change |
|---|------|----------------|
| 11 | `src/pages/InfluencerDashboardPage.tsx` | Add `case_status` workflow chip to student cards |
| 12 | DB migration | Add `admin_notes text` to `student_cases` |
| 12 | `src/components/admin/LeadsManagement.tsx` | Add notes textarea to assignment dialog |
| 12 | `src/pages/TeamDashboardPage.tsx` | Show admin_notes in case card |
| 13 | DB migration | Add `reassigned_from uuid`, `reassignment_notes text`, `reassignment_history jsonb` to `student_cases` |
| 13 | `src/pages/TeamDashboardPage.tsx` | Add Reassign button + Dialog |
| 14 | `src/pages/StudentAuthPage.tsx` | Fix `emailRedirectTo` to use production URL |
| 15 | `supabase/functions/delete-account/index.ts` | New edge function for hard delete |
| 15 | `src/components/dashboard/StudentProfile.tsx` | Add Danger Zone with delete button + AlertDialog |
| 16 | `src/components/admin/SecurityPanel.tsx` or `SecurityAuditPanel.tsx` | Fix fraud threshold — exempt influencer source |
| 17 | `src/components/admin/InfluencerManagement.tsx` | Sort performance table by lead count descending |
| 18 | `src/pages/ApplyPage.tsx` | Verify WhatsApp redirect already in place |
| 19 | DB migration | UNIQUE constraint on `leads.ref_code` |

## DB Migration Summary

Three migrations needed (can be combined):

```sql
-- Migration 1: student_cases additions for #12 and #13
ALTER TABLE student_cases
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reassigned_from uuid,
  ADD COLUMN IF NOT EXISTS reassignment_notes text,
  ADD COLUMN IF NOT EXISTS reassignment_history jsonb DEFAULT '[]'::jsonb;

-- Migration 2: referral link uniqueness for #19
ALTER TABLE leads
  ADD CONSTRAINT leads_ref_code_unique UNIQUE (ref_code);
```

## Sequencing

1. Run DB migrations first (schema changes)
2. Implement #17 (trivial sort — 1 line)  
3. Implement #11 (influencer workflow mirror — purely additive)
4. Implement #12 (admin notes — requires DB column first)
5. Implement #13 (reassign — requires DB columns first)
6. Implement #14 (email fix — config change)
7. Implement #15 (delete account — new edge function + UI)
8. Implement #16 (fraud calibration)
9. Verify #18 (WhatsApp — likely already done)
10. Verify #19 (uniqueness constraint applied in migration)

## No Breaking Changes

All DB changes are additive (new nullable columns). All UI changes are additive (new sections/buttons). The `reassignment_history` default is `[]` so existing cases are unaffected. The `leads.ref_code` unique constraint only fails if duplicates exist — need to verify none exist first (the `generate_lead_ref_code` trigger uses a sequence, guaranteeing uniqueness already, so the constraint should apply cleanly).
