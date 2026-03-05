
## Audit Results — What's Correct vs What Needs Fixing

### ✅ CORRECTLY IMPLEMENTED
1. **AuthContext.tsx** — correct 4-role enum (`admin | team_member | social_media_partner | student`), `get_my_role()` RPC, 6s safety timer, `mustChangePassword`
2. **ProtectedRoute.tsx** — correct check order, AdminSecurityGate for admin only
3. **DashboardLayout.tsx** — collapsible sidebar, RTL-aware, role-based nav, NotificationBell, signOut
4. **App.tsx** — correct route structure, all 4 role trees, legacy redirects, no old `/lawyer-dashboard`/`/influencer-dashboard` routes
5. **StudentAuthPage.tsx** — login-only (no signup tab), no Google button, uses `get_my_role()` RPC + `ROLE_TO_PATH`, polished UI
6. **All 9 Admin pages** — created and wired in routes
7. **All Team pages** — CaseDetailPage, TeamCasesPage, TeamTodayPage, AppointmentSchedulerModal, AppointmentOutcomeModal, ProfileCompletionForm, PaymentConfirmationForm, SubmitNewStudentPage, TeamStudentsPage, TeamStudentProfilePage, TeamAnalyticsPage
8. **Partner pages** — PartnerOverviewPage, PartnerLinkPage, PartnerStudentsPage, PartnerEarningsPage (with 20-day lock)
9. **Student pages** — StudentChecklistPage, StudentProfilePage, StudentDocumentsPage, StudentVisaPage, StudentReferPage, StudentContactsPage
10. **Edge functions** — `create-student-from-case`, `record-appointment-outcome`, `admin-mark-paid`, `create-case-from-apply`
11. **cases table** has correct statuses: `new, contacted, appointment_scheduled, profile_completion, payment_confirmed, submitted, enrollment_paid, forgotten, cancelled`
12. **DB tables** — `cases`, `appointments`, `case_submissions`, `programs`, `accommodations`, `platform_settings`, `important_contacts`, `referrals`, `activity_log`, `visa_applications` all present
13. **i18n** — `nav.*`, `case.status.*`, `team.*`, `admin.*`, `partner.*` keys in both EN and AR

### ❌ GAPS THAT NEED FIXING

**GAP 1 — `caseStatus.ts` still uses OLD enum values**
The spec requires replacing with new canonical statuses: `new, contacted, appointment_scheduled, profile_completion, payment_confirmed, submitted, enrollment_paid, forgotten, cancelled`. Current file still has `ELIGIBLE, ASSIGNED, APPT_WAITING, APPT_COMPLETED, PROFILE_FILLED, SERVICES_FILLED, READY_TO_APPLY, VISA_STAGE, COMPLETED` — these are wrong. This affects `caseTransitions.ts` too.

**GAP 2 — `caseTransitions.ts` still uses OLD statuses**
Still references `CaseStatus.ELIGIBLE`, `CaseStatus.ASSIGNED`, etc. Must be replaced with the new canonical flow from the spec.

**GAP 3 — `ReferralForm.tsx` queries `referrals.referred_email`**
The `referrals` table schema has `referred_name` + `referred_phone` — NOT `referred_email`. The ReferralForm does a query on `referrals.referred_email` (line 49) which doesn't exist in the schema. Also the insert will fail because it sends email fields. The new schema only wants `referred_name` + `referred_phone` + `referrer_user_id`.

**GAP 4 — `StudentReferPage.tsx` uses legacy `ReferralForm` and `ReferralTracker`**
`ReferralForm` component queries old schema columns (`referred_email`, `referrer_id`). The new `referrals` table uses `referrer_user_id` and has no email field. Need to rewrite the referral form to match the new schema.

**GAP 5 — `PartnerEarningsPage` queries `rewards` table**
The partner dashboard queries `rewards` table for earnings — but per the new architecture, the partner tracks commission against `cases.partner_id`, not a `rewards` row. The `rewards` table is for influencer/lawyer commissions in the OLD system. The new spec says partner commission = `confirmed_students_count × partner_commission_rate`. The earnings page should query `cases` where `partner_id = userId` and `status = 'submitted' OR 'enrollment_paid'`, then multiply by `platform_settings.partner_commission_rate`.

**GAP 6 — `PartnerStudentsPage` and `PartnerOverviewPage` query `cases` with `partner_id` field** — need to verify this is correct against schema (it is, `cases.partner_id` exists ✅), but the pages need to use `supabase.from('cases').select('*').eq('partner_id', userId)` — need to verify they do this.

**GAP 7 — `AdminCommandCenter` queries `cases` table (new schema) ✅** but the `get_forgotten_cases()` RPC still references `public.cases` which should be correct — but the function body has a `CROSS JOIN` that could fail if `platform_settings` is empty. Need to ensure a default row exists.

**GAP 8 — Missing `appointment.outcome.*` and `partner.commission` i18n keys**
The spec requires `appointment.outcome.completed/delayed/cancelled/rescheduled/no_show` and `partner.commission` i18n keys — checking if these were added.

---

## Plan — What to Fix

### Fix 1: Rewrite `src/lib/caseStatus.ts`
Replace the old enum with new canonical statuses matching the DB `cases.status` CHECK constraint:
```typescript
export enum CaseStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  APPT_SCHEDULED = 'appointment_scheduled',
  PROFILE_COMPLETION = 'profile_completion',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  SUBMITTED = 'submitted',
  ENROLLMENT_PAID = 'enrollment_paid',
  FORGOTTEN = 'forgotten',
  CANCELLED = 'cancelled',
}
```
Update `CASE_STATUS_ORDER`, `STATUS_COLORS`, remove `LEGACY_STATUS_MAP` for old values.

### Fix 2: Rewrite `src/lib/caseTransitions.ts`
Replace `ALLOWED_TRANSITIONS` with the new canonical flow from the spec:
```
new → contacted → appointment_scheduled → (outcome) → profile_completion → payment_confirmed → submitted
```

### Fix 3: Fix `src/components/dashboard/ReferralForm.tsx`
- Remove all `referred_email` queries
- Change insert to use `referrer_user_id` (not `referrer_id`) + `referred_name` + `referred_phone`
- Remove email field from form entirely (spec only requires name + phone for referral)
- The new `referrals` table has `referrer_user_id`, `referred_name`, `referred_phone`, `referred_case_id`, `discount_applied`

### Fix 4: Fix `src/pages/partner/PartnerEarningsPage.tsx`
Rewrite to query `cases` (not `rewards`) for partner commission tracking:
- Fetch `cases` where `partner_id = userId` AND `status IN ('submitted', 'enrollment_paid')`
- Fetch `platform_settings` for `partner_commission_rate`
- Commission = qualifying_cases_count × partner_commission_rate
- Show per-case breakdown

### Fix 5: Add missing i18n keys
Add to both `en/dashboard.json` and `ar/dashboard.json`:
- `appointment.outcome.*` keys (completed, delayed, cancelled, rescheduled, no_show)
- `partner.commission` key
- `student.refer.discount_message` key
- `student.checklist.title` key

### Fix 6: Verify `PartnerStudentsPage` and `PartnerOverviewPage` use correct queries
Quick check — if they query `partner_id = userId` on `cases` table they're correct.

---

## Files to Change

| File | Action |
|---|---|
| `src/lib/caseStatus.ts` | Rewrite with new canonical statuses |
| `src/lib/caseTransitions.ts` | Rewrite with new case flow |
| `src/components/dashboard/ReferralForm.tsx` | Fix schema columns (`referrer_user_id`, remove `referred_email`) |
| `src/pages/partner/PartnerEarningsPage.tsx` | Rewrite to use `cases` + `platform_settings` |
| `public/locales/en/dashboard.json` | Add `appointment.outcome.*`, `partner.commission`, `student.refer.*` keys |
| `public/locales/ar/dashboard.json` | Add same keys in Arabic |

No database migrations needed — the schema is already correct. All fixes are code-side alignment to the existing DB schema.
