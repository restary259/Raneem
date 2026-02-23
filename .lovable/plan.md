# Data Purge + Agent Payouts UI Merge + KPI Fix

## 1. Full Data Purge (Database)

Run a SQL migration to hard-delete all operational data while preserving user accounts (profiles, user_roles, auth users). This is a one-time cleanup to start fresh.

**Tables to purge (in order to respect FK dependencies):**


| Order | Table                  | Action     |
| ----- | ---------------------- | ---------- |
| 1     | case_service_snapshots | DELETE all |
| 2     | case_payments          | DELETE all |
| 3     | appointments           | DELETE all |
| 4     | commissions            | DELETE all |
| 5     | payout_requests        | DELETE all |
| 6     | rewards                | DELETE all |
| 7     | student_cases          | DELETE all |
| 8     | leads                  | DELETE all |
| 9     | referrals              | DELETE all |
| 10    | notifications          | DELETE all |
| 11    | admin_audit_log        | DELETE all |
| 12    | login_attempts         | DELETE all |


**Preserved:** profiles, user_roles, active_sessions, influencer_invites, master_services, checklist_items, eligibility_config, eligibility_thresholds, majors, major_categories

## 2. Move Payout Confirmations to Agent Payouts Tab

**Problem:** The "Payout Requests" approval panel (with Mark Paid / Reject buttons) appears at the top of the Transactions tab. It should be in the Agent Payouts tab instead.

**Changes to `MoneyDashboard.tsx`:**

- Remove the payout requests approval panel (lines 234-366) from the Transactions `TabsContent`
- Remove the pending rewards manual payout panel (lines 368-417) from Transactions
- Pass `payoutRequests`, `actionLoading`, `handleMarkRewardPaid`, `handleClearReward`, and payout approval handlers to `InfluencerPayoutsTab`

**Changes to `InfluencerPayoutsTab.tsx`:**

- Accept new props: `payoutRequests` action handlers, `onMarkPayoutPaid`, `onRejectPayout`, `onMarkRewardPaid`, `onClearReward`
- Add a "Pending Approvals" section above the KPI cards showing payout requests with Mark Paid / WA / Reject buttons (same UI as currently in Transactions, just moved)
- The KPI cards already compute real data from cases/rewards -- they will show correct values once data exists

## 3. KPI Cards Already Use Real Data

The `InfluencerPayoutsTab` KPI cards (Total Pending, Due This Week, Overdue, Total Paid Out) already compute from `cases`, `rewards`, and `payoutRequests` props. They show 0 because the database currently has no paid cases. After the purge and fresh data entry, they will reflect real numbers. No code change needed for KPI logic.

## Summary of File Changes


| File                                            | Change                                                                                            | Risk                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| SQL Migration                                   | Purge all operational data                                                                        | **Irreversible** -- intentional per user request |
| `src/components/admin/MoneyDashboard.tsx`       | Remove payout approval panels from Transactions tab; pass action handlers to InfluencerPayoutsTab | Low -- UI reorganization only                    |
| `src/components/admin/InfluencerPayoutsTab.tsx` | Add payout approval section with Mark Paid/Reject/WA buttons above KPI cards                      | Low -- UI addition only                          |


## What Will NOT Change

- Commission calculation formulas
- Case status transitions
- Payment marking logic (same functions, just called from different tab)
- RLS policies
- Database schema
- Edge functions 
- Role permissions                    D — UI Deployment (merge payout controls)
  - Deploy the frontend change that removes panels from Transactions and adds “Pending Approvals” to InfluencerPayoutsTab.
  - Confirm backend endpoints used by both tabs remain the same.
  ### E — POST-PURGE: RE-INDEX, VACUUM, REBUILD AGGREGATES
  - Run `ANALYZE` / `VACUUM` / reindex (DB specific) to free space & speed queries.
  - Rebuild or warm up materialized views or counters used by KPIs.
  ### F — SEED / BRING SYSTEM LIVE
  - If you want initial numbers, seed a small set of test/real cases.
  - Watch metrics.
  # 4) Concurrency & no-freeze recommendations (technical)
  - **Atomic payout flow**:
    - Start DB transaction.
    - Verify `payout_request.status = pending`.
    - Update `payout_request.status = paid`, create ledger entry, update case/reward status.
    - Commit.
  - **Idempotency token**: frontend should pass `idempotency_key` to backend to avoid duplicate marking when user double-clicks.
  - **Optimistic locking**: add `version` or `updated_at` check on critical rows.
  - **Background recalculation**: any heavy KPI recalculation should be queued and done asynchronously; show "in-progress" on UI with socket updates.
  - **WebSockets / SSE** to push updates to clients so simultaneous sessions see progress without refresh.
  # 5) Exact UI/Prop changes (pseudocode)
  MoneyDashboard.tsx (simplified)
  ```
  // BEFORE: Transactions TabsContent included payout approvals
  // AFTER: remove approval panels; pass handlers down
  <InfluencerPayoutsTab
    payoutRequests={payoutRequests}
    actionLoading={actionLoading}
    onMarkPayoutPaid={handleMarkPayoutPaid}
    onRejectPayout={handleRejectPayout}
    onMarkRewardPaid={handleMarkRewardPaid}
    onClearReward={handleClearReward}
    cases={cases}
    rewards={rewards}
  />
  ```
  InfluencerPayoutsTab.tsx (simplified)
  ```
  type Props = {
    payoutRequests: PayoutRequest[];
    onMarkPayoutPaid: (id) => Promise<void>;
    onRejectPayout: (id) => Promise<void>;
    onMarkRewardPaid: (id) => Promise<void>;
    onClearReward: (id) => Promise<void>;
    cases: Case[];
    rewards: Reward[];
  };

  export function InfluencerPayoutsTab(props: Props) {
    return (
      <div>
        <section aria-label="Pending Approvals">
          {props.payoutRequests.map(pr => (
            <PayoutRequestRow
              key={pr.id}
              request={pr}
              onMarkPaid={() => props.onMarkPayoutPaid(pr.id)}
              onReject={() => props.onRejectPayout(pr.id)}
            />
          ))}
        </section>

        <section aria-label="KPIs">
          <KpiCard title="Total Pending" value={computeTotalPending(props.cases, props.rewards, props.payoutRequests)} />
          ...
        </section>

        {/* other influencer payout UI */}
      </div>
    );
  }
  ```
  Important: Buttons should disable while `actionLoading` and use idempotency.
  # 6) Tests & Validation checklist (must pass before going to production)
  -  Full DB backup available and verified.
  -  Staging: purge + UI migration run successfully and rollback verified.
  -  Unit tests for payout handlers (including failure paths) pass.
  -  Integration tests: mark payout paid → `payout_requests` status + ledger + KPI change.
  -  Concurrency test: 50 simultaneous mark-paid attempts on same request → only one success, others return idempotent response.
  -  UI E2E: influencer sees Pending Approvals, Mark Paid updates KPI card in <5s.
  -  Load test for KPI endpoints to ensure no timeouts.
  -  Audit log created for every payout action.
  # 7) KPIs to monitor immediately after deploy
  - Payout action success rate (%)
  - API latency for payout endpoints (p50 / p95)
  - KPI calculation time (seconds)
  - Number of concurrency conflicts / optimistic lock failures
  - UI-freeze incidents (frontend errors logged)
  - Discrepancies between `transactions` tab totals and `influencer payouts` totals (should be zero)
  # 8) Rollback plan (if anything goes wrong)
  1. Put system back in maintenance mode.
  2. Restore DB snapshot from backup (fastest full recovery).
  3. Re-deploy previous frontend build.
  4. Investigate root cause in staging before retry.
  # 9) Minor clarifications / adjustments I auto-applied (no need to confirm)
  - I assumed the KPI logic already used the same tables you listed (cases/rewards/payoutRequests). If KPI code uses *different* sources (cached counters, third-party analytics), rewire those to correct tables or update cache invalidation.
  - I assumed you want the **same** Mark Paid semantics (balance ledger updates, commission calc) unchanged — only the UI location changes.
  # 10) Quick prioritized checklist you can hand to the devs (copy-paste)
  1. TAKE BACKUPS (DB + CSV exports) — block deploy until done.
  2. Implement frontend change: remove approval panel from Transactions tab, add to InfluencerPayoutsTab, wire handlers. Add `idempotency_key`.
  3. Ensure backend payout handlers are single source-of-truth; add DB transaction & optimistic locking.
  4. Add integration tests + concurrency test (50 parallel).
  5. Deploy to staging; run purge on staging; test all flows & KPI aggregates.
  6. Schedule maintenance window; run purge on production (archive first).
  7. Post-purge: re-index, warm caches, seed initial data (if any).
  8. Monitor KPIs & logs for 48 hours.