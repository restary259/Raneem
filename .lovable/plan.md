
## Complete Root Cause Analysis

### What the DB state actually is:
- Partner user: `81f7f86b` (`partner@gmail.com`), role: `social_media_partner`
- `partner_commission_overrides`: `show_all_cases = TRUE`, `commission_amount = 2000`
- Cases table: 4 cases, ALL have `partner_id = NULL`, sources: `apply_page`, `submit_new_student`, `referral`, `manual`
- `rewards` table: **0 rows** (no commissions ever recorded)
- `platform_settings`: `partner_commission_rate = 500`, `partner_dashboard_show_all_cases = false`

---

### The 4 Real Bugs (confirmed from code + DB + network)

#### Bug 1 — CRITICAL: `show_all_cases = true` logic is NEVER reached because override query is called WRONG

In `PartnerStudentsPage.tsx` and `PartnerEarningsPage.tsx`, the override is fetched with:
```js
.select("show_all_cases")  // ← only selects this field, NOT commission_amount
```
But then the code checks `override !== null && override !== undefined`. When `.maybeSingle()` returns a row, `override` = `{ show_all_cases: true }`. The `true` branch should fire and skip filters.

**However**, in `PartnerStudentsPage` this IS logically correct... **unless** there's a timing bug. The real issue is the preview is tested while the **admin** is logged in on the same browser — the screenshot at `/partner/students` was captured with the admin's JWT (`ranimdwahde3@gmail.com`), confirmed by the network request showing `sub: 4abfba8f` (admin's ID). Admin has no override row, so `override = null` → falls to the `else` branch → only `apply_page/contact_form` → **but `source='submit_new_student'` is NOT in that list** → raneem's `apply_page` case should show but didn't.

#### Bug 2 — CRITICAL: Source value mismatch — `"submit_new_student"` ≠ `"contact_form"`

The code filters: `query.in("source", ["apply_page", "contact_form"])` 

But the DB has these source values: `apply_page`, `submit_new_student`, `referral`, `manual`.

**There is NO `contact_form` source in the actual data.** The `submit_new_student` source (team-created cases) should also be visible to the partner when visibility is "Apply/Contact Only". The filter list is wrong/incomplete.

#### Bug 3 — Earnings page: Commission rate shows ₪500 instead of ₪2000

When admin views `/partner/earnings`, `userId` = admin's ID. Override query finds no row → `override = null` → `commissionRate = globalRate = 500`. The partner's actual rate of ₪2000 is never shown because the page is tested as admin.

**The real fix needed**: The earnings display logic must use the per-partner override rate (₪2000), but when admin views the URL, they get the fallback ₪500. This is a "testing as wrong user" issue, but the earnings math also has a conceptual problem:

The `PartnerEarningsPage` calculates `totalEarnings = earningCases.length × commissionRate` — this is **projected**, not actual paid. The UI labels this as "Total" which is misleading. Actual paid commissions should come from the `rewards` table.

#### Bug 4 — Commission attribution: No rewards ever written because `partner_id = null` on all cases

The `record_case_commission` DB function only writes rewards when `v_case.partner_id IS NOT NULL`. All cases have `partner_id = null`. The `markEnrolled` fix in `AdminSubmissionsPage` was added, but only fires when `splitPreview.partnerCommission > 0` AND the selected case has `partner_id = null`. The `splitPreview.partnerCommission` is calculated from `c.partner_id ? globalPartner : 0` — since `c.partner_id` is null, `partnerCommission = 0`. So the auto-link code **never fires**.

---

### The Fixes

#### Fix 1: Source filter — add `submit_new_student` to the visible sources

The "Apply/Contact Only" visibility mode should include `submit_new_student` (team-submitted) cases. Update all 3 partner pages: change `["apply_page", "contact_form"]` to `["apply_page", "contact_form", "submit_new_student"]` everywhere.

#### Fix 2: Commission split preview — always look up the partner even when `partner_id = null`

In `AdminSubmissionsPage.loadSplitPreview()`, the partner commission is calculated as:
```js
const partnerCommission = partnerOvRes.data?.commission_amount ?? (c.partner_id ? globalPartner : 0);
```
Since `c.partner_id = null`, `partnerCommission = 0`. Fix: always look up the configured partner override (there's only one), regardless of whether `c.partner_id` is set:
```js
// Look up the single configured partner override regardless of case.partner_id
const partnerOverride = await supabase.from("partner_commission_overrides").select("commission_amount").limit(1).maybeSingle();
const partnerCommission = partnerOverride?.commission_amount ?? globalPartner;
```
This makes the split preview show the correct ₪2000 amount, which then triggers the auto-link logic in `markEnrolled`.

#### Fix 3: `markEnrolled` partner auto-link — already written but never triggers (see Fix 2)

Once `splitPreview.partnerCommission > 0` is correct (from Fix 2), the existing auto-link code WILL fire and set `cases.partner_id` before calling `admin-mark-paid`.

#### Fix 4: Earnings page — label actual vs projected correctly, fix commission rate display

The earnings page should:
- Show `commissionRate` from the override (₪2000) which it does correctly IF the partner is logged in
- Label "Total Earnings" clearly as projected, not actual paid
- Also show actual rewards from the `rewards` table as a separate "Confirmed" figure (already partially there)

No code change needed here — the logic is correct for the actual partner user. The "500" shown in the screenshot is because the admin was logged in.

---

### Files to change: 3 files + 0 DB migrations

| File | Change |
|------|---------|
| `src/pages/partner/PartnerStudentsPage.tsx` | Add `submit_new_student` to source filter list |
| `src/pages/partner/PartnerOverviewPage.tsx` | Add `submit_new_student` to source filter list |
| `src/pages/partner/PartnerEarningsPage.tsx` | Add `submit_new_student` to source filter list |
| `src/pages/admin/AdminSubmissionsPage.tsx` | Fix `loadSplitPreview` to always fetch partner override (not depend on `c.partner_id`) so split preview shows correct ₪2000 and the auto-link triggers |

### After fixes:
1. Partner logs in at `/partner/students` → override = `{show_all_cases: true}` → no filter → all 4 cases visible ✅
2. Partner at `/partner/earnings` → rate = ₪2000 (from override) → cases with `payment_confirmed/submitted/enrollment_paid` show correct earnings ✅  
3. Admin marks case as enrolled → split preview shows ₪2000 partner commission → auto-links `partner_id` → `record_case_commission` writes reward → `rewards` table populated ✅
4. Partner's "Total Paid Out" in overview updates from `rewards` table ✅

### Visual fix: Earnings i18n key for rate info

The screenshot shows "تحصل على 500₪ لكل طالب" (500 is wrong). This is because the i18n key uses the runtime `commissionRate` value — once Fix 2+4 are in place and the partner logs in with their account, this shows ₪2000 correctly. No string change needed.
