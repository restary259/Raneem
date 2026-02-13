
## DSOS (Darb Study Operating System) -- Implementation Plan

This is a significant evolution of the existing Darb platform. The good news is that **much of the foundation already exists** -- authentication, role-based access (admin/influencer/student), referrals, documents, checklists, payments, and rewards are all built. The plan below focuses on what needs to be **added or modified** to match the DSOS specification.

### What Already Exists (No Changes Needed)

- 4-role system (Admin, Influencer, Student) with `user_roles` table and `has_role()` function
- Student dashboard with checklist tracker, document uploads, referral form, rewards panel
- Admin dashboard with student management, influencer management, referral tracking, payouts
- Influencer dashboard with assigned students, earnings, payout requests
- Mobile-first responsive design, RTL/LTR support, PWA configuration
- Secure auth with rate limiting, session timeouts, server-side admin verification

### Phase 1: Database -- New Tables (Leads + StudentCases + Commissions)

**New table: `leads`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| full_name | text | required |
| phone | text | required |
| city | text | nullable |
| age | integer | nullable |
| education_level | text | nullable |
| german_level | text | nullable |
| budget_range | text | nullable |
| preferred_city | text | nullable |
| accommodation | boolean | default false |
| source_type | text | 'influencer' / 'referral' / 'organic' |
| source_id | uuid | nullable, links to influencer or referrer |
| eligibility_score | integer | nullable |
| status | text | 'new' / 'eligible' / 'not_eligible' / 'assigned' |
| created_at | timestamptz | default now() |

RLS: Admin full access. Influencers can view leads where `source_id = auth.uid()`.

**New table: `student_cases`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| lead_id | uuid | FK to leads |
| assigned_lawyer_id | uuid | nullable, FK concept (stored as uuid) |
| student_profile_id | uuid | nullable, links to profiles after signup |
| selected_city | text | nullable |
| selected_school | text | nullable |
| accommodation_status | text | nullable |
| service_fee | numeric | default 0 |
| influencer_commission | numeric | default 0 |
| lawyer_commission | numeric | default 0 |
| referral_discount | numeric | default 0 |
| school_commission | numeric | default 0 |
| translation_fee | numeric | default 0 |
| case_status | text | 'assigned' / 'contacted' / 'appointment' / 'closed' / 'paid' / 'registration_submitted' / 'visa_stage' / 'completed' |
| notes | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Admin full access. Lawyers can view/update cases assigned to them (limited columns). Students can view own case (no financial fields exposed via frontend).

**New table: `case_payments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| case_id | uuid | FK to student_cases |
| payment_type | text | 'service_fee' / 'school_payment' / 'translation' |
| amount | numeric | default 0 |
| paid_status | text | 'pending' / 'paid' |
| paid_date | timestamptz | nullable |
| created_at | timestamptz | default now() |

RLS: Admin full access. Students can view own case payments.

**New table: `commissions`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| case_id | uuid | FK to student_cases |
| influencer_amount | numeric | default 0 |
| lawyer_amount | numeric | default 0 |
| status | text | 'pending' / 'approved' / 'paid' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Admin full access.

**Add 'lawyer' to the `app_role` enum:**

```sql
ALTER TYPE public.app_role ADD VALUE 'lawyer';
```

### Phase 2: Admin Dashboard Enhancements

**New admin tabs added to `AdminLayout.tsx`:**
- **Leads** tab -- view/manage all leads as mobile-friendly stacked cards
- **Cases** tab -- view/manage student cases with expandable financial breakdown

**File: `src/components/admin/LeadsManagement.tsx` (new)**
- Displays leads as vertical cards (not tables) on mobile
- Each card shows: Name, Phone (click-to-call `tel:` link), City, German Level, Budget, Source Badge, Eligibility Score, Status Badge
- Action buttons: "Mark Eligible", "Mark Not Eligible", "Assign Lawyer"
- "Mark Eligible" auto-creates a `student_cases` record
- Search and filter by status

**File: `src/components/admin/CasesManagement.tsx` (new)**
- Each case as a collapsible card
- Collapsed: Student Name, Assigned Lawyer, City + School, Case Status, Payment Status
- Expanded: Full financial breakdown (service fee, commissions, discount, net profit auto-calculated)
- Admin can edit all financial fields
- Status dropdown for case progression
- When admin confirms "Paid": creates commission records, updates influencer earnings

### Phase 3: Lawyer Dashboard

**File: `src/pages/LawyerDashboardPage.tsx` (new)**
- Auth check: must have `lawyer` role
- Shows only cases assigned to this lawyer
- Each case card: Name, Phone (call button), Preferred City, Selected School, Case Status dropdown
- Status options: Contacted, Appointment, Closed, Lost, Paid
- "Paid" status sends notification to admin (toast + audit log entry) -- does NOT auto-trigger commissions
- Can add translation service, upload documents, add internal notes
- CANNOT see: school commission, influencer commission, net profit

**Route added in `App.tsx`:**
```
/lawyer-dashboard -> LawyerDashboardPage
```

### Phase 4: Student Dashboard Enhancements

**Updated `DashboardMainContent.tsx`:**
- New "My Application" tab showing:
  - Selected City, Selected School, Accommodation status
  - Progress bar based on `case_status`
- Enhanced "Payments" tab showing case-specific payments (service fee, school, translation) with status badges
- Existing "Documents", "Checklist", "Referrals" tabs remain unchanged
- Student dashboard only activates after payment confirmed (check `case_status`)

### Phase 5: Influencer Dashboard Enhancements

**Updated `InfluencerDashboardPage.tsx`:**
- Top summary cards: Total Leads, Eligible, Closed, Paid, Total Earnings, Pending Earnings
- Student list shows: Name, Status, Commission Status (no phone numbers, no internal notes)
- Commission only becomes "Approved" when admin confirms payment

### Phase 6: KPI Analytics (Admin Only)

**File: `src/components/admin/KPIAnalytics.tsx` (new)**
- New admin tab "Analytics"
- Lawyer metrics: Close Rate %, Revenue Generated
- Influencer metrics: Lead Quality %, Paid Conversion %, Cost per Paid Student
- Business metrics: Net Profit per Student, Total Monthly Profit

### Technical Notes

- All new components use vertical card layouts (no wide tables on mobile)
- Click-to-call buttons use `<a href="tel:...">` for WhatsApp-style UX
- Financial fields hidden from non-admin roles at the **frontend level** (lawyers and students never receive this data)
- RLS policies enforce server-side data access restrictions
- Existing tables (profiles, referrals, rewards, documents, checklist) remain unchanged
- The `Lawyer` role is essentially the "Closer" mentioned in the spec -- same concept, professional terminology
- All new UI follows existing design patterns (Card components, Badge, Progress, same color scheme)
- RTL/LTR support maintained via existing `useDirection` hook

### File Summary

| Action | File |
|--------|------|
| Migration | New tables: leads, student_cases, case_payments, commissions; add 'lawyer' to app_role enum |
| New | `src/components/admin/LeadsManagement.tsx` |
| New | `src/components/admin/CasesManagement.tsx` |
| New | `src/components/admin/KPIAnalytics.tsx` |
| New | `src/pages/LawyerDashboardPage.tsx` |
| Edit | `src/components/admin/AdminLayout.tsx` -- add Leads, Cases, Analytics tabs |
| Edit | `src/pages/AdminDashboardPage.tsx` -- wire new tabs |
| Edit | `src/components/dashboard/DashboardMainContent.tsx` -- add "My Application" tab |
| Edit | `src/pages/InfluencerDashboardPage.tsx` -- enhanced stats from leads/cases |
| Edit | `src/App.tsx` -- add `/lawyer-dashboard` route |

### Implementation Order

1. Database migration (tables + RLS + enum)
2. Admin Leads Management
3. Admin Cases Management (with auto-create on eligible)
4. Lawyer Dashboard
5. Student dashboard enhancements
6. Influencer dashboard enhancements
7. KPI Analytics
