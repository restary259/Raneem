
# Full System Audit Report -- Darb Study International (DSOS)

---

## Section A: Critical Errors (Must Fix Before Going Live)

### A1. Status Mismatch Between Team Dashboard and Admin Dashboard
- **Location**: `src/pages/TeamDashboardPage.tsx` line 31
- **Issue**: Team Member dashboard still uses the OLD 10-stage status list (`assigned, contacted, appointment, closed, paid, ready_to_apply, registration_submitted, visa_stage, settled`) while the Admin CasesManagement was simplified to 6 stages (`assigned, contacted, paid, ready_to_apply, visa_stage, completed`).
- **Impact**: Team members can set statuses like `appointment`, `closed`, `registration_submitted`, `settled` which the admin dashboard maps to legacy values but does not display natively. Status changes from the team side may confuse data consistency.
- **Fix**: Align TeamDashboardPage STATUS_KEYS to the 6-stage simplified set, with the same legacy mapping logic used in CasesManagement.

### A2. Student "My Application" Tab Uses Old 9-Stage Pipeline
- **Location**: `src/components/dashboard/MyApplicationTab.tsx` line 14-24
- **Issue**: The student-facing application tracker still lists 9 stages including `appointment`, `registration_submitted`, `settled`, `completed`. This does not match the admin's 6-stage simplified funnel.
- **Impact**: Students see a progress timeline that doesn't align with the actual backend status values the admin uses.
- **Fix**: Align CASE_STEPS to the 6-stage simplified set.

### A3. Existing Case Has Legacy Status `appointment` in Database
- **Finding**: Case `8a07349c` has `case_status = 'appointment'` -- a legacy status.
- **Impact**: This case will display correctly due to backward-compatible mapping, but if a team member re-saves it with the old TeamDashboard, it could set other legacy statuses.
- **Fix**: Run a one-time data migration to map all legacy statuses to the simplified 6-stage values.

### A4. Student RewardsPanel Allows Payout Without Bank/IBAN Details
- **Location**: `src/components/dashboard/RewardsPanel.tsx` line 62
- **Issue**: Unlike the influencer EarningsPanel which requires Israeli bank details, the student RewardsPanel has NO bank/IBAN validation before requesting payouts. Students in Germany should provide IBAN. The `canRequest` check only validates amount threshold.
- **Impact**: Students can request payouts without any payment method on file. Admin cannot process the payout.
- **Fix**: Add IBAN entry + validation flow for students (similar to influencer bank details flow, but IBAN-based since students are in Germany).

### A5. Admin Dashboard Client-Side Role Check Before Server-Side Verification
- **Location**: `src/pages/AdminDashboardPage.tsx` lines 48-60
- **Issue**: The admin dashboard first hits the `admin-verify` Edge Function to check admin status. However, the Edge Function uses `getClaims()` which may not exist in all Supabase JS versions. If this call fails, admin access is denied even for valid admins. The network logs show the client is also doing a redundant client-side `user_roles` check.
- **Impact**: Potential reliability issue. The dual verification (edge function + client-side) is good defense-in-depth, but the edge function `getClaims` approach may be fragile.
- **Fix**: Verify the `getClaims` method works correctly in the deployed edge function runtime. Consider using `getUser()` instead for more reliable token validation.

---

## Section B: Minor Errors or Inconsistencies (Next Sprint)

### B1. `case_service_snapshots` Not Cleaned on Case Deletion
- **Location**: `src/components/admin/CasesManagement.tsx` line 217-226
- **Issue**: When deleting a case, the code deletes `appointments`, `case_payments`, and `commissions`, but does NOT delete `case_service_snapshots` linked to the case.
- **Fix**: Add `await supabase.from('case_service_snapshots').delete().eq('case_id', deleteId)` before deleting the case.

### B2. Document Audit Logging May Fail Silently for Non-Admin Users
- **Location**: `src/components/dashboard/DocumentsManager.tsx` lines 90-102
- **Issue**: The `logDocumentAccess` function inserts into `admin_audit_log` with the current user's ID. The RLS policy on `admin_audit_log` requires `has_role(auth.uid(), 'admin')` for INSERT. When a regular student downloads their own document, this INSERT will be silently rejected by RLS.
- **Impact**: Document access by students is not logged in the audit trail.
- **Fix**: Either use a server-side function (SECURITY DEFINER) for audit logging, or create a separate `user_activity_log` table with appropriate RLS.

### B3. LeadsManagement CSV Export Missing Preferred Major Column
- **Issue**: The CSV export headers don't include the `preferred_major` field, which was added recently.
- **Fix**: Add the preferred_major column to CSV/XLSX/PDF export rows.

### B4. Influencer Dashboard Shows Full Student Names in "Enrolled Students" Section
- **Location**: `src/pages/InfluencerDashboardPage.tsx` line 330
- **Issue**: While leads are properly anonymized (showing initials + city), the "Enrolled Students" section shows `s.full_name` in full, leaking PII.
- **Fix**: Apply the same anonymization pattern used for leads.

### B5. MoneyDashboard Uses `common.noData` Translation Key for "All" Filter
- **Location**: `src/components/admin/MoneyDashboard.tsx` lines 270, 279
- **Issue**: The "All" option in filter dropdowns uses `t('common.noData', 'All')` which shows "no data" text instead of "All" in Arabic.
- **Fix**: Use a proper translation key like `t('admin.leads.all')`.

### B6. Missing `preferred_major` in Lead Add Modal
- **Location**: `src/components/admin/LeadsManagement.tsx` line 70
- **Issue**: The manual lead add form doesn't include the `preferred_major` field that was added to the leads table and apply form.
- **Fix**: Add a preferred major field to the add lead modal.

---

## Section C: Security Threats / Gaps

### C1. No File Size or Type Validation on Server Side
- **Location**: `src/components/dashboard/DocumentsManager.tsx` line 191
- **Issue**: File upload only restricts by `accept` attribute on the client (`.pdf,.doc,.docx,.jpg,.jpeg,.png`). There is no server-side file type or size validation in storage policies. A malicious user could bypass client validation.
- **Recommendation**: Add storage bucket policies to restrict file types and sizes.

### C2. Payout `bulkAction` Missing Audit Logging
- **Location**: `src/components/admin/PayoutsManagement.tsx` lines 140-155
- **Issue**: The `bulkAction` function for bulk approve/reject does not write to `admin_audit_log`, while individual approve/reject actions do.
- **Fix**: Add audit logging inside the bulk action loop.

### C3. Student RewardsPanel: No Bank Details Required
- Covered in A4 above. This is both a functional and security concern -- payouts could be requested with no recipient information.

### C4. Edge Function `lead-sla-check` Has No Authentication
- **Location**: `supabase/functions/lead-sla-check/index.ts`
- **Issue**: This function uses `SUPABASE_SERVICE_ROLE_KEY` and has no JWT validation. If exposed publicly, anyone can trigger SLA checks and generate admin notifications.
- **Recommendation**: Either add JWT validation or ensure this is only called via cron/scheduler and not exposed to public HTTP.

### C5. CSP Removes `unsafe-eval` -- Verify No Runtime Breakage
- **Issue**: The recent CSP header change removed `unsafe-eval` from `script-src`. Some libraries (mapbox-gl, recharts) may use `eval()` internally.
- **Recommendation**: Test all pages that use maps and charts to confirm they still work.

---

## Section D: Batch Operations & Edge Cases

### D1. Bulk Payout Approve/Reject
- **Status**: Implemented and functional in `PayoutsManagement.tsx` with checkbox selection and bulk action buttons.
- **Issue**: Missing audit logging (see C2). Otherwise functional.

### D2. Batch Student Upload
- **Status**: Not implemented. There is no bulk import feature for students or leads.
- **Recommendation**: Consider adding CSV import for leads as a future feature.

### D3. Batch Assignment to Team Members
- **Status**: Not implemented. Assignment is one-at-a-time via the Assign button on each lead.
- **Recommendation**: Low priority -- current volume (5 leads) doesn't require batch assignment.

### D4. Companion Lead Handling
- **Status**: Functional. The apply form supports "family" and "friend" companions. The `insert_lead_from_apply` RPC correctly creates linked companion leads with `companion_lead_id` cross-references.
- **Verified**: Both leads are created, and the companion is tagged with notes referencing the main applicant.

### D5. Auto-Split Payment Trigger
- **Status**: Functional. The `auto_split_payment` trigger fires when `case_status` changes to `paid`, creating commission records and rewards automatically.
- **Verified**: 2 commission records and 1 reward exist in the database, matching the 2 paid cases.

### D6. 20-Day Payout Lock
- **Status**: Implemented in both `EarningsPanel.tsx` (influencer) and `RewardsPanel.tsx` (student). Rewards are only eligible for payout after 20 days from creation.
- **Verified**: Logic correctly filters by `LOCK_DAYS = 20`.

---

## Section E: Verification Steps Taken

### E1. Database Integrity Check
- 3 profiles, 5 leads (4 assigned + 1 not_eligible), 3 cases (2 paid + 1 appointment-legacy)
- 2 commissions, 1 reward -- consistent with 2 paid cases
- 236 audit log entries -- logging is active

### E2. RLS Policy Review
- All 18 tables have RLS enabled (linter confirms zero issues)
- Critical tables (`leads`, `student_cases`, `rewards`, `commissions`) properly restrict access by role
- `login_attempts` correctly blocks client INSERT/UPDATE/DELETE (only edge functions can write via service role)

### E3. Edge Function RBAC
- `admin-verify`: validates admin role server-side via `user_roles` table
- `create-influencer`, `create-team-member`, `create-student-account`: all require admin verification
- `send-custom-notification`: CORS headers updated for Supabase client compatibility
- `auth-guard`: dual rate limiting (5/email + 20/IP per 15min) implemented

### E4. Cross-Dashboard Data Consistency
- Admin, Team, Influencer, and Student dashboards all query the same `student_cases`, `leads`, `profiles` tables
- Real-time sync is not enabled -- dashboards require manual refresh
- **Gap**: Status value sets are misaligned (detailed in A1, A2)

### E5. Financial Calculation Verification
- Net profit formula: `service_fee + school_commission - influencer_commission - lawyer_commission - referral_discount - translation_fee`
- Verified in `CasesManagement.tsx` line 228 and `MoneyDashboard.tsx` KPI calculations
- Snapshot lock mechanism works: services are frozen at sale price when attached to a case

### E6. Mobile Responsiveness
- Admin: mobile dropdown selector replaces sidebar (verified in AdminLayout)
- Student: sidebar + main content in flex column on mobile
- Influencer: tab-based navigation, responsive grid
- Team: collapsible cards with touch-friendly buttons
- Apply page: mobile-first 2-step wizard with proper spacing

---

## Summary of Required Actions

### Before Go-Live (Critical)
1. Align TeamDashboardPage status set to the simplified 6-stage funnel
2. Align MyApplicationTab CASE_STEPS to the simplified 6-stage funnel
3. Migrate legacy `appointment` case status in database to `contacted`
4. Add IBAN collection to student RewardsPanel before allowing payout requests
5. Add `case_service_snapshots` cleanup to case deletion flow

### Next Sprint (Important)
6. Fix document audit logging for non-admin users (RLS blocks student document log inserts)
7. Add audit logging to bulk payout actions
8. Fix PII leak in influencer "Enrolled Students" section
9. Add preferred_major to lead CSV export and add-lead modal
10. Fix MoneyDashboard filter label translation key
11. Secure `lead-sla-check` edge function with auth or restrict to internal calls
12. Test CSP changes don't break mapbox/recharts rendering

### Technical Details

```text
Files requiring changes:
+--------------------------------------------+----------+
| File                                       | Priority |
+--------------------------------------------+----------+
| src/pages/TeamDashboardPage.tsx            | Critical |
| src/components/dashboard/MyApplicationTab  | Critical |
| src/components/dashboard/RewardsPanel.tsx  | Critical |
| src/components/admin/CasesManagement.tsx   | Critical |
| src/components/dashboard/DocumentsManager  | Medium   |
| src/components/admin/PayoutsManagement.tsx | Medium   |
| src/pages/InfluencerDashboardPage.tsx      | Medium   |
| src/components/admin/LeadsManagement.tsx   | Low      |
| src/components/admin/MoneyDashboard.tsx    | Low      |
+--------------------------------------------+----------+

Database migration needed:
- UPDATE student_cases SET case_status = 'contacted'
  WHERE case_status IN ('appointment', 'closed');
- UPDATE student_cases SET case_status = 'completed'
  WHERE case_status IN ('settled', 'registration_submitted');
```
