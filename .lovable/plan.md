

## PWA Finishing Touches -- Comprehensive Implementation Plan

This plan addresses all the items in the checklist, organized by priority and grouped for efficient implementation.

---

### Phase 1: Critical Fixes (Header, Auth, Student Dashboard Mobile)

**1.1 Header Logo Stability**
- File: `src/components/landing/Header.tsx`
- Add `whitespace-nowrap flex-shrink-0` to the logo container
- Add `overflow-hidden flex-shrink min-w-0` to the nav container so links compress before the logo breaks

**1.2 Auth Page Password Toggle (RTL/LTR)**
- File: `src/pages/StudentAuthPage.tsx`
- The eye icon is currently hardcoded to `absolute left-0` (line 253). Change to use directional classes: `absolute start-auto end-0` (or use `ltr:right-0 rtl:left-0`) so it sits correctly in both Arabic and English

**1.3 Student Dashboard Mobile Header**
- File: `src/components/dashboard/DashboardHeader.tsx`
- Replace full text buttons ("Log Out", "Go to Home Page") with icon-only buttons on mobile using responsive classes
- Add `whitespace-nowrap` to the dashboard title and user name
- Use `flex-row items-center justify-between` with proper gap management
- Reduce title font size on small screens: `text-lg sm:text-2xl`

---

### Phase 2: Student Dashboard Enhancements

**2.1 My Application (طلبي) -- Automated Visibility**
- File: `src/components/dashboard/MyApplicationTab.tsx`
- Currently queries by `student_profile_id`. This already works when admin links a case to a student profile. No logic change needed for the base case.
- Enhancement: Show a timeline-style progress tracker instead of just a progress bar. Add milestone markers for each step with dates when available.

**2.2 Referral System -- Auto-Lead Generation**
- File: `src/components/dashboard/ReferralForm.tsx`
- After inserting into `referrals` table, also call the `insert_lead_from_apply` RPC to create a lead automatically with the referral data (name, phone, german_level)
- Add eligibility-relevant fields to the form: education_level (bagrut/diploma), passport_type, english_units, math_units
- These map to the same eligibility scoring the Apply page uses

**2.3 Referral Rewards -- 20-Day Payout Lock**
- File: `src/components/dashboard/RewardsPanel.tsx`
- Add the same 20-day timer logic from the influencer panel: if `reward.status === 'pending'` and `created_at` is less than 20 days ago, show a countdown badge and disable the "Request Payout" button with a message explaining the lock period

**2.4 Student Dashboard UI -- Admin Color Alignment**
- File: `src/pages/StudentDashboardPage.tsx`
- Background is already `bg-[#F8FAFC]` (matching admin). Confirm card classes use `rounded-xl shadow-sm border border-slate-200`.
- File: `src/components/dashboard/DashboardSidebar.tsx`
- Update sidebar styling to match admin's navy sidebar aesthetic with `bg-[#1E293B] text-white` on desktop
- File: `src/components/dashboard/DashboardHeader.tsx`
- Match admin header style: `bg-[#1E293B] text-white` with logo

---

### Phase 3: Lawyer/Team Portal Upgrades

**3.1 Lawyer Dashboard -- Commission Tracking**
- File: `src/pages/LawyerDashboardPage.tsx`
- Add a "Rewards" summary card showing total earned commissions from closed cases
- Sum `lawyer_commission` from cases where `case_status` is 'paid' or 'closed'

**3.2 Lawyer Dashboard -- Call Logs and Notes**
- Already has notes per case (editable textarea in the collapsible panel). This is functional.

**3.3 Lawyer Dashboard -- Document Upload**
- Currently no document upload for lawyers. Add a file upload button in the case collapsible that uploads to the `student-documents` bucket and creates a `documents` record linked to the student.
- Requires a new RLS policy: lawyers can insert documents for students in their assigned cases.

**3.4 Team Calendar (New Feature)**
- This is a significant new feature. Create a basic appointments system:
  - New database table: `appointments` (id, case_id, lawyer_id, student_name, scheduled_at, location, notes, created_at)
  - New component: `src/components/lawyer/AppointmentCalendar.tsx` with month/week view using a simple grid
  - Add modal for creating appointments with student selector
  - Auto-update case status to 'appointment' when a meeting is logged

---

### Phase 4: Admin Dashboard Enhancements

**4.1 "Ready for Germany" Queue**
- File: `src/pages/AdminDashboardPage.tsx`
- Add a new tab "Ready" that filters student_cases where `case_status` is 'paid' or 'completed' and all required documents are uploaded
- Show a summary card with student name, school, city, and document status

**4.2 Commission Approval Section**
- Already exists in `PayoutsManagement.tsx` with approve/cancel buttons. Verified functional.

**4.3 Mobile Checkbox/Toggle Fix**
- File: `src/styles/layouts.css`
- Add global rule: checkboxes and toggle inputs get `flex-shrink-0` and fixed dimensions `w-5 h-5`

---

### Phase 5: Contact Info, CV Builder, and Global Polish

**5.1 Update Phone Number**
- File: `src/components/landing/OfficeLocations.tsx`
- Change phone from `+972 52-940-2168` to `+972 524061225`

**5.2 Update Working Hours**
- File: `public/locales/ar/common.json` and `public/locales/en/common.json`
- Update the `officeLocations.hours` value to "10:00 AM - 7:00 PM"

**5.3 CV Builder Cleanup**
- File: `src/components/lebenslauf/LebenslaufBuilder.tsx`
- Remove PNG and JPG download buttons (keep PDF only)
- Remove photo upload option from `CVForm.tsx` if present
- Ensure no "Made with Lovable" watermark in print CSS

**5.4 Active States on Buttons**
- File: `src/styles/base.css`
- Add global: `button, a { @apply active:scale-95 transition-transform; }`

**5.5 Empty States**
- Audit all list components for proper empty state icons/messages. Most already have them (ServicesOverview, MyApplicationTab, RewardsPanel). Verify and add where missing.

---

### Phase 6: Email Branding

**6.1 Sender Identity and Template**
- File: `supabase/functions/send-branded-email/index.ts`
- Update sender name to "وكالة درب | Darb Agency"
- Ensure HTML template includes the Darb logo at the top
- Verify dynamic variables are properly mapped to prevent empty emails

---

### Technical File Summary

| Priority | File | Changes |
|----------|------|---------|
| P1 | `src/components/landing/Header.tsx` | Logo flex-shrink-0, nav overflow-hidden |
| P1 | `src/pages/StudentAuthPage.tsx` | RTL-aware password toggle position |
| P1 | `src/components/dashboard/DashboardHeader.tsx` | Mobile icon-only buttons, whitespace-nowrap |
| P2 | `src/components/dashboard/ReferralForm.tsx` | Add eligibility fields, auto-create lead |
| P2 | `src/components/dashboard/RewardsPanel.tsx` | 20-day payout lock timer for students |
| P2 | `src/components/dashboard/DashboardSidebar.tsx` | Admin-style navy sidebar |
| P2 | `src/pages/StudentDashboardPage.tsx` | Header restyling to match admin |
| P3 | `src/pages/LawyerDashboardPage.tsx` | Commission summary, document upload |
| P3 | New: `src/components/lawyer/AppointmentCalendar.tsx` | Calendar view for appointments |
| P3 | DB migration | Create `appointments` table with RLS |
| P4 | `src/pages/AdminDashboardPage.tsx` | "Ready for Germany" tab |
| P4 | `src/styles/layouts.css` | Checkbox flex-shrink-0 fix |
| P5 | `src/components/landing/OfficeLocations.tsx` | Phone number update |
| P5 | `public/locales/*/common.json` | Working hours update |
| P5 | `src/components/lebenslauf/LebenslaufBuilder.tsx` | Remove PNG/JPG, PDF only |
| P5 | `src/styles/base.css` | active:scale-95 on interactive elements |
| P6 | `supabase/functions/send-branded-email/index.ts` | Sender name + template fix |

### Implementation Order
1. Header, auth, and student mobile header fixes (quick wins)
2. Student dashboard enhancements (referral auto-lead, payout lock, UI alignment)
3. Lawyer portal upgrades (commissions, documents, calendar)
4. Admin "Ready for Germany" tab
5. Contact info, CV builder, global polish
6. Email branding

