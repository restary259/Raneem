
# Full System Audit Report -- DARB Admin Dashboard

## Executive Summary

The database is currently **clean** (post-purge: 1 admin profile, 0 leads/cases/rewards/commissions). No orphan records exist. The database linter reports **zero** schema issues. The security scan found **3 errors** and **4 warnings** related to RLS policy breadth. The codebase architecture is solid with centralized data fetching, but has specific issues in KPI consistency, security posture, and UI polish.

---

## 1. Data Integrity -- PASS (Clean Slate)

| Check | Result |
|-------|--------|
| Orphan cases (no matching lead) | 0 |
| Orphan rewards (no matching profile) | 0 |
| Orphan commissions (no matching case) | 0 |
| Cases with invalid lawyer ID | 0 |
| Leads with invalid influencer source | 0 |
| Duplicate profile emails | 0 |
| Database linter issues | 0 |

**Verdict**: Clean. No remediation needed. These checks should be run periodically as data grows (see monitoring section below).

---

## 2. KPI Reconciliation -- Overview vs Money Tab

Both Overview and Money derive KPIs from `student_cases` where `paid_at IS NOT NULL`. However, there are **two inconsistencies** in the calculation logic:

### Issue A: Revenue definition mismatch (P2)
- **Overview** line 45-47: Filters by `case_status === 'paid' AND paid_at.startsWith(currentMonth)` for monthly revenue
- **Money** line 174: Filters by `paid_at IS NOT NULL` (no status check) for total revenue
- **Risk**: A case that was un-paid (status changed away from 'paid' but `paid_at` wasn't nulled) would appear in Money but not Overview
- **Fix**: The `auto_split_payment` trigger already sets `paid_at := NULL` when moving away from 'paid', so this is mitigated. However, the code should use a consistent filter: `c.paid_at != null` everywhere (drop the `case_status === 'paid'` check since `paid_at` is the source of truth).

### Issue B: Influencer ROI calculation (P3)
- **Overview** line 49-53: `infROI = totalRevenue / totalInfluencerPayouts` (from rewards table)
- The rewards table currently stores all reward types (influencer, lawyer, referral). If non-influencer rewards exist, the denominator is inflated.
- **Fix**: Filter rewards by linking to influencer user_ids before summing.

### Issue C: `totalPayments` in secondary KPI (P3)
- `AdminDashboardPage` line 125 sums from the `payments` table, but the real financial source of truth is `student_cases`. The `payments` table is a legacy student-facing table.
- **Fix**: Replace with `cases.filter(c => c.paid_at).reduce(sum of service_fee + school_commission)` for consistency.

---

## 3. Filter Wiring Audit

| Dashboard | Filter | Wired to DB? | Notes |
|-----------|--------|-------------|-------|
| Admin Leads | Status (new/eligible/not_eligible/assigned) | Client-side filter on pre-fetched data | Correct -- RLS provides server-side scope |
| Admin Leads | Source type | Client-side | Correct |
| Admin Leads | Search (name/phone/email) | Client-side | Correct |
| Admin Money | Type/Status/Search | Client-side on derived transaction rows | Correct |
| Influencer Students | all/eligible/ineligible/paid | Client-side on RLS-scoped data | Correct |
| Team Cases | Status tabs | Client-side | Correct |

**Verdict**: All filters work correctly on client-side filtered data that is already scoped by RLS. No server/client mismatch. The `dataService.ts` fetches use proper `deleted_at IS NULL` filtering server-side.

**Potential issue at scale (P3)**: When leads exceed 1000, the default query limit will truncate results. Add `.limit(10000)` or implement server-side pagination.

---

## 4. Security Findings

### P1 -- Critical

**S1: All 20 edge functions have `verify_jwt = false`**
- Every edge function in `config.toml` disables JWT verification at the gateway level
- Functions like `admin-verify`, `create-influencer`, `create-team-member`, `admin-mark-paid`, `purge-account` are sensitive admin operations
- While some functions validate JWT manually in code, if any miss this check, they're fully open
- **Fix**: Keep `verify_jwt = false` only for truly public functions (e.g., `get-exchange-rate`). Enable JWT verification for all admin/authenticated functions and handle auth in code as a defense-in-depth measure.

**S2: Lawyer RLS on `student_cases` is too broad**
- Policy: `has_role('lawyer') AND deleted_at IS NULL` -- allows ANY lawyer to see ALL cases
- This is by design for the team workflow but means a compromised lawyer account exposes all student financial data
- **Risk**: Medium-high. Financial fields (service_fee, commissions, IBAN on profile) are visible.
- **Fix**: Consider restricting to `assigned_lawyer_id = auth.uid()` for UPDATE/DELETE while keeping broad SELECT for the team workflow, or add column-level restrictions.

**S3: Lawyer RLS on `leads` is too broad**
- Same pattern: any lawyer sees all active leads including email/phone
- **Fix**: If emails should be hidden from team members, create a view excluding email column.

### P2 -- Medium

**S4: No CSRF protection on edge function endpoints**
- Edge functions accept POST with just an Authorization header
- Standard CORS headers are present but no CSRF token validation
- **Mitigation**: Since auth is Bearer token based (not cookie), CSRF risk is lower but not zero.

**S5: Hardcoded WhatsApp URL in MoneyDashboard** (line 248)
- `const WHATSAPP_URL = 'https://api.whatsapp.com/message/IVC4VCAEJ6TBD1';`
- Should be configurable, not hardcoded.

### P3 -- Low

**S6: `login_attempts` table has no INSERT policy**
- Login attempts can only be viewed by admins but cannot be inserted by anyone via RLS
- This means login tracking only works via SECURITY DEFINER functions or triggers, which is fine if those exist. Verify the insertion path.

---

## 5. UI/UX Audit

### Issue U1: Admin Dashboard Loading Flicker (P2)
- **Root cause**: The `DashboardContainer` shows a full-screen spinner during `isLoading`. When `sessionReady` flips to true and data fetching starts, there's a brief flash between the auth spinner and the data spinner.
- **Current mitigation**: `AdminDashboardPage` line 104 shows auth spinner until `sessionReady`, then `DashboardContainer` takes over. This is correct but the transition between the two spinners may cause a brief content flash.
- **Fix**: Add a `min-h-screen` wrapper around the entire admin page to prevent layout shifts during the spinner transition.

### Issue U2: SVG Animation Flicker in Charts (P3)
- **Evidence**: Session replay shows rapid `stroke-dasharray` updates on SVG elements (recharts animated rendering)
- **Fix**: Add `isAnimationActive={false}` to recharts `Bar` components for the admin overview chart to eliminate animation jitter on data refresh.

### Issue U3: Influencer Bottom Nav Inconsistency (P3) -- FIXED
- The last diff already aligned the influencer bottom nav with the team dashboard styling (orange active, `active:scale-95`, safe-area padding). This is resolved.

### Issue U4: Arabic text in DashboardLoading (P3)
- `DashboardLoading.tsx` and `DashboardContainer.tsx` have hardcoded Arabic strings ("جار التحميل", "فشل تحميل البيانات")
- These should use i18n keys for consistency with the bilingual setup.

---

## 6. Remediation Plan

### Phase 1: P1 Fixes (Day 1-2)

| # | Fix | File(s) | Owner |
|---|-----|---------|-------|
| 1 | Unify revenue KPI to use `paid_at` as sole source of truth (drop `case_status === 'paid'` filter) | `AdminOverview.tsx` lines 40, 46 | Dev |
| 2 | Fix `totalPayments` KPI to use `student_cases` instead of `payments` table | `AdminDashboardPage.tsx` line 125 | Dev |
| 3 | Filter rewards by influencer user_ids in ROI calc | `AdminOverview.tsx` lines 49-53 | Dev |
| 4 | Add server-side query limits (`.limit(5000)`) to dataService queries | `dataService.ts` | Dev |
| 5 | Audit all edge functions for manual JWT validation | All `supabase/functions/*/index.ts` | Dev |

### Phase 2: P2 Fixes (Day 3-4)

| # | Fix | File(s) |
|---|-----|---------|
| 6 | Disable recharts animation on admin overview chart | `AdminOverview.tsx` |
| 7 | Move WhatsApp URL to a config/env variable | `MoneyDashboard.tsx` |
| 8 | Internationalize hardcoded Arabic strings in loading components | `DashboardContainer.tsx`, `DashboardLoading.tsx` |

### Phase 3: P3 Hardening (Day 5+)

| # | Fix | File(s) |
|---|-----|---------|
| 9 | Add periodic orphan-check SQL as a scheduled edge function | New edge function |
| 10 | Implement server-side pagination for leads (when count > 1000) | `dataService.ts`, `LeadsManagement.tsx` |
| 11 | Create database view for leads excluding email (for lawyer access) | SQL migration |

---

## 7. Automated Health Checks (Recurring)

These SQL queries should be run periodically (weekly or via scheduled edge function):

```text
-- Orphan cases
SELECT COUNT(*) FROM student_cases sc LEFT JOIN leads l ON sc.lead_id = l.id WHERE l.id IS NULL;

-- Duplicate leads by phone
SELECT phone, COUNT(*) FROM leads WHERE deleted_at IS NULL GROUP BY phone HAVING COUNT(*) > 1;

-- Stale appointments
SELECT COUNT(*) FROM appointments WHERE status NOT IN ('completed','cancelled') AND scheduled_at < NOW() - INTERVAL '7 days';

-- Reward duplicates
SELECT user_id, admin_notes, COUNT(*) FROM rewards GROUP BY user_id, admin_notes HAVING COUNT(*) > 1;

-- KPI reconciliation: Overview revenue vs Money revenue
-- (Both should derive from: SUM(service_fee + school_commission) WHERE paid_at IS NOT NULL)
```

---

## 8. Sign-Off Checklist

- [x] Data integrity: 0 orphan records
- [x] Database linter: 0 issues
- [x] KPI source of truth identified: `student_cases.paid_at`
- [x] 3 KPI calculation inconsistencies documented with fixes
- [x] All filters verified end-to-end
- [x] Security scan: 3 errors, 4 warnings documented
- [x] Edge function JWT audit needed (20 functions with verify_jwt=false)
- [x] UI flicker root causes identified (spinner transition + SVG animation)
- [x] Remediation plan with priorities and file locations
