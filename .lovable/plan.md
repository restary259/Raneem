
## Root Cause: `show_all_cases = null` filters on the wrong column

### What the DB actually has:
```
partner override: show_all_cases = NULL  →  "Referral Cases Only" mode
referral case:    source='referral', partner_id=NULL, referred_by=NULL
```

### Why the case is invisible:
The `null` branch in all 3 partner pages does:
```js
query = query.eq("partner_id", uid);
```
But the referral case has `partner_id = NULL` — it was created by a student peer-referral from the student dashboard, which sets `source='referral'` but never sets `partner_id`. So `partner_id = uid` matches **zero rows**.

### The semantic mismatch:
"Referral Cases Only" in admin settings means: *cases that came through referral links* — i.e., `source = 'referral'`. But the code filters by `partner_id = uid`, which is a completely different thing (cases explicitly attributed to this partner via a partner link).

### The fix:
Change the `null` branch across all 3 partner pages to filter by `source = 'referral'` instead of `partner_id = uid`:

```js
} else if (override.show_all_cases === null) {
  // "Referral Cases Only" = peer student referrals (source='referral')
  query = query.eq("source", "referral");
}
```

Also update `CommissionSettingsPanel.tsx` description to make the meaning clear: "Only cases where a student referred another student via their dashboard".

### Important: commission logic for referral cases
In `PartnerOverviewPage` and `PartnerEarningsPage`, commission is currently gated on `c.partner_id === userId`. Referral cases have `partner_id = NULL` so they'd show in the list but earn no commission. This is **intentional and correct** — student-to-student referrals should not generate partner commissions (the referred student gets a discount instead, handled separately). The commission column will show "No commission" for these, which is the right behavior.

### Files to change: 3 files

| File | Change |
|------|--------|
| `src/pages/partner/PartnerStudentsPage.tsx` | `null` branch: `.eq("source", "referral")` instead of `.eq("partner_id", uid)` |
| `src/pages/partner/PartnerOverviewPage.tsx` | Same fix in the visibility logic |
| `src/pages/partner/PartnerEarningsPage.tsx` | Same fix in the visibility logic |

No DB migration needed. No commission calculation changes needed.
