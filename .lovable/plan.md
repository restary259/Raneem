
## Full QA Audit Report — Case Flow, Commission Split & Partner Visibility

---

### PHASE 1 — Backend Scan Results (Pre-Login Verification)

---

**1.1 — `record_case_commission` Function: ✅ PASS**

The function body was retrieved directly from `pg_proc`. It contains:

```sql
-- Guard: never split twice
IF EXISTS (SELECT 1 FROM public.cases WHERE id = p_case_id AND commission_split_done = true) THEN
  RETURN;
END IF;
```

The idempotency guard is present and correct. The function:
- Reads `partner_commission_overrides` for the case's `partner_id`
- Reads `team_member_commission_overrides` for the case's `assigned_to`
- Falls back to `platform_settings.partner_commission_rate` / `team_member_commission_rate` when no override row exists
- Updates `cases.commission_split_done = true` and sets `platform_revenue_ils`
- Inserts `rewards` rows using `ON CONFLICT DO NOTHING`

---

**1.2 — `cases` Table Column Verification: ✅ PASS**

All required columns confirmed present:

| Column | Type | Default | Nullable |
|---|---|---|---|
| `commission_split_done` | boolean | false | NO |
| `platform_revenue_ils` | integer | 0 | NO |
| `partner_id` | uuid | — | YES |
| `assigned_to` | uuid | — | YES |
| `status` | text | 'new' | NO |

---

**1.3 — `partner_commission_overrides` for partner@gmail.com: ✅ PASS WITH NOTE**

```
partner_id:       81f7f86b-007d-449a-a8a4-c6e833c5c170
commission_amount: 1000
show_all_cases:   false
email:            partner@gmail.com
full_name:        partner
```

**Current mode: `show_all_cases = false`** → Apply/Contact Only (agency-generated leads). The partner sees cases with `source IN ('apply_page', 'contact_form', 'submit_new_student', 'manual')`.

---

**1.4 — `team_member_commission_overrides` for team@gmail.com: ✅ PASS**

```
team_member_id:    ebe99acb-8f75-4d7e-a175-c0b5bccd8d97
commission_amount: 1500
email:             team@gmail.com
full_name:         team
```

Team commission override is ₪1,500 per case.

---

**1.5 — Test Cases in the DB: ⚠️ PARTIAL PASS — CRITICAL BUG FOUND**

```
full_name: "test 2"
  id:                   bfbfa1df-4bc3-46e0-affd-36fdc88fd742
  status:               contacted
  source:               apply_page
  assigned_to:          ebe99acb (= team@gmail.com) ✅
  partner_id:           null ⚠️
  commission_split_done: false
  platform_revenue_ils:  0

full_name: "Tes1"
  id:                   4bbff49e-ad3f-4ea1-be42-d64774810a42
  status:               new
  source:               apply_page
  assigned_to:          ebe99acb (= team@gmail.com) ✅
  partner_id:           null ⚠️
  platform_revenue_ils:  0
```

**⚠️ BUG IDENTIFIED — `partner_id` is NULL on both cases.**

This means when `record_case_commission` fires, `v_case.partner_id IS NOT NULL` will be `false` → **the partner will receive zero commission** even though there is a partner_commission_overrides row.

The `AdminSubmissionsPage.tsx` already has a workaround for this (lines 215–229): if `splitPreview.partnerCommission > 0` AND `selected.partner_id` is null, it looks up the first `partner_commission_overrides` row and writes the `partner_id` onto the case before calling `admin-mark-paid`. This auto-link logic is present in code.

**⚠️ However, there is a second bug in this auto-link logic:**

```ts
// Line 163–165 in AdminSubmissionsPage.tsx:
c.partner_id
  ? (supabase).from("partner_commission_overrides").select("commission_amount").eq("partner_id", c.partner_id).maybeSingle()
  : (supabase).from("partner_commission_overrides").select("commission_amount").limit(1).maybeSingle(),
```

When `c.partner_id` is null, the split preview fetches **the first partner override row ever inserted** (no filter, `.limit(1)`) — not necessarily the partner associated with the case. If there are multiple partners, this would assign the wrong partner. Currently with one partner in the system this works, but it is not production-safe for multiple partners.

**The correct flow should be:** `partner_id` should be set at case creation time (when a lead was referred by or linked to a specific partner), not auto-assigned at payment time.

---

### PHASE 2 — Team Login: Case Status & Commission

**2.1 Cases visibility:** Both test cases (`test 2` and `Tes1`) are correctly assigned to `team@gmail.com` (user `ebe99acb`). They will be visible in the Team Dashboard cases list under the "My Cases" view since `assigned_to = user.id`.

**2.2 Pipeline progression:** The `CaseDetailPage.tsx` enforces strict sequential progression via `STRICT_NEXT`:
```
new → contacted → appointment_scheduled → profile_completion → payment_confirmed → submitted → enrollment_paid
```
`test 2` is currently at `contacted` — the next allowed step is `appointment_scheduled`.

**2.3 Payment Confirmation:** `PaymentConfirmationForm.tsx` correctly writes to `case_submissions` with `service_fee` and `payment_confirmed = true`, then moves the case to `payment_confirmed`. This is correct.

**2.4 Submit to Admin:** Moving from `payment_confirmed` → `submitted` is gated by a confirmation dialog in `CaseDetailPage.tsx`. The `AdminSubmissionsPage.tsx` fetches cases with `.in("status", ["submitted", "payment_confirmed"])` — both statuses appear in the Pending queue. ✅

---

### PHASE 3 — Admin: Commission Split Verification

**Commission Math for "test 2" if service fee = ₪4,000:**

| Item | Amount | Source |
|---|---|---|
| Service fee | ₪4,000 | entered by team |
| Partner commission | ₪1,000 | `partner_commission_overrides.commission_amount` |
| Team commission | ₪1,500 | `team_member_commission_overrides.commission_amount` |
| Platform revenue | ₪1,500 | `4000 - 1000 - 1500 = 1500` |

**⚠️ BUT: since `partner_id = null` on the case, the auto-link code in `AdminSubmissionsPage.tsx` (line 215–229) must fire first to write `partner_id` onto the case before `record_case_commission` runs.** If the auto-link fires correctly → commission split will be correct. If it doesn't → partner gets ₪0.

**Split preview in UI:** `loadSplitPreview()` will show `partnerCommission = 1000` (from the first override row, since `c.partner_id` is null → uses `.limit(1).maybeSingle()`). This is visually correct in the single-partner scenario.

**Idempotency:** `record_case_commission` has `ON CONFLICT DO NOTHING` on the rewards INSERT plus the `commission_split_done` guard at the top. Calling `admin-mark-paid` twice is handled by the edge function (it checks `status === 'enrollment_paid'` and returns `{ ok: true, message: "Already marked as paid" }` — this is in `supabase/functions/admin-mark-paid/index.ts`). ✅

---

### PHASE 4 — Partner Earnings Visibility

**`PartnerEarningsPage.tsx` logic confirmed:**

With `show_all_cases = false` (Apply/Contact Only mode):
- `poolMode = true` → partner earns on ALL visible agency cases (not just `partner_id = uid`)
- Visible cases: `source IN ('apply_page', 'contact_form', 'submit_new_student', 'manual')`
- Commission per case: ₪1,000 (from override)
- Earning trigger: `status IN ('payment_confirmed', 'submitted', 'enrollment_paid')`

**⚠️ DISCREPANCY FOUND — Earnings page vs. Rewards table:**

The `PartnerEarningsPage.tsx` **does not read from the `rewards` table**. It calculates earnings as `earningCases.length × commissionRate`. This means:
- The UI earnings figure is a **projection** (count × rate), not actual DB-confirmed rewards
- After `admin-mark-paid` fires and a real `rewards` row is inserted, the UI figure will match by coincidence (same calculation)
- But if the admin overrides a commission amount, or if `record_case_commission` was never called for some cases, the UI could show a different number than actual DB rewards

**The `TeamAnalyticsPage.tsx` "Earned This Month" KPI reads from the actual `rewards` table** — this is architecturally inconsistent with how partner earnings are displayed. Partners see a computed projection; team members see actual DB rows.

---

### PHASE 5 — Partner Visibility Override: Code Verification

**`PartnerStudentsPage.tsx` and `PartnerEarningsPage.tsx` both implement the same 3-mode logic:**

```
show_all_cases = false → source IN ('apply_page', 'contact_form', 'submit_new_student', 'manual')
show_all_cases = null  → source = 'referral'
show_all_cases = true  → no filter (all cases)
no override row       → fallback to globalShowAll setting → currently false → same as apply/contact only
```

**What the partner would see in each mode (based on current DB):**

| Mode | Cases visible |
|---|---|
| `false` (current) | `test 2` (apply_page) + `Tes1` (apply_page) = 2 cases |
| `null` | 0 cases (no referral-source cases exist) |
| `true` | `test 2` + `Tes1` = 2 cases (same, since all current cases are apply_page) |

**⚠️ `partner_dashboard_show_all_cases` in `platform_settings`:** The global setting is `false`. The `PartnerEarningsPage` reads this as `globalShowAll`. When `override.show_all_cases` is null/undefined but there IS an override row, the code does:
```ts
poolMode = override.show_all_cases === false;  // null === false → false
```
This means with `show_all_cases = null`, `poolMode = false` → partner earns only on cases where `partner_id = uid`. Since `partner_id = null` on both cases, the partner would see **₪0 earnings** in null mode despite seeing the cases. This is the intended behavior per the architecture doc.

---

### PHASE 6 — Student Account

`ProfileCompletionModal.tsx` and `create-student-from-case` edge function handle student account creation. The team's `StudentProfilesManagement.tsx` creates accounts via the `create-student-standalone` edge function. Rewards table has zero rows for both test users — confirmed by DB query returning `[]`.

---

### BUGS SUMMARY

| # | Severity | Bug | Phase | Fix Required |
|---|---|---|---|---|
| 1 | HIGH | Both test cases have `partner_id = null`. The auto-link in `AdminSubmissionsPage` auto-assigns the **first** partner override row (no filter) — unsafe with multiple partners | 1.5 / 3.3 | Set `partner_id` at case creation OR implement per-case partner selection |
| 2 | MEDIUM | Partner earnings page shows a **computed projection** (count × rate), not actual `rewards` rows — inconsistent with team analytics KPI which reads actual DB rows | 4.2 | Either read from `rewards` table or add a note clarifying this is projected |
| 3 | LOW | `platform_settings.team_member_commission_rate` is ₪1,500 but that is also the override value — both are identical, making it impossible to distinguish "override" from "default" for team | 1.4 | No code change needed; admin should set different values |
| 4 | LOW | `RLS on cases`: partner has `SELECT ALL` with no source filter — visibility filtering is done entirely in frontend JS, not at the DB level. If a partner uses the Supabase API directly they can see all cases regardless of `show_all_cases` | 5.x | Add RLS filter or accept as known limitation |

---

### IMPLEMENTATION PLAN

**Bug 1 Fix — Admin split preview: use case-attributed partner, not first row**

File: `src/pages/admin/AdminSubmissionsPage.tsx`

The `loadSplitPreview` function on line 163–165 falls back to `.limit(1).maybeSingle()` when `c.partner_id` is null. This should not show a commission at all when there's no partner attribution. Change:

```ts
// When c.partner_id is null, partnerCommission should be 0
// (no auto-attribution at preview time)
c.partner_id
  ? supabase.from("partner_commission_overrides")
      .select("commission_amount")
      .eq("partner_id", c.partner_id)
      .maybeSingle()
  : Promise.resolve({ data: null }),
```

And the auto-link code (lines 215–229 in `markEnrolled`) should be **removed** — it's the source of the unsafe auto-attribution. Commission split should only fire for the explicitly-assigned `partner_id`.

**Bug 2 Fix — Partner earnings: add a clarifying note**

File: `src/pages/partner/PartnerEarningsPage.tsx`

Add a small info note clarifying these are projected earnings: "Amounts shown are based on your commission rate × qualifying students. Confirmed payable rewards are settled after final enrollment." The rewards table is the source of truth for actual payouts.

**No DB migration needed** — both fixes are UI/logic changes only.
