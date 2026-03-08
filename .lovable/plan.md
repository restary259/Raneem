
## Verification Results: 5 Issues Found

### Full Audit Summary

**What works correctly:**
- `CommissionSettingsPanel.tsx` — per-account UI, 3-way visibility pills, save/delete — ✅ correct
- `AdminTeamPage.tsx` — one-partner constraint, delete button, warning banner — ✅ correct  
- `AdminSubmissionsPage.tsx` — split preview panel, password gate, calls `admin-mark-paid` → `record_case_commission` — ✅ correct
- `PartnerStudentsPage.tsx` — 3-way visibility logic, realtime subscriptions — ✅ correct
- `PartnerEarningsPage.tsx` — override-first commission rate, realtime subscriptions — ✅ correct
- `record_case_commission` DB function — reads `cases.partner_id`, checks overrides, writes rewards — ✅ correct

**Bugs found (5 issues):**

---

### Bug 1: CRITICAL — Partner cannot read their own commission override (RLS missing)

**`partner_commission_overrides` table has NO SELECT policy for the partner role.** Only admins can read it.

When `PartnerStudentsPage`, `PartnerOverviewPage`, and `PartnerEarningsPage` call:
```js
supabase.from('partner_commission_overrides').eq('partner_id', uid).maybeSingle()
```
They get **zero rows back** (RLS silently blocks it). The `override` variable is `null`, so the fallback kicks in: default to `apply_page / contact_form` regardless of what admin configured.

**Fix:** Add a DB migration to create a SELECT policy on `partner_commission_overrides` that allows partners to read their own row:
```sql
CREATE POLICY "Partners can read own override"
ON public.partner_commission_overrides FOR SELECT
USING (partner_id = auth.uid());
```
Same for `team_member_commission_overrides`:
```sql
CREATE POLICY "Team members can read own override"
ON public.team_member_commission_overrides FOR SELECT
USING (team_member_id = auth.uid());
```

---

### Bug 2: `PartnerOverviewPage` — wrong visibility logic for `show_all_cases = null`

The page uses a **2-way boolean** check instead of the new **3-way nullable** logic:
```js
// CURRENT (wrong):
const showAll = override?.show_all_cases !== null ? override.show_all_cases : globalShowAll;
if (!showAll) { query = query.in("source", ["apply_page", "contact_form"]); }

// When show_all_cases = null (referral only), falls back to globalShowAll → wrong behavior
```

`PartnerStudentsPage` has the correct 3-way logic but `PartnerOverviewPage` does not. This means the KPI counts on the overview are wrong when visibility is set to "Referral Cases Only".

**Fix:** Rewrite `PartnerOverviewPage`'s visibility section to match `PartnerStudentsPage`:
```js
if (override !== null && override !== undefined) {
  if (override.show_all_cases === false) {
    query = query.in("source", ["apply_page", "contact_form"]);
  } else if (override.show_all_cases === null) {
    query = query.eq("partner_id", uid); // referral only
  }
  // true → no filter
} else {
  query = query.in("source", ["apply_page", "contact_form"]); // default fallback
}
```

---

### Bug 3: `record_case_commission` skips partner commission when cases have `partner_id = null`

From the DB: **all 4 cases have `partner_id = null`** (apply_page and manual sources don't set partner_id). The `record_case_commission` function only creates a partner reward `IF v_case.partner_id IS NOT NULL`. Since the partner has `show_all_cases = true` (sees all cases), they should earn a commission when any case reaches `enrollment_paid` — but the DB function won't create the reward because partner_id isn't set.

**The design gap:** The current architecture ties partner commission to `cases.partner_id`. But when visibility is "All Cases" or "Apply/Contact Only", there's no partner_id on the case to reference.

**Fix:** Two options:
- Option A (simpler): When admin marks a case enrolled and the split panel shows a partner commission, also write `cases.partner_id = partner_id` at that moment so `record_case_commission` works. Since there's only one partner, admin can be presented with the partner's id.
- Option B: Pass the `partner_commission` override amount directly into `record_case_commission` so it doesn't rely on `partner_id` lookup.

**Chosen fix:** In `AdminSubmissionsPage.markEnrolled()`, before calling `admin-mark-paid`, update `cases.partner_id` to the configured partner's ID if there's a partner commission configured and no `partner_id` yet. We fetch the partner from `partner_commission_overrides` and set it on the case.

---

### Bug 4: `PartnerOverviewPage` commission rate display uses wrong fallback after RLS fix

After fixing RLS Bug 1, the `override` will return actual data. But the overview page currently falls back to `globalShowAll` (a boolean from platform_settings) when override is null — this should become the 3-way logic (Bug 2 above). These two bugs are fixed together in `PartnerOverviewPage`.

---

### Bug 5: `team_member_commission_overrides` also has no SELECT policy for team members

Same pattern as Bug 1 — team member commission override can't be read by the team member's own dashboard if we ever build that. Not currently breaking any partner-facing UI, but should be fixed for consistency.

---

## Files to Change — 2 files + 1 DB migration

| What | File/Action |
|------|-------------|
| Add RLS SELECT policies for partners & team members | DB migration (SQL) |
| Fix 3-way visibility logic | `src/pages/partner/PartnerOverviewPage.tsx` |
| Auto-link partner_id at enrollment | `src/pages/admin/AdminSubmissionsPage.tsx` |

### DB Migration SQL
```sql
-- Partners can read their own commission override
CREATE POLICY "Partners can read own override"
ON public.partner_commission_overrides FOR SELECT
USING (partner_id = auth.uid());

-- Team members can read their own commission override
CREATE POLICY "Team members can read own override"
ON public.team_member_commission_overrides FOR SELECT
USING (team_member_id = auth.uid());
```

### PartnerOverviewPage fix
Replace the 2-way `showAll` boolean logic with the same 3-way nullable check already in `PartnerStudentsPage` (about 8 lines changed in the `load` function).

### AdminSubmissionsPage fix
In `markEnrolled()`, before the `admin-mark-paid` call: if `splitPreview.partnerCommission > 0` and `selected.partner_id` is null, look up the single partner account from `partner_commission_overrides` and update `cases.partner_id` on the case row. This ensures `record_case_commission` finds the partner and creates the reward.

### No other changes needed
The realtime wiring, commission calculations, team page, and commission settings UI are all correct. The 3 fixes above close all found gaps.
