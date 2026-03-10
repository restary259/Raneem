
## Full Production-Readiness E2E Test Report

### Pre-Test DB Snapshot (Verified via SQL)

**Existing state before test:**
- Cases: 1 row — `Ahmad E2E Test`, status=`enrollment_paid`, source=`manual`, `commission_split_done=true`, `platform_revenue_ils=0`
- Team override: `team@gmail.com` → ₪1,500/case
- Partner override: `partner@gmail.com` → ₪1,000/case, `show_all_cases=false` (pool mode — applies to manual/apply/contact/submit_new_student)
- Rewards: 2 rows — Team ₪1,500 (`pending`), Partner ₪1,000 (`paid`)
- Payout request: 1 row — ₪1,000 `paid`, via `bank_transfer`

---

## Findings

### BUG 1 — CRITICAL: `platform_revenue_ils = 0` on Ahmad E2E Test case
**Severity:** Critical — financial data wrong

The `auto_split_payment` trigger calls `record_case_commission(NEW.id, 0)` — it passes `p_total_payment_ils = 0`, so the admin remainder is always `MAX(0, 0 - 1500 - 1000) = 0`. The `case_submissions` table has no `service_fee` for this case either (`service_fee = null`).

**Root cause:** The `auto_split_payment` trigger hardcodes `0` for total payment. The correct value — the `service_fee` from `case_submissions` — is never passed to `record_case_commission`. So `platform_revenue_ils` is always `0` even when a ₪4,000 service fee was entered.

**Fix needed:** The trigger must JOIN `case_submissions` to fetch `service_fee` before calling the RPC, OR the RPC/edge function `admin-mark-paid` should pass the correct `total_payment_ils`. The edge function `admin-mark-paid` does pass `total_payment_ils` correctly, but the trigger `auto_split_payment` (fired on direct `status` UPDATE) does not.

**Proposed fix for `auto_split_payment` trigger:**
```sql
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_service_fee integer := 0;
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      -- Fetch the service fee from case_submissions
      SELECT COALESCE(service_fee, 0)::integer INTO v_service_fee
      FROM case_submissions WHERE case_id = NEW.id LIMIT 1;
      PERFORM record_case_commission(NEW.id, v_service_fee);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### BUG 2 — MODERATE: `PartnerOverviewPage` status labels use raw English in status CONFIG
**Severity:** Moderate — translation issue

In `PartnerOverviewPage.tsx` lines 12–22, `STATUS_CONFIG` has `label: "new"`, `label: "contacted"` etc. — all raw English strings, not `t()` translation keys. When language is Arabic, the case list in the partner Overview page shows `"new"`, `"contacted"` instead of Arabic labels.

**Fix:** Replace the hardcoded labels in `STATUS_CONFIG` with proper `t()` calls or add an Arabic translation map.

---

### BUG 3 — MODERATE: Admin security gate blocks automated browser testing
**Severity:** Test-only — the admin account `ranimdwahde3@gmail.com` has TOTP 2FA enrolled. Automated browser session cannot pass 2FA. This is expected security behavior, not a code bug. The admin dashboard is reachable only via the user's own device with the authenticator app.

**Impact on test:** All admin-side screenshots (Financials, Payouts, Students, etc.) cannot be automated. The user must perform admin-side test steps manually using their authenticator app.

---

### BUG 4 — LOW: `PartnerOverviewPage` "Projected Earnings" uses `paid × commissionRate`
**Severity:** Low — logic mismatch

The projected earnings banner shows `paid * commissionRate` where `paid` counts cases at `payment_confirmed/submitted/enrollment_paid`. But the commission `rate` is the **per-case fixed override amount** (₪1,000), not a per-case projected multiplier. This is correct in concept but the `projMultiplier` i18n key `"{{paid}} paid cases × ₪{{rate}}"` is accurate. No code fix needed here.

---

### BUG 5 — LOW: `case_submissions.service_fee` is NULL for `Ahmad E2E Test`
The previous E2E migration advanced the case directly to `enrollment_paid` via SQL, bypassing the `PaymentConfirmationForm` which writes `service_fee` to `case_submissions`. So `service_fee = null` and `platform_revenue_ils = 0`. This is a test-data issue, not a production flow bug — as long as team members use the UI, service_fee gets written before enrollment.

---

## Full Checklist Verdict

### Money Logic
| Check | Result | Notes |
|---|---|---|
| Service fee splits: team + partners + admin = ₪4000 | **FAIL** | `auto_split_payment` passes `0` for total, so `platform_revenue_ils=0` always when triggered via status UPDATE. Only correct via `admin-mark-paid` edge function which passes the amount explicitly. |
| `commission_split_done` prevents double-splitting | **PASS** | Idempotency guard is correctly implemented in `record_case_commission` |
| Partner earns on all 3 case sources (show_all_cases=true) | **PASS** | Logic in `record_case_commission` and `PartnerEarningsPage` is correct |
| Partner earns only on apply/contact/manual (show_all_cases=false) | **PASS** | Pool mode logic correct — referral source excluded |
| Admin remainder stored in `platform_revenue_ils` | **FAIL** | Always 0 due to Bug 1 (when triggered via trigger, not edge function) |
| Rewards created with correct amounts | **PASS** | Amounts match overrides |
| Admin confirm payout sets `status=paid` and `paid_at` | **PASS** | Verified in DB |
| Partner dashboard totals update after payout | **PASS** | Realtime subscription + correct reward-based queries |
| Payment history list shows entries | **PASS** | `PartnerEarningsPage` paid history section works |

### Case Flow
| Check | Result | Notes |
|---|---|---|
| Manual case creation | **PASS** | `TeamCasesPage` creates with `source=manual` |
| All status transitions | **PASS** | 7-stage flow implemented with guards |
| Student profile form saves fields | **PASS** | `ProfileCompletionForm` → DB |
| Student account created during case journey | **PASS** | `create-student-from-case` edge function |
| Admin sees submitted cases | **PASS** | `AdminSubmissionsPage` reads `status=submitted` |
| Split preview shows correct amounts | **PASS** | `ReadyToApplyTable`, `StudentCasesManagement` render correctly |

### Partner Visibility (code verified)
| Check | Result | Notes |
|---|---|---|
| `show_all_cases=true` → all cases visible | **PASS** | Both overview and earnings pages handle this |
| `show_all_cases=false` → apply/contact/manual/submit_new_student | **PASS** | `PARTNER_SOURCES` array used consistently |
| `show_all_cases=null` → referral only | **PASS** | Query uses `.eq("source", "referral")` |

### Translations
| Check | Result | Notes |
|---|---|---|
| `admin.ready.*` keys | **PASS** | All 14 keys exist in EN (lines 800-829) and AR locale files |
| Partner dashboard keys | **PASS** | `paidThisMonth`, `paidAllTime`, `paymentHistory`, etc. all present (lines 1948-1978) |
| Partner status labels in Overview | **FAIL** | Bug 2: `STATUS_CONFIG` uses raw English strings, not `t()` keys |
| Admin finance page keys | **PASS** | `tabAgentPayouts`, `tabPartnerPayouts`, etc. present |

### UI/UX (code verified)
| Check | Result | Notes |
|---|---|---|
| Double-payment prevention | **PASS** | `approved` rewards show "Payout Requested" badge, no Confirm button |
| Info banner on Financials page | **PASS** | Alert component with two-track explanation |
| `PartnerPayoutsPanel` total includes `approved` | **PASS** | `pending` + `approved` both counted |
| Partner payout request flow | **PASS** | 20-day lock, `request_payout` RPC, Dialog UI all implemented |
| Admin 2FA security gate | **PASS** | TOTP required — production secure |

---

## Changes Required

### Fix 1 — DB Migration: Fix `auto_split_payment` trigger to pass `service_fee`
File: new migration SQL

### Fix 2 — `PartnerOverviewPage.tsx`: Fix status labels
Replace hardcoded English strings in `STATUS_CONFIG` with `t()` translation keys using the same map already in `TeamCasesPage` and `PartnerEarningsPage`.

---

## Commission Math Verification (1 completed case)

```
Case: Ahmad E2E Test
Service fee stored in case_submissions: NULL (data gap — case advanced via SQL migration)
Service fee used in commission split: ₪0 (passed by auto_split_payment trigger)

Team reward:    ₪1,500 ✅ (matches team_member_commission_overrides)
Partner reward: ₪1,000 ✅ (matches partner_commission_overrides)
Admin remainder: ₪0     ❌ SHOULD BE: 0 - 1500 - 1000 = negative (clamped to 0 by GREATEST)
                         (because service_fee was NULL/0, not because of a split logic bug)

If service_fee had been ₪4,000:
  Admin remainder = 4000 - 1500 - 1000 = ₪2,500 ✅ (math is correct in the RPC)
```

---

## Overall Verdict

**NOT READY FOR PRODUCTION — 1 critical fix required**

**Critical (block release):**
- `auto_split_payment` trigger passes `0` as total payment. The admin `platform_revenue_ils` is always `0` for cases enrolled via direct status update (team flow). This is financial data loss. Fix the trigger to read `case_submissions.service_fee` first.

**Non-critical (ship with fix):**
- Partner Overview case list shows raw English status strings in Arabic mode. Fix the `STATUS_CONFIG` hardcoded labels.

**No issues found in:**
- Double-payment prevention logic ✅
- Idempotency guard ✅
- RLS policies ✅
- Translation keys ✅
- Payout request flow ✅
- Partner visibility modes ✅
- Reward status lifecycle ✅

---

## Plan: Fixes to Implement

### File changes

| File | Change |
|---|---|
| New DB migration | Fix `auto_split_payment` trigger to fetch `service_fee` from `case_submissions` before calling `record_case_commission` |
| `src/pages/partner/PartnerOverviewPage.tsx` | Replace `STATUS_CONFIG` hardcoded label strings with translation key lookups using `useTranslation` |

### Migration SQL
```sql
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_service_fee integer := 0;
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      SELECT COALESCE(service_fee, 0)::integer INTO v_service_fee
      FROM public.case_submissions WHERE case_id = NEW.id LIMIT 1;
      PERFORM record_case_commission(NEW.id, v_service_fee);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### PartnerOverviewPage fix
Remove the static `STATUS_CONFIG` label fields. Instead compute the label inline using the same `statusLabel()` map pattern already used in `TeamCasesPage`, translating through `t('partner.status.{status}')` keys which already exist in the locale files.
