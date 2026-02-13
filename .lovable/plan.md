

## DSOS Ultimate Setup Blueprint -- Gap Analysis and Implementation Plan

After a thorough code review, here is what already exists, what needs fixing, and what needs to be built.

---

### Already Implemented (No Changes Needed)

- Role-based access (Admin, Lawyer, Influencer, Student) with `user_roles` table and `has_role()` function
- Session timeout (30 min inactivity) via `useSessionTimeout` hook
- Token-based auth with auto-refresh
- Apply page: 3-step form with eligibility scoring, dark mode, pulse success animation, "Explore Website" CTA
- Influencer referral link attribution (`?ref=UUID`)
- Leads management: eligibility override, assign lawyer, export CSV
- Cases management: status machine, financial fields, net profit, 20-day timer badge, auto-create rewards on "paid"
- Payouts: requester name/email display, approve/cancel actions
- Influencer dashboard: students, leads with eligibility, earnings with 20-day timer, payout request, referral link, media hub
- Lawyer dashboard: assigned cases only, status updates, city/school assignment, commission view (only their own)
- Student dashboard: checklist, documents, services, referrals, rewards, profile
- Admin dashboard: overview, leads, cases, students, influencers, checklist, contacts, referrals, payouts, analytics, security, audit
- RLS policies on all tables
- CSP headers, HTTPS enforcement
- Password reset flow, forced password change on first login
- Secure team creation (credentials sent via email, not in API response)
- PWA with cache clearing on logout
- RTL/LTR support with `useDirection` hook
- CV builder with print/PNG/JPG export (no Lovable branding)

### Gaps to Fill

---

### 1. Session Timeout -- Admin Only

**Problem**: `useSessionTimeout` runs for ALL roles (including students, lawyers, influencers who should have permanent sessions per the blueprint).

**Fix**: Update `useSessionTimeout` to only activate for admin users by checking `user_roles` before starting the timer.

**File**: `src/hooks/useSessionTimeout.ts`
- After getting the session, query `user_roles` for the admin role
- Only start the inactivity timer if the user is an admin
- Non-admin users keep permanent sessions (token auto-refresh handles this)

### 2. Custom Admin Notifications (Push to Specific Roles)

**Problem**: No UI for the admin to compose and send custom push notifications to selected roles.

**Files**:
- Create `src/components/admin/CustomNotifications.tsx`:
  - Form with: message title, message body, role selector (checkboxes: Lawyer, Student, Influencer, All), send now or schedule
  - On send, call an edge function that queries `push_subscriptions` joined with `user_roles` to filter by selected roles, then sends via web push
- Create `supabase/functions/send-custom-notification/index.ts`:
  - Accept `{ title, body, roles: string[] }` from admin
  - Query push_subscriptions for users matching the selected roles
  - Send web push to each endpoint
- Update `src/components/admin/AdminLayout.tsx`: Add "Notifications" tab under "Tools" group
- Update `src/pages/AdminDashboardPage.tsx`: Add the new tab case

### 3. Admin Overview KPI Enhancements

**Problem**: Overview is missing key KPIs from the blueprint: eligible %, closed %, revenue, pending payments, top lawyer/influencer.

**File**: `src/components/admin/AdminOverview.tsx`
- Accept additional props: `leads`, `cases`, `payments`, `commissions`
- Add computed KPIs:
  - Eligible %: `leads.filter(eligible).length / leads.length * 100`
  - Closed %: `cases.filter(paid/completed).length / cases.length * 100`
  - Revenue: sum of service_fee + school_commission from paid cases
  - Pending payments: count of pending rewards
  - Top lawyer: lawyer with most closed cases
  - Top influencer: influencer with most referred leads

**File**: `src/pages/AdminDashboardPage.tsx`
- Pass `leads`, `cases`, `payments`, `commissions` to `AdminOverview`

### 4. Student Dashboard -- Hide "Add Service" (Lawyer-Only Assignment)

**Problem**: Per the blueprint, students should NOT be able to add services themselves; only lawyers assign services. The student dashboard currently has `ServicesOverview` which may allow adding.

**File**: `src/components/dashboard/ServicesOverview.tsx`
- Review and ensure it's read-only for students (no "Add Service" button)
- Services should only show what the lawyer has assigned via the case

### 5. Referral Discount Logic (Family vs Friend)

**Problem**: The referral form exists but the discount logic (family = 1,000 NIS discount, friend = 500 NIS reward) may not be fully wired to the cases/payments system.

**File**: `src/components/admin/CasesManagement.tsx`
- When creating/editing a case, if the lead has a referral, auto-suggest the referral_discount based on `is_family` flag from the `referrals` table

### 6. Missing Apply Page Fields Cleanup

**Problem**: Blueprint says to remove budget_range, preferred_city, accommodation from the apply form (assigned later by lawyer). The current apply page already does NOT collect these -- confirmed clean.

**No changes needed.**

### 7. Password Verification for Critical Admin Actions

**Problem**: Blueprint requires password re-verification for payment approval, exports, and financial adjustments. Currently no such verification exists.

**File**: Create `src/components/admin/PasswordVerifyDialog.tsx`
- Modal that prompts the admin to re-enter their password
- Validates via `supabase.auth.signInWithPassword` (same email, entered password)
- Wraps critical actions: payout approval, CSV export of financials

**Files to update**: `PayoutsManagement.tsx` (wrap "Pay" action), `CasesManagement.tsx` (wrap CSV export)

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Edit | `src/hooks/useSessionTimeout.ts` | Only activate for admin role users |
| Create | `src/components/admin/CustomNotifications.tsx` | Admin notification composer UI |
| Create | `supabase/functions/send-custom-notification/index.ts` | Edge function to send push to selected roles |
| Edit | `src/components/admin/AdminLayout.tsx` | Add Notifications tab |
| Edit | `src/pages/AdminDashboardPage.tsx` | Add notifications tab case + pass extra data to overview |
| Edit | `src/components/admin/AdminOverview.tsx` | Add KPI cards (eligible%, closed%, revenue, top performers) |
| Edit | `src/components/dashboard/ServicesOverview.tsx` | Ensure read-only for students |
| Create | `src/components/admin/PasswordVerifyDialog.tsx` | Re-authentication modal for critical actions |
| Edit | `src/components/admin/PayoutsManagement.tsx` | Wrap payout approval with password verification |
| Edit | `src/components/admin/CasesManagement.tsx` | Wrap financial exports with password verification |
| Edit | `supabase/config.toml` | Add send-custom-notification function config |

### Implementation Order
1. Session timeout fix (admin-only) -- quick, high-impact security fix
2. Admin Overview KPI enhancements -- improves dashboard value
3. Student ServicesOverview read-only enforcement
4. Password verification dialog for critical actions
5. Custom notifications system (UI + edge function)
6. End-to-end testing of all dashboards and flows

