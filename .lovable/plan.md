

# Master Implementation Plan: Darb Study System Stabilization and Enhancement

This plan covers 8 stages of improvements across UI cleanup, functionality fixes, PDF/export corrections, referral enhancements, eligibility validation, activity log UX, student account creation, and final testing.

---

## STAGE 1 -- UI Cleanup and Naming Consistency

### 1.1 Rename "Lawyer Dashboard" to "Team Dashboard"

The component is already named `TeamDashboardPage` internally, and translation keys already use `lawyer.title = "لوحة الفريق"`. However, the following residual references need cleanup:

**Changes required:**

| File | What to Change |
|------|---------------|
| `src/App.tsx` | Rename `LawyerDashboardPage` import variable to `TeamDashboardPage`. Keep both `/lawyer-dashboard` and `/team-dashboard` routes pointing to the same component for backward compatibility. |
| `src/pages/StudentAuthPage.tsx` | Change `navigate('/lawyer-dashboard')` to `navigate('/team-dashboard')` in the `redirectByRole` function. |
| `src/pages/LawyerDashboardPage.tsx` | Rename file to `TeamDashboardPage.tsx`. No internal code changes needed (component already named `TeamDashboardPage`). |
| `public/locales/en/dashboard.json` | Rename the `"lawyer"` key group to `"team"` (e.g., `lawyer.title` becomes `team.title`). Update all `t('lawyer.xxx')` references in the component. |
| `public/locales/ar/dashboard.json` | Same key rename from `"lawyer"` to `"team"`. |

**Note:** All `t('lawyer.xxx')` calls across the codebase must be updated to `t('team.xxx')`.

### 1.2 Fix Desktop Table Width Cutoff

Admin dashboard tables are constrained. Changes needed:

| File | Fix |
|------|-----|
| `src/components/admin/AdminLayout.tsx` | Ensure `<main>` uses `overflow-x-auto` and remove any `max-w-*` restrictions. Currently the main area has `flex-1 p-4 md:p-6 lg:p-8` -- add `overflow-x-auto min-w-0`. |
| `src/components/admin/LeadsManagement.tsx` | Wrap the desktop table in `<div className="overflow-x-auto w-full">` and ensure table uses `min-w-full` instead of `w-full`. |
| `src/components/admin/CasesManagement.tsx` | Same table wrapper fix. |
| `src/components/admin/ReferralManagement.tsx` | Same table wrapper fix. |
| `src/components/admin/PayoutsManagement.tsx` | Same table wrapper fix. |
| `src/components/admin/AuditLog.tsx` | Same table wrapper fix. |

---

## STAGE 2 -- Case Assignment and Team Functionality Fixes

### 2.1 Team Member Assignment Dropdown Not Showing Names

**Root cause:** In `AdminDashboardPage.tsx`, `lawyers` are fetched from `user_roles` filtered by `role === 'lawyer'`, but the result only contains `user_id` and `role` -- no `full_name`. The `lawyers` prop sent to `LeadsManagement` expects `{ id, full_name }`.

**Fix:**
- In `AdminDashboardPage.tsx`, after fetching lawyer role records, join with `profiles` to get `full_name`:

```text
1. Fetch user_roles where role = 'lawyer' -> get user_ids
2. Fetch profiles for those user_ids -> get full_name
3. Map to { id, full_name } array
```

This is already partially done (lines 92-93 + 118-120 of AdminDashboardPage). Need to verify and trace the data flow to `LeadsManagement`.

### 2.2 Double Confirmation Before "Ready to Register"

When a team member changes case status to `ready_to_apply` in `LawyerDashboardPage.tsx`:

**Changes:**
- Add a confirmation `AlertDialog` in `LawyerDashboardPage.tsx`
- In the `saveCase` function, intercept the status change: if the new status is `ready_to_apply`, show the confirmation modal first
- Only proceed with the database update after the user confirms
- Log the confirmation action in `admin_audit_log`

---

## STAGE 3 -- PDF and Export Fixes

### 3.1 Fix Arabic Encoding in PDF

The uploaded screenshot shows garbled Arabic characters in PDF headers. The issue is that `jspdf` uses its default font which does not support Arabic glyphs.

**Fix in `src/utils/exportUtils.ts`:**
- Download and embed an Arabic-supporting font (Amiri or Tajawal) as a base64-encoded string
- Register the font with jsPDF: `doc.addFileToVFS()` and `doc.addFont()`
- Set the font before rendering: `doc.setFont('Tajawal')`
- Enable RTL text alignment for Arabic content

This is a significant change -- the font file (base64) will need to be stored in a utility file (e.g., `src/utils/arabicFont.ts`).

### 3.2 Change PDF Title from "Darb Study" to "Darb Study International"

**Fix in `src/utils/exportUtils.ts`:**
- The `title` parameter is passed by callers, not hardcoded in the utility. Need to update each export call site:
  - `LeadsManagement.tsx` -- update the title passed to `exportPDF`
  - `CasesManagement.tsx` -- update the title
  - Any other export call sites

### 3.3 Allow PDF Download of Payouts/Rewards

**Fix in `src/components/admin/PayoutsManagement.tsx`:**
- Add a PDF export button alongside the existing CSV export
- Call `exportPDF()` with payout data columns (requester, role, amount, status, date, payment method)

---

## STAGE 4 -- Referral and Influencer System Enhancements

### 4.1 Add Phone Column to Referral Table

The `referrals` table already has a `referred_phone` column in the database.

**Fix in `src/components/admin/ReferralManagement.tsx`:**
- Add phone column header to both mobile and desktop table views
- Display `r.referred_phone` in the table
- Add phone to CSV export
- Add translation keys for the phone column label

### 4.2 Auto-Generate Case from Referral

When a referral status changes to `enrolled`, automatically create a `student_case` linked to the lead.

**Fix in `src/components/admin/ReferralManagement.tsx`:**
- In the `updateStatus` function, when `newStatus === 'enrolled'`:
  1. Look up the lead by matching `referred_phone` in the `leads` table
  2. If a lead exists and no case exists for it yet, auto-create a `student_case`
  3. Copy name, phone, city, eligibility data from the lead

### 4.3 Influencer Leads Visibility

Already working correctly:
- Influencer links use `?ref={userId}` 
- `ApplyPage.tsx` detects this and sets `source_type='influencer'`
- The RLS policy on `leads` allows influencers to view leads where `source_id = auth.uid()`

No changes needed.

### 4.4 Apply Page Companion Registration

Currently the companion section only asks for name and phone. The user wants the companion to fill out the FULL form.

**Fix in `src/pages/ApplyPage.tsx`:**
- When "Register a friend/family" is toggled, show a complete duplicate of the form fields (passport, education, english units, math units, german level, preferred major)
- Update the RPC call to pass companion eligibility data
- This requires updating the database function `insert_lead_from_apply` to accept companion eligibility fields

**Database migration:** Update the 16-parameter version of `insert_lead_from_apply` to accept companion eligibility parameters (passport, english_units, math_units, education_level, german_level, preferred_major).

### 4.5 Influencer Conversion Funnel Fix

The funnel in `InfluencerDashboardPage.tsx` (lines 242-257) already calculates percentages correctly:
- `totalClients` = 100% (baseline)
- `eligible` = `eligibleLeads / totalLeads * 100`
- `converted` = `totalConverted / totalLeads * 100`
- `paid` = `paidStudents / totalLeads * 100`

The "fully blue bar" issue occurs when `totalLeads` equals the count for that stage (100%). This is correct behavior when all leads are at that stage. If the user only has 1 lead, ALL bars show 100%.

**No code change needed** -- the logic is mathematically correct. The visual appearance is expected when sample size is small.

---

## STAGE 5 -- Eligibility Engine Review

The `EligibilityConfig.tsx` component manages weights stored in the `eligibility_config` table. The default weights sum to:

```text
passport_valid: 15 + proof_of_funds: 15 + language_level: 10 + education_level: 10 +
no_visa_rejection: 10 + age_range: 5 + motivation: 10 + course_alignment: 10 +
verified_contact: 10 + arab48_flag: 5 = 100
```

The component already shows a warning when weights do not sum to 100 (translation key: `admin.eligibility.weightWarning`).

**Fix:** Add a validation guard to prevent saving when the total is not exactly 100:
- In `EligibilityConfig.tsx`, disable the "Save" button when `totalWeight !== 100`
- Add a clear error message when attempting to save with incorrect total

---

## STAGE 6 -- Activity Log Scrollable Container

**Fix in `src/components/admin/AuditLog.tsx`:**
- Wrap the table in a scrollable container with fixed max height:

```text
<div className="max-h-[600px] overflow-y-auto">
  <table> ... </table>
</div>
```

- Add `sticky top-0` to the `<thead>` so headers remain visible during scroll
- This prevents the page from becoming extremely long with many log entries

---

## STAGE 7 -- Student Account Creation System

### 7.1 The system already exists

The edge function `create-student-account` already:
- Accepts `case_id`, `email`, `full_name`
- Verifies the caller is an admin
- Creates an auth user with temp password
- Assigns `user` role
- Sets `must_change_password: true`
- Links the student to the case

The UI for this is in `ReadyToApplyTable.tsx` with a "Create Student Account" button.

### 7.2 Add Team Member Access to Account Creation

Currently only admins can create student accounts. The edge function checks for `admin` role only.

**Changes needed:**

| File | Change |
|------|--------|
| `supabase/functions/create-student-account/index.ts` | Update the role check to allow both `admin` AND `lawyer` (team member) roles |
| `supabase/functions/create-team-member/index.ts` | Already admin-only -- keep as-is |
| `src/pages/LawyerDashboardPage.tsx` (renamed to `TeamDashboardPage.tsx`) | Add a "Create Student Account" button visible on the team dashboard for cases at `ready_to_apply` status |

**Security enforcement:**
- Students cannot access `create-student-account` endpoint (server-side role check)
- Frontend UI hides the button from student dashboards
- The edge function validates the role server-side -- no client-side bypass possible

---

## STAGE 8 -- Final Review and System Testing

After all changes are implemented:

1. **Authentication**: Test login for admin, team member, influencer, and student roles
2. **Role permissions**: Verify students cannot access admin/team endpoints
3. **Referral tracking**: Confirm influencer attribution and auto-case generation
4. **PDF exports**: Verify Arabic renders correctly with embedded font
5. **UI**: Confirm tables stretch full width on desktop
6. **Confirmation modals**: Verify double confirmation for "Ready to Register"
7. **Activity log**: Verify scrollable container with sticky headers
8. **Eligibility engine**: Verify weights sum validation

---

## Implementation Priority Order

| Priority | Stage | Effort |
|----------|-------|--------|
| 1 | Stage 1.1: Rename Lawyer to Team | Medium (many files) |
| 2 | Stage 2.1: Fix team member assignment dropdown | Small |
| 3 | Stage 3.1: Fix Arabic PDF encoding | Large (font embedding) |
| 4 | Stage 1.2: Fix desktop table width | Small |
| 5 | Stage 2.2: Double confirmation modal | Small |
| 6 | Stage 4.1: Phone column in referrals | Small |
| 7 | Stage 3.2: PDF title change | Small |
| 8 | Stage 3.3: Payouts PDF export | Small |
| 9 | Stage 6: Activity log scrollable | Small |
| 10 | Stage 5: Eligibility save guard | Small |
| 11 | Stage 4.4: Full companion form | Medium |
| 12 | Stage 7.2: Team member account creation | Medium |
| 13 | Stage 4.2: Auto-case from referral | Medium |

---

## Files to be Modified

```text
src/pages/LawyerDashboardPage.tsx -> renamed to TeamDashboardPage.tsx
src/pages/StudentAuthPage.tsx
src/App.tsx
src/utils/exportUtils.ts (+ new src/utils/arabicFont.ts)
src/components/admin/AdminLayout.tsx
src/components/admin/LeadsManagement.tsx
src/components/admin/CasesManagement.tsx
src/components/admin/ReferralManagement.tsx
src/components/admin/PayoutsManagement.tsx
src/components/admin/AuditLog.tsx
src/components/admin/EligibilityConfig.tsx
src/pages/AdminDashboardPage.tsx
src/pages/InfluencerDashboardPage.tsx
src/pages/ApplyPage.tsx
supabase/functions/create-student-account/index.ts
public/locales/ar/dashboard.json
public/locales/en/dashboard.json
+ 1 database migration (companion fields in RPC)
```

