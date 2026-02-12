

# Complete Referral & Commission Dashboard System

## Overview

Extend the existing three-dashboard system (Student, Influencer, Admin) with a full referral tracking engine, commission calculations, gamification, and compliance features. This plan builds on top of the existing database schema, UI components, and role architecture without changing any existing functionality.

---

## What Already Exists (No Changes Needed)

- Student Dashboard: checklist tracker, profile, services, payments, documents
- Influencer Dashboard: view assigned students, checklist progress, status badges
- Admin Dashboard: overview stats, student/influencer management, checklist management, contacts, security, audit log
- Role system: `user_roles` table with `admin`, `influencer`, `student` roles via `has_role()` function
- Auth flow: role-based redirect after login

---

## Phase 1: Database Schema (New Tables)

### 1a. `referrals` table
Tracks every referral made by students or influencers.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| referrer_id | uuid | The user who referred (student or influencer) |
| referrer_type | text | `student` or `influencer` |
| referred_name | text | Full name of referred person |
| referred_email | text | Email |
| referred_phone | text | Phone number |
| referred_country | text | Country/Nationality |
| referred_city | text | Town/City |
| referred_dob | date | Date of birth |
| referred_gender | text | Gender |
| referred_german_level | text | Current knowledge of German |
| is_family | boolean | Family referral (triggers 1000 ILS discount) |
| status | text | `pending`, `contacted`, `enrolled`, `paid`, `rejected` |
| referred_student_id | uuid (nullable) | Links to `profiles.id` once enrolled |
| notes | text | Admin notes |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Students/influencers see own referrals; admins see all; admins can update.

### 1b. `rewards` table
Tracks earned rewards and payout requests.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | Earner (student or influencer) |
| referral_id | uuid | Links to `referrals.id` |
| amount | numeric | 500 ILS (student) or 2000 ILS (influencer) |
| currency | text | Default `ILS` |
| status | text | `pending`, `approved`, `paid`, `cancelled` |
| payout_requested_at | timestamptz | |
| paid_at | timestamptz | |
| admin_notes | text | |
| created_at | timestamptz | |

RLS: Users see own rewards; admins see all and can update.

### 1c. `referral_milestones` table
Tracks milestone achievements (badges).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | |
| milestone_type | text | `first_referral`, `5_referrals`, `10_referrals` |
| achieved_at | timestamptz | |
| notified | boolean | Whether notification was shown |

RLS: Users see own; admins see all.

---

## Phase 2: Student Dashboard Enhancements

### 2a. New Sidebar Tabs
Add two new tabs to `DashboardSidebar.tsx` (appended after existing tabs):
- **Refer a Friend** (icon: UserPlus)
- **My Rewards** (icon: Gift)

### 2b. Refer a Friend Page
New component: `src/components/dashboard/ReferralForm.tsx`

- Prominent card with "Refer a Friend" and "Refer Family Member" toggle
- Form fields: Surname, First Name, Town/City, Telephone, Email, Country/Nationality, Date of Birth, Gender, Current German knowledge
- Family referral checkbox (triggers 1000 ILS discount note)
- "All information provided is accurate" confirmation checkbox
- Below form: referral status table showing all submitted referrals with status badges

### 2c. Referral Status Table
New component: `src/components/dashboard/ReferralTracker.tsx`

- Table: Name, Status (Pending/Enrolled/Paid), Reward earned, Date
- Color-coded status badges matching existing design patterns

### 2d. My Rewards Page
New component: `src/components/dashboard/RewardsPanel.tsx`

- Summary card: total earned, pending, paid
- Payout request button (creates a record for admin approval)
- History log of all reward transactions
- Milestone badges section (visual indicators for 1, 5, 10 referrals)

### 2e. Gamification (Subtle)
- Progress bar toward next milestone on dashboard home
- Badge icons for 1, 5, 10 successful referrals
- Hidden 10th referral milestone: when reached, show a special toast notification

### 2f. Dashboard Home Welcome Card
Update `DashboardMainContent.tsx` to show a welcome card when `activeTab === 'checklist'` (the default tab):
- "Welcome [Student Name]!"
- Quick stats: Total referrals, Active referrals, Earned rewards
- Progress bar toward next milestone

---

## Phase 3: Influencer Dashboard Enhancements

### 3a. Earnings Section
New component: `src/components/influencer/EarningsPanel.tsx`

- Total earned (2000 ILS per enrolled student)
- Pending vs paid breakdown
- Payout request button
- Transaction history

### 3b. Enhanced Stats Cards
Add to existing stats row:
- Total earnings card
- Pending payouts card

### 3c. Media & Content Hub (Lightweight)
New component: `src/components/influencer/MediaHub.tsx`

- Grid of downloadable promotional assets (images, templates)
- Links to official branding files
- Tips for creating social media content
- Data stored as static content (no new table needed -- admin can update via code or a future CMS)

### 3d. Referral Link Generator
- Generate a unique referral link for the influencer
- Copy-to-clipboard button
- The link format: `[site-url]/student-auth?ref=[influencer_id]`

---

## Phase 4: Admin Dashboard Enhancements

### 4a. New Sidebar Tabs
Add to `AdminLayout.tsx` tabs array:
- **Referrals** (icon: Share2)
- **Rewards/Payouts** (icon: Wallet)

### 4b. Referrals Management Page
New component: `src/components/admin/ReferralManagement.tsx`

- Table of all referrals across students and influencers
- Filter by status, referrer type, date range
- Inline status update (pending -> contacted -> enrolled -> paid)
- When status changes to "enrolled" or "paid", auto-create a reward record
- CSV export

### 4c. Rewards/Payouts Management
New component: `src/components/admin/PayoutsManagement.tsx`

- Table of all reward/payout requests
- Approve/reject payout requests
- Mark as paid
- Filter by status, user type
- Total payouts summary

### 4d. Enhanced Overview Stats
Add to `AdminOverview.tsx`:
- Total referrals card
- Pending payouts card
- Referral conversion rate
- This month's commissions

### 4e. Milestone Alerts
- In the overview, show alerts when students reach the hidden 10-referral threshold
- Admin can acknowledge/dismiss

---

## Phase 5: Automation & Notifications

### 5a. Reward Auto-Calculation
When admin changes a referral status to "paid":
- Auto-create a `rewards` record with the correct amount (500 ILS for student referrers, 2000 ILS for influencer referrers)
- If family referral, note the 1000 ILS discount applied

### 5b. Milestone Detection
Client-side check after referral status update:
- Count successful referrals for the referrer
- If milestone reached (1, 5, 10), insert into `referral_milestones`
- Show toast/notification on next dashboard visit

### 5c. Referral Link Tracking
When a new student signs up via `?ref=[id]`:
- Store `influencer_id` on their profile automatically
- This connects the referral chain

---

## Phase 6: Legal & Compliance

### 6a. Terms Acceptance
- Add a `terms_accepted_at` column to `referrals` table
- Referral form includes T&C checkbox with link to terms page
- Timestamp stored on submission

### 6b. Data Security
- All referral data protected by RLS
- Students can only see their own referrals
- Influencers can only see their own referrals
- Admins have full visibility
- GDPR-compliant: data can be deleted via admin panel

---

## Technical Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/dashboard/ReferralForm.tsx` | Student referral submission form |
| `src/components/dashboard/ReferralTracker.tsx` | Student referral status table |
| `src/components/dashboard/RewardsPanel.tsx` | Student rewards/earnings view |
| `src/components/dashboard/WelcomeCard.tsx` | Dashboard home welcome stats |
| `src/components/influencer/EarningsPanel.tsx` | Influencer earnings/payouts |
| `src/components/influencer/MediaHub.tsx` | Promotional content hub |
| `src/components/influencer/ReferralLink.tsx` | Referral link generator |
| `src/components/admin/ReferralManagement.tsx` | Admin referral management |
| `src/components/admin/PayoutsManagement.tsx` | Admin payout approvals |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/DashboardSidebar.tsx` | Add "Refer a Friend" and "My Rewards" tabs |
| `src/components/dashboard/DashboardMainContent.tsx` | Add cases for new tabs, add WelcomeCard |
| `src/pages/InfluencerDashboardPage.tsx` | Add tabbed layout with earnings, media hub, referral link |
| `src/components/admin/AdminLayout.tsx` | Add "Referrals" and "Rewards" sidebar tabs |
| `src/pages/AdminDashboardPage.tsx` | Add referral/payout data fetching and tab rendering |
| `src/components/admin/AdminOverview.tsx` | Add referral/payout stat cards |
| `src/pages/StudentAuthPage.tsx` | Capture `?ref=` query param and store as `influencer_id` on signup |
| `src/types/profile.ts` | No changes needed (influencer_id already exists) |

### Database Migrations

3 new tables: `referrals`, `rewards`, `referral_milestones`
Each with proper RLS policies following existing patterns.

### What Will NOT Change

- Navigation order, logo, student portal button
- Existing checklist, services, payments, documents features
- Existing admin student/influencer management
- Auth flow and role-based routing
- RTL/LTR support
- Brand colors and design language
- Cookie consent, PWA, service worker

### Commission Structure

| Referrer Type | Amount per Successful Referral |
|---------------|-------------------------------|
| Student | 500 ILS |
| Influencer | 2,000 ILS |
| Family referral discount | 1,000 ILS off for the referred student |

### Milestone Badges

| Milestone | Badge |
|-----------|-------|
| 1 referral | "First Step" |
| 5 referrals | "Growing Network" |
| 10 referrals | "Ambassador" (hidden trigger -- surprise notification) |

