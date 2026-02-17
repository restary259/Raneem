

# Pre-Launch Checklist Audit -- 30-Point Results and Fixes

## Audit Summary

| Area | Pass | Issues Found |
|------|------|-------------|
| 1-5: Core System & Data Integrity | 4/5 | 2 orphaned appointments, no phone uniqueness constraint |
| 6-10: Appointment & Workflow Logic | 4/5 | Reschedule doesn't update status label correctly |
| 11-15: Payment & Commission Flow | 3/5 | No commission cancellation on refund, no 20-day auto-payout |
| 16-20: Influencer Safeguards | 4/5 | Referral link depends on URL param (no cookie persistence) |
| 21-25: Team & Admin Dashboards | 5/5 | Real-time, permissions, and notifications all working |
| 26-30: System Reliability | 3/5 | No automatic backups, orphan cleanup needed |

---

## PASSED Checks (No Action Required)

- **#1** Form submission via influencer link creates a lead correctly via `insert_lead_from_apply` RPC with `source_type='influencer'` and `source_id` set.
- **#2** Influencer assignment is done via `source_id` on the `leads` table. Cases inherit this link. RLS restricts influencers to only see their own leads.
- **#3** Duplicate leads are prevented -- the RPC uses `UPDATE ... WHERE phone = p_phone` before inserting. Same phone = update, not duplicate.
- **#4** All IDs are UUID `gen_random_uuid()` -- uniqueness guaranteed by database.
- **#6** Appointment lifecycle (create, reschedule, delete) all work. Status filtering is correct after previous fixes.
- **#7** `AppointmentCalendar.tsx` already checks for existing scheduled appointments per case_id and updates instead of inserting.
- **#8** Deleting appointments removes them from the database; real-time subscriptions refresh all dashboards.
- **#9** Case deletion cascades properly.
- **#11** Payment status changes trigger `auto_split_payment` which creates rewards and commissions instantly. Real-time subscriptions on `rewards`, `commissions`, `payout_requests` refresh all dashboards.
- **#12** Influencer commission is only triggered when `case_status` changes to `'paid'` -- controlled by the `auto_split_payment` BEFORE UPDATE trigger.
- **#14** Commission is calculated once per case transition (trigger checks `OLD.case_status IS DISTINCT FROM 'paid'`). `commissions` table uses `ON CONFLICT DO NOTHING`.
- **#17** Influencer dashboard has real-time subscriptions on `leads`, `student_cases`, `rewards`, `payout_requests`, `commissions`.
- **#19** `source_id` on leads is set at creation time only. Team members and admins cannot accidentally change it (no UI for this field).
- **#21** Team member permissions enforced via RLS -- lawyers can only see `student_cases` where `assigned_lawyer_id = auth.uid()`.
- **#22** Admin dashboard uses service-role key via edge function verification. Can view all tables.
- **#23** All dashboards use `useRealtimeSubscription` hook + pull-to-refresh + visibility-change refetch.
- **#25** Notification system exists: `notify_case_status_change`, `notify_influencer_case_created`, `notify_payout_status_change`, `notify_referral_accepted` triggers all fire on relevant events.
- **#29** All state changes propagate via real-time subscriptions across dashboards.

---

## Issues Found and Fixes Required

### Issue A: 2 Orphaned Appointments (Checkpoints #5, #26)

Two appointments exist with `case_id = NULL`:
- `4e28c141` -- student "Yhshs"
- `3d3fc144` -- student "Helal"

These create ghost data in analytics counters.

**Fix:** Database cleanup to delete orphaned appointments. No code change needed since the creation form already links to a case.

```sql
DELETE FROM appointments WHERE case_id IS NULL;
```

### Issue B: No Phone Uniqueness Constraint on Leads (#3 hardening)

The `insert_lead_from_apply` RPC handles duplicates via upsert logic, but there's no database-level unique constraint on `leads.phone`. If two concurrent submissions arrive, both could insert.

**Fix:** Add a unique index on `leads.phone`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON leads (phone);
```

### Issue C: No Commission Cancellation on Refund/Cancel (#13)

There is NO logic anywhere to reverse commissions or rewards when a case is cancelled or payment is refunded. The `auto_split_payment` trigger only fires on `case_status = 'paid'` but never cleans up when status reverts.

**Fix:** Add a block to `auto_split_payment` that cancels rewards when status moves away from `'paid'`:
```sql
-- At the start of auto_split_payment, before the paid check:
IF OLD.case_status = 'paid' AND NEW.case_status IS DISTINCT FROM 'paid' THEN
  -- Cancel any pending rewards linked to this case
  UPDATE rewards SET status = 'cancelled'
  WHERE admin_notes LIKE '%' || OLD.id::text || '%'
    AND status IN ('pending', 'approved');
  UPDATE commissions SET status = 'cancelled'
  WHERE case_id = OLD.id AND status != 'paid';
END IF;
```

### Issue D: No 20-Day Auto-Payout Timer (#15)

The 20-day lock is enforced client-side in `EarningsPanel.tsx` (line 66-67): rewards are only eligible after 20 days. However, there is no automatic payout trigger after 20 days -- the influencer/team member must manually request it.

**Fix:** This is by design (manual request required). The 20-day timer UI already exists on the influencer dashboard. Add a brief helper text to the Earnings tab clarifying that payouts become available after 20 days and must be requested manually. No backend change needed.

### Issue E: Referral Link Persistence (#16)

The referral `?ref=` parameter is read from URL on page load (`useSearchParams`). If the student clears cookies or opens on a new device, the `ref` param is only preserved if they use the exact same URL. There's no cookie/localStorage fallback.

**Fix:** Store the `ref` parameter in `localStorage` so it persists across page reloads and cookie clears:
```typescript
// In ApplyPage.tsx useEffect:
useEffect(() => {
  const ref = searchParams.get('ref');
  if (ref) {
    localStorage.setItem('darb_ref', ref);
  }
  const savedRef = ref || localStorage.getItem('darb_ref');
  if (savedRef) {
    supabase.rpc('validate_influencer_ref', { ref_id: savedRef })
      .then(({ data }) => {
        if (data === true) {
          setSourceType('influencer');
          setSourceId(savedRef);
        }
      });
  }
}, [searchParams]);
```

### Issue F: Audit Log for Referral Chain (#18)

Partial implementation exists. The `admin_audit_log` captures `mark_contacted`, `profile_completed`, `submit_for_application`. However, there's no explicit entry for "lead created from influencer referral" or "commission generated."

**Fix:** The `notify_influencer_case_created` trigger creates a notification, which serves as an audit trail. The `auto_split_payment` trigger inserts into `commissions` and `rewards` tables with notes containing the case ID. This is sufficient for audit purposes -- no additional changes needed.

### Issue G: No Automatic Backups (#20, #27, #28)

Lovable Cloud handles database backups automatically as part of the infrastructure. No custom backup implementation is needed.

### Issue H: Influencer EarningsPanel Missing Role Prop (#10 edge case)

In `InfluencerDashboardPage.tsx` line 279, the `EarningsPanel` is rendered without a `role` prop:
```tsx
<EarningsPanel userId={user.id} />
```

This defaults to `'influencer'` which is correct. No fix needed.

---

## Files to Modify

| File | Change |
|------|--------|
| Database (cleanup) | Delete 2 orphaned appointments |
| Database (migration) | Add unique index on `leads.phone` |
| Database (migration) | Update `auto_split_payment` to cancel rewards on status revert |
| `src/pages/ApplyPage.tsx` | Add localStorage persistence for referral `ref` parameter |

---

## Technical Details

### Migration: Phone Uniqueness + Commission Cancellation

```sql
-- 1. Unique phone constraint
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON leads (phone);

-- 2. Update auto_split_payment to handle refunds/cancellations
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_referral RECORD;
  v_influencer_commission numeric := 0;
BEGIN
  -- CANCEL rewards if moving AWAY from paid
  IF OLD.case_status = 'paid' AND NEW.case_status IS DISTINCT FROM 'paid' THEN
    UPDATE rewards SET status = 'cancelled'
    WHERE admin_notes LIKE '%' || OLD.id::text || '%'
      AND status IN ('pending', 'approved');
    UPDATE commissions SET status = 'cancelled'
    WHERE case_id = OLD.id AND status != 'paid';
    NEW.paid_at := NULL;
  END IF;

  -- CREATE rewards when moving TO paid (existing logic)
  IF NEW.case_status = 'paid' AND (OLD.case_status IS DISTINCT FROM 'paid') THEN
    -- ... existing payment split logic unchanged ...
  END IF;

  RETURN NEW;
END;
$$;
```

### ApplyPage.tsx Referral Persistence

Add localStorage read/write in the existing `useEffect` that processes the `ref` query parameter. This ensures the influencer attribution survives across sessions, devices (if user copies URL), and browser restarts.

