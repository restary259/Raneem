# xecutive summary (2 sentences)

Fixes:

- Ensure **Reassign** modal reliably returns active, registered team members (fix query + RLS + UI loading).
- Ensure **team members cannot mark a case as “paid”** — only admin can mark paid; only after admin mark starts the 20-day countdown and *after countdown expires* is the commission made available. Auto-split/commission creation will be triggered only when the countdown completes (idempotent scheduler), not when team member submits.

Everything below is additive and guarded by feature flags.

---

# 1 — Reassign modal: fix (query + RLS + UI)

**Problem:** modal opens but shows no team members. Root causes: wrong filter, RLS, or UI not rendering async result.

### Backend fix (preferred): server-side API to return active team members

Create an admin-only endpoint that returns active team members (so client doesn’t rely on RLS policies for the UI).

**Example Express / Edge function (TypeScript)**

```
// src/api/admin/getTeamMembers.ts
import express from 'express';
import { supabaseAdmin } from '../supabaseAdminClient'; // use service role key

const app = express();
app.get('/admin/team-members', async (req, res) => {
  const caller = req.user; // assume middleware sets user and role
  if (!caller || caller.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const { q } = req.query; // optional search
  const filter = q ? `%${String(q)}%` : '%';
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, status')
    .ilike('full_name', filter)
    .eq('role', 'team_member')   // adjust to exact role value in DB
    .eq('status', 'active')
    .order('full_name', { ascending: true })
    .limit(100);
  if (error) return res.status(500).json({ error });
  res.json({ members: data });
});
export default app;
```

**Client usage (TeamDashboardPage.tsx)**

- useEffect to fetch `/admin/team-members` on modal open
- show a loading spinner until data arrives
- guard empty state with "No active team members found" message (with link to invite)

**Important UI patterns**

- Disable Reassign button while loading.
- Debounce search when user types member name.
- Make selection atomic: use `POST /cases/{id}/reassign` server-side.

### RLS alternative (if must fetch from client)

If you must fetch from frontend directly:

- Add RLS policy to `users` table allowing `select` for `role = 'admin'` via JWT claim `role`.
- SQL example:

```
-- only allow selecting team members if request is made by admin
create policy "admin_can_select_team_members" on public.users
  for select using (
    auth.role() = 'admin' AND role = 'team_member' AND status = 'active'
  );
```

(Adapt to your RLS method.)

---

# 2 — Fix the “team member submits → becomes paid” problem

**Problem:** `confirmPaymentAndSubmit()` appears to mark case as `paid` and triggers auto commission. That breaks the admin-gating rule.

**Solution:** Separate the *submit-to-admin* action from *admin-mark-paid* action. Change `confirmPaymentAndSubmit()` behavior to only mark `submitted_to_admin_at` (or leave case_status as `services_filled`/`profile_filled`) and call a new API `POST /cases/{id}/submit_to_admin`. The auto-split/commission creation must only happen **after** the 20-day countdown finishes and then a scheduled job or trigger creates the rewards.

### DB additions

```
ALTER TABLE student_cases
  ADD COLUMN IF NOT EXISTS submitted_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paid_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_countdown_started_at timestamptz;

-- commissions table (if you have one) - add status
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'; -- pending/countdown/available/paid
```

### API: submit_to_admin (team member)

```
// POST /cases/:id/submit_to_admin
// team member calls this when they "submit"
await db.update('student_cases').set({
  case_status: previousStatus, // keep whatever the stage is (services_filled/profile_filled)
  submitted_to_admin_at: now()
}).where({ id: caseId });

// insert audit entry
```

**No** `is_paid_admin` **change. No commission creation.** Only an audit + notify admin.

### API: admin_mark_paid (admin-only)

```
// POST /cases/:id/admin_mark_paid
await db.update('student_cases').set({
  is_paid_admin: true,
  paid_countdown_started_at: now()
}).where({ id: caseId });

// append audit log (admin id, timestamp)
// notify influencer: started countdown
```

**Important:** Do **not** call auto_split_payment here. Instead start countdown.

---

# 3 — Countdown / commission availability: idempotent scheduler

**Problem:** auto_split_payment currently triggers when case is “marked paid”, but we must wait 20 days.

**Solution:** Create a scheduler (cron job) that runs every X minutes and:

1. Finds cases where `is_paid_admin = true` AND `paid_countdown_started_at` IS NOT NULL AND `paid_countdown_started_at + interval '20 days' <= now()` AND `commission_created = FALSE` (or commissions.status = 'pending').
2. Marks commission `available` and creates the reward/commission records (auto_split_payment logic) — but this creation must be idempotent (create only when no commission row exists).
3. Notify influencer and admin of pending payout.

**Example pseudocode (Node cron)**

```
// scheduler/processCommissions.ts
const rows = await db('student_cases')
  .where('is_paid_admin', true)
  .andWhere('paid_countdown_started_at', '<=', db.raw("now() - interval '20 days'"))
  .andWhere('commission_created', false);

for (const c of rows) {
  await db.transaction(async trx => {
    // double-check inside txn to prevent race
    const existing = await trx('commissions').where({ case_id: c.id }).first();
    if (existing) {
      await trx('commissions').where({ id: existing.id }).update({ status: 'available' });
    } else {
      const commission = await trx('commissions').insert({
        case_id: c.id,
        influencer_id: c.influencer_id,
        amount: calculateCommission(c),
        status: 'available',
        created_at: trx.fn.now()
      }).returning('*');
    }
    await trx('student_cases').where({ id: c.id }).update({ commission_created: true });
    // create pending payout request row for admin dashboard
  });
  // notify influencer
}
```

**Idempotency safety:** The transaction checks if commission exists; if it does, it updates status. That prevents duplicate payouts.

**Testing:** Simulate multiple scheduler workers. Ensure transaction prevents double creation.

---

# 4 — Modify auto_split_payment trigger (if you have DB triggers)

If auto_split_payment is a DB trigger that fires when `case_status = 'paid'`, change the trigger to fire on `commissions.status = 'available'` or remove the trigger and do the commission creation in the scheduler (recommended). If you must keep trigger, modify it to check `is_paid_admin = true` and `paid_countdown_started_at <= now() - interval '20 days'` before performing the split.

---

# 5 — Purge (permanent delete) — safer flow

**Problem:** current plan unassigns cases automatically — risky.

**Safer plan:** Admin purge flow requires either:

- Step A: **Select a reassignment target** (transfer assigned cases to another team member), OR
- Step B: **Force purge** with explicit confirmation and a required “transfer target” or “archive to admin pool”.

**Implementation**

- In InfluencerManagement UI, “Permanently Delete” modal displays:
  - Number of active cases (count).
  - Option: *Transfer assigned cases to:* [select active member] (required if active_cases > 0), OR checkbox: *Force purge (I accept consequences)* — if force purge chosen, system will set assigned_lawyer_id = NULL but will create admin tasks to reassign/unassign with audit entries and set `requires_reassignment = true` on those cases. (Prefer transfer to explicit user to avoid orphans.)
- Backend: `POST /admin/users/:id/purge` accepts `{ transfer_to?: userId, force_purge?: boolean, reason?: string }`.
  - Runs in transaction:
    - If transfer_to provided: update all cases assigned to target user -> assigned_lawyer_id = transfer_to.
    - Else if force_purge: set assigned_lawyer_id = null AND set `requires_reassignment = true` (creates admin task).
    - Delete user (or soft-delete + purge logs).
    - Insert audit row: `user_purged: { user_id, admin_id, transfer_to?, force_purge, reason }`.
- Prevent purge if user has unresolved commissions or pending payouts. Require admin to resolve payouts first.

**SQL sample to set requires_reassignment**

```
ALTER TABLE student_cases ADD COLUMN IF NOT EXISTS requires_reassignment boolean DEFAULT false;
```

**Why safer:** no silent unassignment; everything documented; admin must make explicit transfer or accept orphan consequences.

---

# 6 — Reassign endpoint (server-side) — atomic & audit-safe

**API contract:**  
  
`POST /cases/:id/reassign` payload `{ new_assignee_id }` — only admin or current assignee allowed.

**Server-side logic (pseudo)**

```
await db.transaction(async trx => {
  const caseRow = await trx('student_cases').where({ id: caseId }).forUpdate().first();
  if (!caseRow) throw 404;
  const prev = caseRow.assigned_lawyer_id;
  if (prev === newAssignee) return 200; // idempotent
  await trx('student_cases').where({ id: caseId }).update({ assigned_lawyer_id: newAssignee });
  await trx('reassignment_audit').insert({
    case_id: caseId,
    reassigned_from: prev,
    reassigned_to: newAssignee,
    reassigned_by: adminId,
    notes: notes || null,
    created_at: trx.fn.now()
  });
});
```

**Important:** Use `SELECT ... FOR UPDATE` to lock row and avoid races. Return the updated appointment in response.

---

# 7 — UI fixes for Reassign modal (TeamDashboardPage.tsx)

- Fetch via `/admin/team-members` when modal opens.
- Show spinner until data arrives.
- Disable save button until a selection is made.
- Handle empty list by showing link to invite members or contact admin.

**Example React pattern**

```
useEffect(() => {
  if (!open) return;
  setLoading(true);
  api.get('/admin/team-members').then(r => { setMembers(r.members); setLoading(false) }).catch(e=>{setLoading(false); setError(e)})
}, [open]);
```

---

# 8 — Mark-as-Paid visibility & labels

- Keep `Mark Paid` visible for `['services_filled','profile_filled']` but the button must call `/cases/:id/admin_mark_paid`, not set case to paid on client side.
- Influencer label mapping: `services_filled` → "Submitted (Awaiting Payment)".

---

# 9 — Migrations (SQL)

```
-- Add new columns
ALTER TABLE student_cases
  ADD COLUMN IF NOT EXISTS housing_description TEXT,
  ADD COLUMN IF NOT EXISTS has_translation_service BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paid_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_created boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reassignment boolean DEFAULT false;

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'; -- pending/countdown/available/paid
```

Add index on `paid_countdown_started_at` for efficient scheduler:

```
CREATE INDEX IF NOT EXISTS idx_paid_countdown_started_at ON student_cases(paid_countdown_started_at);
```

---

# 10 — Tests to add (unit + integration)

1. **Reassign**
  - Unit: `cases.reassign()` with new assignee — creates audit row.
  - Concurrency: spawn 2 reassign requests simultaneously; assert single final state and single audit chain (use `FOR UPDATE`).
2. **Submit-to-admin**
  - Team member calls submit -> `submitted_to_admin_at` set, no `is_paid_admin` set, no commission row created.
3. **Admin mark-as-paid**
  - Admin calls `/admin_mark_paid` -> `is_paid_admin=true`, `paid_countdown_started_at` set, notification queued; no commission created immediately.
4. **Scheduler**
  - Create case with `is_paid_admin = true` and `paid_countdown_started_at = now - 21 days` -> run scheduler -> one commission row created with status `available` and `commission_created = true`.
  - Run scheduler twice -> verify idempotent (no duplicate commission).
5. **Purge**
  - Purge with transfer_to -> verify assigned cases moved and user deleted.
  - Purge with force_purge but unresolved commissions -> reject.
  - Purge with force and admin confirm -> assigned_lawyer_id null and `requires_reassignment` true; audit recorded.
6. **Reassign modal**
  - UI test: open modal -> network returns list -> items rendered; selection sends `POST /cases/:id/reassign`, success shows UI update.
7. **Edge cases**
  - Double click Mark Paid -> server should prevent duplicate countdown starts (atomic update checking existing `paid_countdown_started_at`).
  - Server restart does not start duplicate scheduler processes (use leader election or DB row mark).

---

# 11 — Acceptance criteria / QA

- Reassign modal shows active team members within 1-2s. Selecting one reassigns case and appears in target’s Appointments (no stage change).
- Team member submission does **not** mark paid or create commission.
- Admin `Mark as Paid` sets `is_paid_admin` and starts countdown (timestamp recorded).
- After 20 days (simulate in test env) scheduler creates commission exactly once, sets commission status to `available`, and creates pending payout request for admin.
- Admin finalizes payout -> commission status `paid` and influencer sees paid amount and date.
- Purge flow requires transfer or explicit force with audit; no orphaned commissions or unresolvable states left behind.
- All DB changes reversible by reverting migration (columns are additive).

---

# 12 — Rollout & feature flags

- Implement changes behind `ff_admin_assignment_flow_v2` and `ff_commission_countdown_v1`.
- Deploy DB migration to staging, enable flags for staging.
- Run test suite & manual QA.
- Canary: enable for 5-10% of admin users (or internal admin group) for 48 hours.
- Monitor logs for:
  - duplicate commission creations
  - failed reassign calls
  - scheduler errors
- If something breaks, disable flagged features (UI + server gate) and revert migration if necessary.

---

# 13 — Quick PR checklist for dev to include in commit

-  DB migration SQL file added
-  API endpoint `GET /admin/team-members` (admin-only)
-  API endpoint `POST /cases/:id/reassign` (transactional)
-  API endpoint `POST /cases/:id/submit_to_admin` (idempotent)
-  API endpoint `POST /cases/:id/admin_mark_paid` (idempotent)
-  Scheduler job code & Docker/Cron config
-  UI change: Reassign modal uses new admin endpoint and loading UX
-  UI change: Mark Paid button calls admin endpoint, not client-set
-  Unit & integration tests added
-  Feature flags added for both major flows
-  QA checklist & runbook attached

---

# Code snippets & checks (copy-paste friendly)

**Prevent double start of countdown (server-side)**

```
// idempotent admin_mark_paid handler
await db.transaction(async trx => {
  const row = await trx('student_cases').where({ id: caseId }).forUpdate().first();
  if (!row) throw 404;
  if (row.is_paid_admin) {
    return { ok: true, message: 'already started' };
  }
  await trx('student_cases').where({ id: caseId }).update({
    is_paid_admin: true,
    paid_countdown_started_at: trx.fn.now()
  });
  // insert audit entry
});
```

**Scheduler guard to avoid duplicates**

```
// inside transaction loop
const existing = await trx('commissions').where({ case_id: c.id }).first();
if (existing) {
  if (existing.status !== 'available') {
    await trx('commissions').where({ id: existing.id }).update({ status: 'available' });
  }
  // mark commission_created true
} else {
  await trx('commissions').insert({ case_id: c.id, amount: ..., status: 'available', created_at: trx.fn.now()});
}
```

---

# Final notes — what I changed vs his plan

- Kept all his additive UI and DB changes (housing_description, translations boolean, hide earnings).
- **Fixed the critical logic**: team member `submit` **no longer** sets paid or creates commission. Added explicit `admin_mark_paid` step that starts the countdown.
- **Reassign rendering bug** addressed** by recommending an admin-only server endpoint** and UI loading improvements; also provided RLS policy options.
- **Purge flow changed**: require explicit reassignment or explicit force purge with audit — no silent unassigns.
- **Scheduler** to create commission after 20 days (idempotent), instead of creating commission at submit or mark paid time. This ensures commissions cannot be made available early.
- Added transactional locking (`FOR UPDATE`) for reassign/mark-paid to prevent race conditions.