

# Admin Dashboard Ultimate Overhaul Plan

This is a large overhaul broken into 7 stages. Each stage addresses specific problems you identified.

---

## Stage 1: Remove Messages/Contacts Tab + Fix Sidebar Structure

**Problem:** The "Contacts" tab has no real use -- messages go nowhere and you never receive anything useful from it.

**Solution:**
- Remove the "Contacts" tab from the sidebar entirely
- Consolidate sidebar into 4 groups instead of 5:
  - **Dashboard**: Overview, Analytics
  - **Pipeline**: Lead Cases, Student Cases (NEW separate tab)
  - **People**: Team Members, Agents (Influencers), Partners
  - **Finance**: Money Dashboard, Payouts, Master Services
  - **System**: Settings (Eligibility, Notifications, Security, Audit)
- Remove the duplicate "team-members" and "influencers" tabs that both render the same `InfluencerManagement` component -- split them into dedicated views

**Files changed:**
- `src/components/admin/AdminLayout.tsx` -- restructure sidebar groups
- `src/pages/AdminDashboardPage.tsx` -- remove contacts state/fetching, add student-cases tab routing

---

## Stage 2: Commission Field on Team Member / Agent Creation

**Problem:** When adding an agent or team member, you cannot set their commission at the same time.

**Solution:**
- Add a `commission_amount` number input field to the create dialog in `InfluencerManagement.tsx`
- Pass the commission value to the `create-team-member` edge function
- Update the edge function to accept `commission_amount` and save it to the `profiles` table on creation
- Show commission column in the team members and agents table

**Files changed:**
- `src/components/admin/InfluencerManagement.tsx` -- add commission input to dialog, show commission column in table
- `supabase/functions/create-team-member/index.ts` -- accept and store `commission_amount`

---

## Stage 3: Fix Lead Cases -- Correct Columns, Source Badges, Assign Member

**Problem:** Lead cases show city instead of interested major, columns don't match Apply Page data, assign member dropdown is empty, and source/discount logic is missing.

**Solution:**
- **Columns update**: Show Full Name, Phone, Education Level, Interested Major (preferred_major), Passport Type, English Units, Math Units, Score, Source Badge, Status, Actions
- **Source badge**: Show "Website", "Agent: [Name]", "Friend Referral", "Family Referral" with clear badge styling
- **Discount auto-apply**: When source is family, auto-set referral_discount on case creation. When friend/stranger, set 500 shekel discount. When influencer, show agent name and their commission will auto-deduct
- **Fix assign member dropdown**: The lawyers array is populated from `user_roles` where `role = 'lawyer'`, but the query only fetches `id, full_name, commission_amount`. Make sure this data loads correctly and the dropdown shows all team members (both lawyers and influencers if needed)
- **Allow assignment regardless of score**: Remove the restriction that only "eligible" leads can be assigned -- any lead can be assigned to a team member
- **Remove CSV/XLSX export buttons**, keep only PDF

**Files changed:**
- `src/components/admin/LeadsManagement.tsx` -- rewrite columns, fix assign dropdown, add source badges, remove CSV/XLSX exports
- `src/pages/AdminDashboardPage.tsx` -- ensure lawyers query fetches `email` too for display

---

## Stage 4: New Student Cases Tab with Profile/Services/Money Sub-tabs

**Problem:** No separate "Student Cases" tab exists. You need to see students who are "ready to apply" so you can register them at language school, track payments, and bulk export PDF intake forms.

**Solution:**
- Create a new `StudentCasesManagement.tsx` component
- Shows cases that have progressed past `profile_filled` stage (ready for registration)
- **Filters**: Status (Ready to Apply, Waiting Payment, Submitted, Paid), Source, Assigned Team Member
- **When clicking a student case**, show sub-tabs:
  - **Profile**: Personal info, emergency contacts, passport, address
  - **Services**: Services assigned by team member (read-only for admin)
  - **Money**: Auto-calculated breakdown -- service fees, referral discount, agent commission, school commission, net profit
  - **Notes**: Internal notes
- **Bulk PDF Export**: Tailored for language school intake -- includes Full Name, Email, Phone, Emergency Contact, Passport, Full Address, Course, Payment Status. Generalized for any school. Supports bulk export by month
- **Remove all download options except PDF**
- When admin marks case as PAID, it triggers commission snapshots and updates across all dashboards

**Files changed:**
- New: `src/components/admin/StudentCasesManagement.tsx`
- `src/pages/AdminDashboardPage.tsx` -- add routing for student-cases tab
- `src/components/admin/AdminLayout.tsx` -- add Student Cases to Pipeline group

---

## Stage 5: Fix People Tab -- Team Members, Agents, Partners

**Problem:** Team members table columns don't make sense, no commission display, partners not ranked, naming inconsistencies (lawyer vs team member).

**Solution:**
- **Team Members tab**: Separate component showing only team members (role = lawyer). Columns: Name, Email, Commission (amount in shekel), Assigned Cases, Paid Students, Earnings, Status, Actions
- **Agents tab**: Separate component showing only influencers. Columns: Name, Email, Commission per Student, Total Leads, Converted Students, Total Earnings, Status, Actions
- **Partners tab**: Rank by performance (highest referrals first). Columns: Name, Total Referrals, Converted, Earnings, Rank
- All naming updated from "lawyer" to "team member" in all visible UI text
- Commission amount is displayed and editable inline

**Files changed:**
- `src/components/admin/InfluencerManagement.tsx` -- split into two separate views or add role filter
- `src/components/admin/PartnersManagement.tsx` -- add ranking logic, update columns

---

## Stage 6: Money Dashboard Auto-Calculation + Funnel Fix

**Problem:** Money uses euro signs instead of shekel, not all calculations are automatic, funnel stages don't match current flow.

**Solution:**
- **Currency fix**: Replace all `€` with `₪` in AdminOverview and CasesManagement financial displays
- **Auto-calculation**: All money is derived from case data -- service fees from master services, agent commission from profile.commission_amount, team member commission from profile.commission_amount, referral discount based on source type (family = custom, friend/stranger = 500 shekel)
- **Funnel update**: Ensure FunnelVisualization stages match the actual status flow and counts are correct
- **Remove CSV/XLSX from CasesManagement and MoneyDashboard**, keep only PDF

**Files changed:**
- `src/components/admin/AdminOverview.tsx` -- fix currency from `€` to `₪`
- `src/components/admin/CasesManagement.tsx` -- fix currency, remove CSV/XLSX buttons
- `src/components/admin/MoneyDashboard.tsx` -- fix currency, remove CSV/XLSX buttons
- `src/components/admin/FunnelVisualization.tsx` -- verify stages match

---

## Stage 7: Translations, Cleanup, and Edge Cases

**Solution:**
- Add all new translation keys to `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`
- Remove hardcoded Arabic text in `InfluencerManagement.tsx` creation dialog
- Verify RTL alignment for new components
- Ensure real-time subscriptions cover all new tabs
- Remove unused imports and dead code

**Files changed:**
- `public/locales/en/dashboard.json`
- `public/locales/ar/dashboard.json`
- Various cleanup across all modified files

---

## Technical Details

### Database Changes
- No schema changes needed -- `commission_amount` already exists on `profiles` table
- The `create-team-member` edge function just needs to accept and pass through the `commission_amount` value

### Discount Logic (Auto-Applied on Case Creation)
When a lead is marked eligible and a case is created:
- If `source_type = 'referral'` and lead has `is_family = true` -> apply family discount (configurable)
- If `source_type = 'referral'` and not family -> apply 500 shekel discount
- If `source_type = 'influencer'` -> commission_amount from influencer profile is attached to case

### Currency Standardization
- All financial displays will use `₪` (Israeli Shekel)
- School commissions from Europe remain in `€` where appropriate but clearly labeled

### Bulk PDF for Language Schools
Fields included:
- Full Name, Email, Phone Number
- Emergency Contact Name + Phone
- Passport Number, Nationality
- Full Address
- Course/Program Selected
- Payment Status
- Date of Application

### Weaknesses & Items Needing Future Attention
1. **Referral discount rules**: Currently hardcoded (500 shekel for friends). Should be configurable in Settings
2. **Appointment reminder system**: No automated reminders before appointments
3. **SLA threshold configuration**: Currently hardcoded at 24h/48h. Should be configurable
4. **Student account auto-linking**: When a student creates their account, the system should match by phone/email to link existing lead/case data -- this requires a trigger or edge function enhancement
5. **Document sharing permissions**: Students upload documents but there is no explicit "share with admin" toggle yet
6. **Payment verification integration**: Currently admin manually marks PAID -- no payment gateway integration
7. **Team member reassignment mid-funnel**: Commission attribution when a case is reassigned needs clear rules (currently goes to latest assignee)

