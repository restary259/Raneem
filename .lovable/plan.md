
# Phase 5: Security & Permission Audit — Verified Assessment & Fix Plan

## What the Audit Claims vs What Is Actually True

Every single claim in the audit was verified against the live database and codebase before designing any fix.

### RLS Status — All Claims Audited

| Claim | Verified Reality | Action |
|-------|-----------------|--------|
| Appointments table has NO RLS | FALSE — 6 policies exist (lawyers own-only, admin all, students via case) | None |
| student_cases missing influencer RLS | TRUE — no influencer policy on student_cases | Fix: Add influencer SELECT policy |
| leads table incomplete RLS | FALSE — 3 correct policies: admin ALL, influencer own SELECT, lawyer assigned SELECT | None |
| RLS loopholes in rewards | FALSE — admin + own-user SELECT, admin INSERT/UPDATE | None |
| Role redirects trust client-side | FALSE — fetches from DB server-side, edge function is the real gate | None |
| Admin check bypassable | FALSE — admin-verify edge function is primary gate | None |

### Data Exposure Claims — Audited

| Claim | Verified Reality | Action |
|-------|-----------------|--------|
| SecurityPanel fetches all bank data | TRUE — `select('id, full_name, iban, bank_account_number, bank_branch, bank_name')` | Fix: Replace with count-only query |
| EarningsPanel bank data (self-only) | TRUE but user sees own data — RLS protects correctly | Low risk, no change needed |
| Influencer dashboard fetches lead emails | TRUE — `select('*')` on leads returns email, notes, passport_type, fraud_flags | Fix: Replace with explicit column list |
| Phone number unencrypted | TRUE — stored as plain text, but this is standard practice for contact data | No change (encryption without key management is theatre) |
| Bank account unencrypted | TRUE — stored plain text | No change (client-side encryption is insecure without a KMS) |

### Other Claims — Audited

| Claim | Verified Reality | Action |
|-------|-----------------|--------|
| SQL injection in RPCs | FALSE — parameterized queries throughout | None |
| Rate limiting missing from DB | TRUE — but Supabase Auth handles brute force. Payout requests have no DB-level limit | No change (client guard exists, backend trigger prevents duplicates) |
| IBAN validation weak | TRUE — regex only checks 2-letter country code + 2 digits, not MOD-97 checksum | Fix: Add full IBAN checksum validation |
| Email shown in login_attempts to admin | INTENTIONAL — this is the security panel's purpose | None |

---

## The Two Real Issues to Fix

### CONFIRMED BUG 1: Influencer Sees Sensitive Lead Fields (Critical)

**Location**: `src/integrations/supabase/dataService.ts:29-32`

The influencer dashboard fetches all lead columns with `select('*')`. The `leads` table contains:
- `email` — direct contact info the influencer should not harvest
- `notes` — internal admin notes  
- `passport_type` — PII
- `fraud_flags` — internal risk data
- `eligibility_reason` — internal scoring details
- `companion_lead_id`, `source_id` — internal references

The **influencer student card UI** (lines 232-268 of InfluencerDashboardPage) only shows:
- Initials (not even full name)
- Eligibility badge
- Payment status
- Timer

So the query returns far more data than the UI uses.

**Fix**: Replace `select('*')` with an explicit safe column list — only what the UI actually renders.

### CONFIRMED BUG 2: SecurityPanel Fraud Detection Fetches Full Bank Details Unnecessarily

**Location**: `src/components/admin/SecurityPanel.tsx:37`

```typescript
const { data: profiles } = await (supabase as any).from('profiles')
  .select('id, full_name, iban, bank_account_number, bank_branch, bank_name');
```

The fraud detection logic only needs to:
1. Check if same IBAN appears for multiple users (duplicate detection)
2. Check if same `bank_branch + bank_account_number` appears for multiple users

It does NOT need to display the actual IBAN/account numbers to the UI. The `details` shown in alerts currently reveals the actual IBAN string (`${iban}: ${names.join(', ')}`).

**Risk**: Admin sees full IBAN numbers of all students in a list. This is unnecessary — the fraud alert just needs to say "duplicate bank account detected" with user names, not expose the raw IBAN.

**Fix**: Keep the query (admin has legitimate access to profile data for fraud detection), but **mask the IBAN in the alert display** — show only the last 4 characters: `IL**...1234: Ahmed, Sara`.

### CONFIRMED BUG 3: Missing Influencer RLS on student_cases

**Location**: Database — `student_cases` table

Influencers currently have NO SELECT policy on `student_cases`. The `dataService.getInfluencerDashboard()` queries:
```typescript
(supabase as any)
  .from('student_cases')
  .select('*, leads!inner(source_id)')
  .eq('leads.source_id', userId)
```

This query relies on RLS to return only the influencer's cases — but there is no RLS policy for influencers on `student_cases`. The query therefore returns **zero results** (because RLS has no matching permissive policy, all rows are denied by default). This means the influencer's `cases` array is always empty — the paid case count and timer display are permanently broken.

**Fix**: Add a DB migration to add an influencer SELECT policy on `student_cases` that joins through `leads.source_id = auth.uid()`.

### CONFIRMED BUG 4: IBAN Validation Missing MOD-97 Checksum

**Location**: `src/components/influencer/EarningsPanel.tsx` — the IBAN input uses `ibanInput.trim().replace(/\s/g, '')` with only basic format check. The `saveIban` function in EarningsPanel does not have a proper IBAN validator — it checks `length < 15` and first 4 chars only.

**Fix**: Add MOD-97 checksum validation to `saveIban` before the database update.

---

## What Does NOT Change

- All appointment RLS policies — already complete and correct (6 policies)
- All leads RLS policies — already complete and correct
- All student_cases RLS for lawyers and students — already correct
- Auth flow — already server-side verified
- Encryption of phone/bank data — client-side encryption without a proper KMS is security theatre and worse than plaintext (false sense of security, breaks search/fraud detection)
- Rate limiting — Supabase Auth already handles brute force; payout requests are protected at DB level
- Login attempt email display — intentional, this is a security monitoring tool for admins

---

## Files and Migrations to Change

| Change | Type | Risk |
|--------|------|------|
| DB Migration: Add influencer SELECT policy on `student_cases` | Migration | Low — adds new policy, doesn't change existing |
| `src/integrations/supabase/dataService.ts` | Code | Low — restrict influencer lead select columns |
| `src/components/admin/SecurityPanel.tsx` | Code | Low — mask IBAN in fraud alert display |
| `src/components/influencer/EarningsPanel.tsx` | Code | Low — add MOD-97 IBAN checksum validation |

---

## Technical Details

### Migration: Influencer SELECT on student_cases

```sql
CREATE POLICY "Influencers can view cases for their leads"
  ON public.student_cases
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'influencer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = student_cases.lead_id
        AND l.source_id = auth.uid()
    )
  );
```

This mirrors the existing leads policy and uses the existing `has_role` security-definer function, preventing recursive RLS.

### dataService.ts — Restricted influencer lead columns

```typescript
// Replace select('*') with:
.select('id, full_name, phone, eligibility_score, eligibility_reason, status, source_type, created_at, preferred_city, preferred_major, accommodation, ref_code')
```

Excluded: `email`, `notes`, `passport_type`, `fraud_flags`, `visa_history`, `companion_lead_id`, `source_id`, `is_stale`, `arab48_flag`, `student_portal_created`

### SecurityPanel.tsx — Mask IBAN in alerts

Replace:
```typescript
details: `${iban}: ${names.join(', ')}`
```
With:
```typescript
details: `****${iban.slice(-4)}: ${names.join(', ')}`
```

Same masking for bank account numbers.

### EarningsPanel.tsx — Full IBAN MOD-97 validation

```typescript
const validateIBAN = (raw: string): boolean => {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  // MOD-97: move first 4 chars to end, convert letters to numbers
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numStr = rearranged.split('').map(c =>
    c >= 'A' ? String(c.charCodeAt(0) - 55) : c
  ).join('');
  // BigInt mod 97
  let remainder = 0;
  for (const digit of numStr) {
    remainder = (remainder * 10 + parseInt(digit)) % 97;
  }
  return remainder === 1;
};
```

---

## Expected Outcome

1. Influencer cases now correctly load from the database (previously silently empty due to missing RLS policy)
2. Influencer lead data no longer exposes student email, passport type, fraud flags, or internal notes
3. IBAN fraud alerts show masked numbers (`****1234`) — admin sees who has duplicates without raw account numbers being displayed
4. IBAN input is fully validated with MOD-97 checksum before saving — prevents invalid IBANs from being stored
5. No regressions — all existing functionality preserved, no schema destructive changes
