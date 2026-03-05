
## Plan: Simplified Partner Dashboard + Full Admin Student Control

### What Needs to Change

**Partner Dashboard (5A–5F):**
- Currently shows partner's own referred students via `partner_id` column
- Need to change: show ALL cases from `/apply` and `/contact` (no partner_id filter)
- Remove `PartnerLinkPage` (no more referral links)
- Remove "My Link" from partner nav
- Three tabs: Students, Analytics, Earnings
- Earnings: fixed per-student commission when admin marks case paid, read from `platform_settings.partner_commission_rate`
- The "Analytics" tab = KPI mirror of admin data
- Partner is read-only: no editing

**Admin Students Page (complete rewrite):**
- Full CRUD on student profiles
- Edit: phone, city, emergency contact, arrival date
- Upload/download/delete documents
- Reset password
- Show `created_by` column

**Admin Settings:**
- Partner commission label already exists, just rename for clarity

### Architecture Decision: Partner Earnings Tracking

The `cases` table has `partner_id`. Currently only cases submitted via referral link get `partner_id` set. For the new model, earnings are based on ALL students who paid. We read ALL `enrollment_paid` cases and multiply by `partner_commission_rate`. The Partner Earnings tab shows each paid case as a commission row.

No DB changes needed — `platform_settings.partner_commission_rate` already exists.

### Files to Change

**1. `src/components/layout/DashboardLayout.tsx`**
- Remove `nav.myLink` from `social_media_partner` nav
- Three items: `nav.overview` → `/partner`, `nav.students` → `/partner/students`, `nav.earnings` → `/partner/earnings`

**2. `src/pages/partner/PartnerOverviewPage.tsx` (Analytics tab)**
- Rename to be the Analytics page, or create a new wrapper
- Show ALL cases (no `partner_id` filter): total, contacted, appointment, paid
- Bar chart with full pipeline funnel
- Remove "Share My Link" and "Request Payout" quick action buttons
- Remove "Recent students" section (that goes to Students tab)

**3. `src/pages/partner/PartnerStudentsPage.tsx`**
- Remove `.eq('partner_id', uid)` filter
- Query ALL cases ordered by created_at
- Show: first name only (privacy), registration date, friendly status label, payment status boolean
- Read-only, no actions

**4. `src/pages/partner/PartnerEarningsPage.tsx`**
- Remove `.eq('partner_id', uid)` filter
- Show ALL paid cases (`status = 'enrollment_paid'`) as individual earning rows
- Per-student: First name only, date, commission amount, status (Pending → admin marks paid)
- Summary: Total pending, total confirmed, total paid
- The concept of "pending" = cases at `payment_confirmed` or `submitted`; "confirmed/paid" = `enrollment_paid`

**5. `src/pages/partner/PartnerLinkPage.tsx`** — Keep file but make it a redirect to `/partner` (or remove route entirely)

**6. `src/pages/admin/AdminStudentsPage.tsx` (major rewrite)**
Add full editing in the detail sheet:
- Editable fields: `full_name`, `phone_number`, `city`, `emergency_contact`, `arrival_date`
- Save changes via `supabase.from('profiles').update(...)` 
- Upload document: file picker → upload to `student-documents` storage bucket → insert into `documents` table with `student_id`
- Delete document: delete from `documents` + `supabase.storage.from('student-documents').remove([path])`
- Show `created_by` in list: join with profiles to get creator name
- Table columns: Name, Email, Phone, Created, Created By

**7. `src/pages/admin/AdminSettingsPage.tsx`**
- Label the partner commission setting more clearly as "Partner Commission Per Student (Fixed Amount)"
- No structural changes needed

### Summary Table

| File | Change |
|------|--------|
| `DashboardLayout.tsx` | Remove "My Link" from partner nav, keep 3 tabs |
| `PartnerStudentsPage.tsx` | Show ALL cases, first name only, friendly status, no partner_id filter |
| `PartnerOverviewPage.tsx` | Full KPI analytics view of all cases, no referral link buttons |
| `PartnerEarningsPage.tsx` | Show all paid cases as earnings, no partner_id filter |
| `AdminStudentsPage.tsx` | Full edit (profile fields), upload/delete documents, created_by display |

### No DB migrations needed
- `profiles.emergency_contact` already added (last migration)
- `profiles.created_by` already added (last migration)
- `documents` table already exists with `student_id`
- `student-documents` storage bucket already exists
- `platform_settings.partner_commission_rate` already exists
