

## DSOS v4 -- Comprehensive Upgrade Plan

This is a large set of changes spanning the apply funnel, all four dashboards, eligibility logic, team member management, and the 20-day payout timer. The plan is broken into focused phases to keep each change safe and testable.

---

### Phase 1: Apply Page Overhaul (Form Fields + Auto-Eligibility)

**What changes on `/apply`:**

- **Remove fields**: Budget Range, Preferred City in Germany, Accommodation
- **Add fields**: Passport Type (dropdown: Israeli Blue / Israeli Red / Other), English Units (number), Math Units (number)
- **Remove WhatsApp floating button** (protects influencer attribution)
- **Add auto light/dark mode** based on time of day (dark after 7pm)
- **Update form steps**:
  - Step 1: Full Name, Phone
  - Step 2: Passport Type, English Units, Math Units, Education Level
  - Step 3: German Level (simplified: Beginner / Intermediate / Advanced)

**Database changes (leads table)**:
- Add columns: `passport_type` (text), `english_units` (integer), `math_units` (integer)
- Remove from form only (keep columns in DB for backward compatibility): budget_range, preferred_city, accommodation

**Auto-Eligibility Calculation**:
- New database function `calculate_eligibility_score` that runs inside `insert_lead_from_apply`:
  - Passport = Israeli Blue: +30 points
  - Passport = Israeli Red: +20 points
  - Passport = Other: 0 points
  - English units >= 4: +20 points
  - Math units >= 4: +20 points
  - Education = Bagrut/Highschool+: +10 points
  - German level Intermediate+: +10 points
  - Score >= 50: status remains "new" (eligible candidate)
  - Score < 30: auto-set status to "not_eligible"
- Store computed `eligibility_score` and `eligibility_reason` (text, new column) on the lead

**Update the RPC function** `insert_lead_from_apply` to accept new fields and call eligibility calculation.

---

### Phase 2: Team Member (Lawyer) Management

**Current state**: The admin can create influencer accounts via `create-influencer` edge function. No equivalent exists for lawyers.

**What to build**:
- **New edge function**: `create-team-member` -- accepts `email`, `full_name`, and `role` (lawyer or influencer)
  - Creates auth user with temp password
  - Assigns role in `user_roles`
  - Creates profile
  - Logs to audit
  - Same forced password change pattern as influencers
- **Update `InfluencerManagement.tsx`** to become a general "Team Management" component:
  - Rename section to "Team" in sidebar
  - Add a role selector (Influencer / Lawyer) in the create dialog
  - Show both influencers AND lawyers in the same table with a role badge
  - Admin can delete invites
- **Update `AdminLayout.tsx`**: Replace "Influencers" with "Team" in sidebar, update icon

**Forced Password Change on First Login**:
- Add `must_change_password` column to `profiles` (boolean, default false)
- Set to `true` when creating team members via edge function
- In `StudentAuthPage.tsx`, after successful login, check `must_change_password` -- if true, show a password change modal before redirecting
- After password changed, update profile `must_change_password = false`

---

### Phase 3: Influencer Dashboard Eligibility Display

**Current state**: Influencer dashboard shows leads with basic status badges but no eligibility reasoning.

**What to add**:
- On each lead card, show eligibility result:
  - Green checkmark + "Eligible" if score >= 50
  - Red X + reason if not eligible (e.g., "Passport type: Other", "English units: 2 (minimum 4)")
- Show `eligibility_score` as a small badge on each card
- Display `eligibility_reason` text below the status

**20-Day Payout Timer**:
- In `EarningsPanel.tsx`, for each reward with status `approved`:
  - Calculate days since the associated case was marked `paid`
  - If < 20 days: show countdown timer, disable payout request button
  - If >= 20 days: enable payout request
- Add `paid_at` timestamp to `student_cases` table (set when case_status changes to 'paid')
- Update the payout request logic to check the 20-day condition server-side

---

### Phase 4: Lawyer Dashboard Enhancements

**Current state**: Lawyers can view/edit assigned cases with status, city, school, notes.

**What to add**:
- Show auto-eligibility info on each case card (read-only, from lead data)
- Fetch lead's `eligibility_score` and `eligibility_reason` alongside case data
- Add `contact_form` source badge to help lawyers see lead origin
- Lawyer RLS: Allow lawyers to SELECT from leads table for their assigned cases (new policy)

---

### Phase 5: Admin Enhancements

**Export functionality**:
- Add "Export" button to LeadsManagement and CasesManagement
- Generate CSV with selectable columns
- Pre-formatted for language school submissions

**Admin eligibility override**:
- In LeadsManagement, add an "Override Score" button that lets admin manually set eligibility_score and status
- Log override to audit trail

**Delete invites**:
- In InfluencerManagement (now TeamManagement), add delete button on invite rows
- Delete from `influencer_invites` table

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Migration | Database | Add `passport_type`, `english_units`, `math_units`, `eligibility_reason`, `paid_at` columns; update `insert_lead_from_apply` RPC; add `must_change_password` to profiles |
| Edit | `src/pages/ApplyPage.tsx` | New form fields, remove old fields, remove WhatsApp button, add dark mode |
| Create | `supabase/functions/create-team-member/index.ts` | Generic team member creation (influencer or lawyer) |
| Edit | `src/components/admin/InfluencerManagement.tsx` | Rename to TeamManagement, add role selector, show lawyers, delete invites |
| Edit | `src/components/admin/AdminLayout.tsx` | Update sidebar label |
| Edit | `src/pages/AdminDashboardPage.tsx` | Update component references |
| Edit | `src/pages/InfluencerDashboardPage.tsx` | Add eligibility display per lead card |
| Edit | `src/components/influencer/EarningsPanel.tsx` | Add 20-day timer logic |
| Edit | `src/pages/LawyerDashboardPage.tsx` | Show eligibility info on cases |
| Edit | `src/pages/StudentAuthPage.tsx` | Add forced password change check |
| Edit | `src/components/admin/LeadsManagement.tsx` | Add eligibility override, export button |
| Edit | `src/components/admin/CasesManagement.tsx` | Add export button |

### Implementation Order
1. Database migration (new columns + updated RPC with eligibility calculation)
2. Apply page form overhaul
3. Team member edge function + management UI
4. Forced password change flow
5. Influencer dashboard eligibility + 20-day timer
6. Lawyer dashboard enhancements
7. Admin export and override features

