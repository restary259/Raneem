
## Deep Scan Results: Complete Database Audit

### What the DB actually contains right now

```text
TABLE: cases (8 rows)
──────────────────────────────────────────────────────────────────
ID prefix   | Full Name              | Phone        | Source              | Status               | partner_id
11eb5171    | Test Contact Form      | 0529999001   | contact_form        | new                  | NULL ✅ visible to partner
83465706    | rasr                   | 05252603257  | apply_page          | new                  | NULL ✅ visible to partner
20470d87    | raneme                 | 05252605477  | apply_page          | new                  | NULL ✅ visible to partner
bf811bb8    | raneem gmeel dawahde   | 0525260547   | apply_page          | submitted            | NULL ✅ visible to partner
0d9bb8b6    | test raya              | 0525260547   | manual              | appointment_scheduled| NULL ✅ visible to partner (same phone!)
52c0cfb1    | ASDAS                  | 0525260547   | manual              | new                  | NULL ✅ visible to partner
4311d085    | rane as dsa dasd       | 0525260546   | submit_new_student  | submitted            | NULL ✅ visible to partner
8268b99d    | rasr                   | 0525260549   | referral            | new                  | NULL NOT in pool mode
──────────────────────────────────────────────────────────────────
```

### 3 Issues Confirmed

**Issue 1 — The "test rayan contact" lead was BLOCKED by a pre-existing referral case (root bug)**

Timeline:
1. Phone `0525260549` → first created at 11:26 as `source='referral'` case ("rasr")
2. At 12:20, contact form submitted for **different person** "test rayan contact" with same phone
3. Edge function `create-case-from-apply` checks for `phone_number = 0525260549` — finds the referral case
4. Returns `duplicate: true` — **no new case created**
5. But the legacy `insert_lead_from_apply` RPC DID run and created a lead in the `leads` table (source_type = contact_form)

**Result:** "test rayan contact" exists only as a `leads` row, NOT in `cases`. The admin pipeline will never see them.

**Issue 2 — Duplicate phone number on 3 different cases (0525260547)**

Three cases all share phone `0525260547`:
- `raneem gmeel dawahde` — apply_page, submitted
- `test raya` — manual, appointment_scheduled  
- `ASDAS` — manual, new

This is data pollution from test data but the edge function currently allows manual and team-submitted cases to bypass the deduplication check. The check only runs in `create-case-from-apply`, not when team creates manually.

**Issue 3 — One lead is an orphan with no matching case**

`test rayan contact` (phone: `0525260549`) exists in `leads` table with `source_type=contact_form` but its only "matched" case is the UNRELATED referral case with the same phone number. This person was effectively lost.

---

### Fix Plan

**No DB migration needed.** All fixes are in the edge function and one data repair.

#### Fix A — `create-case-from-apply/index.ts`: Stop blocking new contact_form submissions when the existing case has a DIFFERENT source

Current logic:
```js
// Blocks on ANY existing case with same phone
if (existingCase) { return duplicate: true }
```

Fixed logic:
```js
// Only block if the existing case is also a contact_form/apply_page submission
// (same person re-submitting). If the existing case is referral/manual/etc., 
// create the new contact_form case anyway (different flow, could be different person).
if (existingCase && ['contact_form', 'apply_page'].includes(existingCase.source)) {
  return duplicate: true
}
// If existingCase.source is 'referral' or 'manual', still create the new case
```

This prevents false duplicate detection across different submission flows.

#### Fix B — Data Repair: Create the missing case for "test rayan contact"

The contact_form lead `test rayan contact` (phone: `0525260549`) was blocked by the referral case but is a real lead. We need to insert their case into the `cases` table manually via the Lovable Cloud database.

Data to insert:
```sql
INSERT INTO public.cases (full_name, phone_number, source, status)
VALUES ('test rayan contact', '0525260549', 'contact_form', 'new');
```

This is a data insert (not a schema migration), so it uses the insert tool.

#### Fix C — Admin Pipeline: Add a warning badge for cases with duplicate phone numbers

The pipeline currently has 3 cases sharing `0525260547`. While this is test data, in production this is dangerous — a team member could advance the wrong case. Add a `⚠️ Duplicate Phone` badge on the case card when another case shares the same phone number.

---

### Files to change

| What | Where | Type |
|------|-------|------|
| Fix duplicate detection logic | `supabase/functions/create-case-from-apply/index.ts` | Edge function edit |
| Insert orphan case | DB data repair | Insert query |
| Add duplicate phone warning badge | `src/pages/admin/AdminPipelinePage.tsx` | UI fix |

### Summary of what "went missing"

Only **1 real case was lost** due to the previous bug: "test rayan contact" (phone 0525260549). It was blocked because another person with the same phone had a referral case. All other cases (contact_form "Test Contact Form" = phone 0529999001) ARE correctly in the system and visible to the partner dashboard.
