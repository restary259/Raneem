

# Fix Duplicate Tabs, Add Students Tab, Fix Assign Logic

## Problem Summary
1. **People group has 3 overlapping tabs**: "Team Members", "Influencers", and "Partners" all render variations of the same `InfluencerManagement` component. Partners also embeds InfluencerManagement again internally.
2. **No dedicated "Students" tab** to view student profiles, see who referred them (actual name, not just "agent"), and download their documents.
3. **"Cases" tab is redundant** -- Student Cases already covers this functionality.
4. **Assign Team Member button** only appears for `new` or `eligible` leads -- should work for any lead regardless of status/score.
5. **Referral source** shows generic "agent" or "organic" instead of the actual referrer's name.

---

## Changes

### 1. Restructure Sidebar (AdminLayout.tsx)

Consolidate the People group from 3 tabs to 3 distinct, non-overlapping tabs:
- **Team Members** -- team members only (role = lawyer), with commissions
- **Agents** -- influencers only (role = influencer), with commissions  
- **Students** (NEW) -- all student profiles, with referrer info + document access
- **Remove "Partners" tab** -- its content (referral management) moves into a sub-tab inside the Agents view

Replace the "Cases" tab in Pipeline with just "Leads" and "Student Cases" (remove the redundant "Cases" CasesManagement).

Updated sidebar structure:
- Dashboard: Overview, Analytics
- Pipeline: Leads, Student Cases
- People: Team Members, Agents, Students (NEW)
- Finance: Money Dashboard, Master Services
- System: Settings

### 2. Create StudentProfilesManagement Component (NEW)

New component: `src/components/admin/StudentProfilesManagement.tsx`

Features:
- Lists all profiles from the `profiles` table (students with `user` role)
- Columns: Name, Email, Phone, City, Status, Referred By (actual name), Registration Date, Actions
- **Referred By column**: Resolves `influencer_id` to actual profile name, or checks `leads` table `source_type`/`source_id` to show actual referrer name (not just "agent")
- **Click on student** opens a detail view with:
  - Personal info (name, email, phone, city)
  - Referral source (who sent them -- actual name + how: link/referral)
  - Documents list (fetched from `documents` table) with download buttons
- Filters: Search, Status, City, Referred By agent

### 3. Fix Assign Team Member (LeadsManagement.tsx)

Change line 237 from:
```
{(lead.status === 'new' || lead.status === 'eligible') && (
```
To:
```
{lead.status !== 'not_eligible' && (
```
This allows assigning a team member to any lead except those explicitly marked as not eligible. Even better, remove the condition entirely so admin can always assign regardless of status.

### 4. Fix Source Display in Student Profiles

When showing who referred a student:
- If `influencer_id` exists on profile, look up the influencer's `full_name` from the profiles/influencers array
- If lead has `source_type = 'influencer'` and `source_id`, resolve to actual influencer name
- If lead has `source_type = 'referral'`, look up the referral record to find `referrer_id` and resolve to actual referrer name
- Display format: "Agent: Ahmad Khalil" or "Referral: Sara M. (Family)" instead of just "agent"

### 5. Update Partners Tab to Referrals Sub-Tab

Move `ReferralManagement` into the Agents tab as a sub-tab (Agents + Referrals), since Partners was just a wrapper around InfluencerManagement + ReferralManagement anyway.

### 6. Remove Cases Tab

Remove the `cases` tab from the sidebar and its routing in `AdminDashboardPage.tsx`. Student Cases already handles this.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Remove "Partners" and "Cases" from sidebar, add "Students" to People group |
| `src/pages/AdminDashboardPage.tsx` | Add `students` tab routing to new component, remove `cases` and `partners` routing |
| `src/components/admin/StudentProfilesManagement.tsx` | **NEW** -- Student profiles with referrer resolution + document access |
| `src/components/admin/LeadsManagement.tsx` | Remove status restriction on Assign Team Member button |
| `src/components/admin/InfluencerManagement.tsx` | When `filterRole='influencer'`, add Referrals sub-tab using existing ReferralManagement |

---

## Technical Details

### Referrer Name Resolution Logic
```
1. Check profile.influencer_id -> look up profiles array for full_name
2. If not found, check leads table for matching phone/email
   - If source_type = 'influencer', resolve source_id to influencer name
   - If source_type = 'referral', query referrals table for referrer_id -> profile name
3. Display: "[Type]: [Actual Name]" or "Website (Self)" if organic
```

### Document Access
- Query `documents` table filtered by `student_id`
- Admin already has SELECT RLS policy on documents table
- Download via storage bucket `student-documents` URL

