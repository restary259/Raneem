

## Root Cause: 3 Separate Issues Found

### Issue 1 — Contact form DID create a case, but it was a **duplicate phone** (silent 200)

From the DB query, phone `0525260547` (which you tested in the screenshot) already had an existing case (`raneem gmeel dawahde`, `source: apply_page`). The `create-case-from-apply` edge function detected the duplicate and returned:
```json
{ "duplicate": true, "case_id": "existing-id", ... }
```
The contact form catches this silently as a success (HTTP 200). The case was NOT created — it just updated education fields on the existing one. This is expected behavior by design, but **the user gets a "Sent successfully!" toast with no indication it was a duplicate**. This is confusing — they think a new case was submitted.

**Fix**: When the edge function returns `duplicate: true`, show a softer toast: *"We already have your details on file. Our team will reach out soon."* instead of *"Sent successfully!"*

---

### Issue 2 — Partner page (`show_all_cases = false`) **should** show the contact form case but has an RLS logic gap

The partner override for `partner@gmail.com` is `show_all_cases = false` → "Apply / Contact Only". The partner page queries:
```js
query = query.in("source", ["apply_page", "contact_form", "submit_new_student", "manual"]);
```
This is correct — `contact_form` IS in the list. But the RLS policy for the `cases` table for partners is:
```sql
Policy: "Partner can view all cases" 
→ USING: has_role(auth.uid(), 'social_media_partner'::app_role)
```
This gives the partner SELECT on **ALL cases**. The 3-way filtering (apply_page/contact_form/referral) is done **entirely client-side in JS**, not in RLS. So the RLS is not the problem here.

The real problem: **the partner's commission_amount is ₪800 but `partner_id` on the cases is `NULL`**. Because contact form cases (`source: contact_form`) are inserted without a `partner_id` — they are anonymous agency leads. So in `PartnerOverviewPage` and `PartnerEarningsPage`:
```js
const attributedCases = cases.filter((c) => c.partner_id === userId); // → ALWAYS 0
```
This means the partner sees cases in the pipeline list (via `show_all_cases = false` → shows contact_form cases) but **earnings table is empty** because none have `partner_id = their UID`. This is the core mismatch.

---

### Issue 3 — `show_all_cases = false` ("Apply / Contact Only") commission semantics are wrong

**The design intent for "Apply / Contact Only" mode**: The partner sees ALL agency-generated cases (apply_page + contact_form + manual) as a shared pool — these are not "their" cases personally, but they represent the agency's student pipeline. The partner earns a commission on those cases.

But the current code gates commissions with `partner_id === userId` — which will NEVER be true for any agency-generated case (they all have `partner_id = NULL`).

**The fix**: When a partner is in `show_all_cases = false` (Apply/Contact Only) mode, they should earn commission on ALL the visible cases that reach `PAID_STATUSES`, not just `partner_id = uid` ones.

The `partner_id = uid` attribution check should **only apply when `show_all_cases = true`** (All Cases mode), where some cases are theirs and some aren't.

---

## Fix Plan

### 3 files to change, no DB migration needed

**File 1: `src/components/landing/Contact.tsx`**
- Check the edge function response body for `duplicate: true`
- Show a different toast message when it's a duplicate: *"We already have your details — our team will reach out soon!"*

**File 2: `src/pages/partner/PartnerEarningsPage.tsx`**
- Pass `show_all_cases` (visibility mode) into the commission logic
- When `show_all_cases === false`: `earningCases = cases.filter(c => PAID_STATUSES.includes(c.status))` — ALL visible cases earn commission
- When `show_all_cases === true`: `earningCases = attributedCases.filter(c => PAID_STATUSES.includes(c.status))` — only `partner_id = uid` cases earn commission  
- When `show_all_cases === null` (Referral only): `earningCases = attributedCases.filter(...)` — referral cases earn commission only if attributed

**File 3: `src/pages/partner/PartnerOverviewPage.tsx`**
- Same commission scoping fix — `paid` count should use all visible cases when `show_all_cases === false`
- Update projected earnings banner to use the corrected `paid` count

```text
Visibility Mode         | Cases Shown              | Earns Commission On
------------------------|--------------------------|--------------------------------
show_all_cases = false  | contact_form/apply_page  | ALL visible cases (agency pool)
show_all_cases = true   | everything               | only where partner_id = uid
show_all_cases = null   | source = referral        | only where partner_id = uid
No override row         | apply_page/contact_form  | ALL visible cases (agency pool)
```

### Why no DB migration?
- No schema changes needed
- RLS is fine — partner sees all cases via `social_media_partner` role check
- The commission filtering is frontend-only logic

