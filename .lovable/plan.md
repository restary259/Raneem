

# Team Dashboard Earnings Fix -- Complete Scan Results

## Issue Found: Earnings Not Showing for Team Members

### Root Cause
The `auto_split_payment` database trigger fires when a case moves to `paid` status. It creates reward entries for **influencers** and **referrals**, but **never creates a reward for the lawyer/team member**. The Earnings tab uses the `EarningsPanel` component which reads exclusively from the `rewards` table. Since no reward row exists for the lawyer, earnings show as 0.

**Evidence:** Case `74ebe0a8...` has `lawyer_commission = 1000` and `paid_at` set, but the `rewards` table has zero rows for the assigned lawyer `4e7dd70d...`.

### Current Flow (Broken)
1. Admin sets `lawyer_commission` on the case (money profile)
2. Team member clicks "Submit for Application" --> status becomes `paid`, `paid_at` is set
3. `auto_split_payment` trigger fires --> creates rewards for influencer only
4. Team member opens Earnings tab --> reads `rewards` table --> shows 0

### Fixed Flow
1-3 same as above
4. `auto_split_payment` trigger ALSO creates a reward row for the assigned lawyer with `lawyer_commission` amount
5. Team member opens Earnings tab --> reads `rewards` table --> shows correct earnings

---

## Changes

### 1. Update `auto_split_payment` Database Trigger
Add a block that creates a reward for the assigned lawyer when `lawyer_commission > 0`:

```sql
-- After existing influencer/referral reward logic, add:
IF NEW.assigned_lawyer_id IS NOT NULL AND NEW.lawyer_commission > 0 THEN
  INSERT INTO rewards (user_id, amount, status, admin_notes)
  VALUES (NEW.assigned_lawyer_id, NEW.lawyer_commission, 'pending',
          'Auto-generated lawyer commission from case ' || NEW.id::text);
END IF;
```

### 2. Backfill Existing Paid Cases
Insert a reward row for the already-paid case so the team member sees their existing earnings immediately:

```sql
INSERT INTO rewards (user_id, amount, status, admin_notes)
VALUES ('4e7dd70d-0ef1-4b79-9f34-476b8111dfea', 1000, 'pending',
        'Backfill: lawyer commission from case 74ebe0a8...');
```

### 3. Fix EarningsPanel `requestor_role` for Team Members
The EarningsPanel currently hardcodes `requestor_role: 'influencer'` when creating payout requests. For team members, this should be `'lawyer'`. Add a `role` prop to EarningsPanel and pass it from TeamDashboardPage.

---

## Security Scan Results
Database linter: **No issues found.** All RLS policies are in place. The lawyer DELETE policy added earlier is working correctly.

## Files to Modify

| File | Change |
|------|--------|
| Database function `auto_split_payment` | Add lawyer reward creation block |
| Database data (backfill) | Insert reward for existing paid case |
| `src/components/influencer/EarningsPanel.tsx` | Add `role` prop, use it for `requestor_role` |
| `src/pages/TeamDashboardPage.tsx` | Pass `role="lawyer"` to EarningsPanel |

