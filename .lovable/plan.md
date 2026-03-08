## Bug Analysis: Visibility Mode Logic is Semantically Wrong

### What the three modes are SUPPOSED to mean (from CommissionSettingsPanel.tsx):

```
true  → "All Cases" — sees everything
false → "Apply / Contact Only" — only auto-generated leads
null  → "Referral Cases Only" — only cases that came through referral links from student dashboards 
```

### The actual bug — two separate problems:

**Problem 1: `null` mode (Referral Cases Only) checks the wrong column**

Current code in all 3 partner pages:

```js
} else if (override.show_all_cases === null) {
  query = query.eq("partner_id", uid);  // ← WRONG
}
```

This checks `cases.partner_id = partner_user_id`. But `partner_id` on a case is only set when:

- A case comes in via a partner's referral link (e.g. `?ref=partnerID` on the apply page)
- Admin manually links a partner

Student-to-student referrals (`source='referral'`) have:

- `source = 'referral'`
- `referred_by = <student_who_referred>` (NOT the social media partner)
- `partner_id = NULL`

So **"Referral Cases Only"** should correctly mean: cases where `partner_id = uid` (partner-attributed cases via the partner's own link), which is the ONLY correct interpretation for the social media partner context. The current DB query IS correct for that intent — `partner_id = uid`.

**But the real bug is in the `false` mode (Apply/Contact Only):**

```js
if (override.show_all_cases === false) {
  query = query.in("source", PARTNER_SOURCES);
  // PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "referral", "manual"]
}
```

This includes `"referral"` in the source filter. But `source='referral'` cases are student-to-student referrals — they have a `referred_by` (student) set, not a `partner_id`. These should NOT appear under "Apply / Contact Only" mode because the user said: **"referrals are ONLY cases created by students using their student dashboard"** — meaning they are a separate category entirely.

**Problem 2: `show_all_cases = true` should not count referral-source cases toward partner commission**

When a partner is in "All Cases" mode, they see referral cases too — but `source='referral'` cases were created by students (peer referrals), not by the social media partner. The partner should NOT earn a commission on those cases, yet the Earnings page counts all visible cases.

### The correct source semantics:

```
apply_page          → Student applied via the public apply form (no partner link)
submit_new_student  → Team member submitted manually
manual              → Admin created manually
referral            → Student referred another student from their dashboard (peer referral)
                      → these have referred_by = student_id, NOT partner_id
                      → partner earns NOTHING on these
                      → show_all_cases=false should NOT include these
```

Cases WHERE partner earns commission:

- Any case where `partner_id = this_partner_id` (regardless of source)

### What needs to change:

**Fix 1 — Remove `"referral"` from the `PARTNER_SOURCES` filter list (all 3 partner pages)**

`PARTNER_SOURCES` is used in the `show_all_cases=false` branch. Removing `"referral"` ensures the partner sees only auto-generated agency leads, not student peer referrals:

```js
const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];
// "referral" removed — these are peer student referrals, not partner-generated
```

**Fix 2 — `show_all_cases = null` branch should filter to `partner_id = uid` (already correct) but needs clear comments**

The current `query.eq("partner_id", uid)` is semantically correct for "cases attributed directly to this partner". Keep it, just add clarity.

**Fix 3 — Earnings calculation: only count cases where `partner_id = uid` as commission-generating**

Currently `earningCases = cases.filter(c => PAID_STATUSES.includes(c.status))` — this counts ALL visible cases including peer referrals and unattributed cases.

The earnings should split into:

- **Attributed cases** (where `partner_id = uid`) → earns `commissionRate` each when paid
- **Visible-only cases** (no `partner_id`) → shows in pipeline tracker, no commission

Fix in `PartnerEarningsPage`: also select `partner_id` in the query, then:

```js
const commissionCases = cases.filter(c => c.partner_id === userId);
const earningCases = commissionCases.filter(c => PAID_STATUSES.includes(c.status));
// non-commission cases still show in pipeline but show ₪0 commission
```

Same fix in `PartnerOverviewPage`:

```js
const commissionCases = cases.filter(c => c.partner_id === userId);
const paid = commissionCases.filter(c => PAID_STATUSES.includes(c.status)).length;
// projectedEarnings = paid * commissionRate (only attributed paid cases)
```

### Files to change: 3 files, no DB migration


| File                      | Change                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PartnerStudentsPage.tsx` | Remove `"referral"` from `PARTNER_SOURCES`; add `partner_id` to select; display commission badge only on attributed cases           |
| `PartnerEarningsPage.tsx` | Remove `"referral"` from `PARTNER_SOURCES`; add `partner_id` to select; filter commission calculation to `partner_id = userId` only |
| `PartnerOverviewPage.tsx` | Remove `"referral"` from `PARTNER_SOURCES`; add `partner_id` to select; compute KPIs based on attributed cases only                 |


### Visual impact:

- Students page: referral cases no longer appear under "Apply/Contact Only" mode ✓
- Earnings page: only cases with `partner_id = partner_uid` show a commission amount; other visible cases show "No commission" in pipeline ✓
- Overview KPIs: "Projected Earnings" based on attributed+paid cases only ✓
- "Referral Cases Only" mode: correctly shows only cases linked to this partner via partner link ✓