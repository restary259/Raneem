
## Full E2E Gap Analysis — Admin Payout Flow

### Current DB State
- `payout_requests`: 1 row — `partner@gmail.com` requested ₪1,000, status=`pending`
- `rewards`: linked reward `96bb9c4f` → status=`approved`, amount=₪1,000

### The Two Parallel Tracks (the core UX problem)

**Track A — Agent Payouts tab** (`PayoutsManagement.tsx`)
- Reads from `payout_requests` table
- Shows the partner's ₪1,000 request as `pending`
- Has Approve → Mark Paid buttons ✅
- **Bug**: KPI label says "Agent Pending" but `requestor_role=social_media_partner` means it's the partner, not an agent/team member

**Track B — Partner Payouts tab** (`PartnerPayoutsPanel.tsx`)
- Reads from `rewards` table directly
- Shows the same ₪1,000 reward as "pending" with a "Confirm Payment" button
- **Bug**: When a partner has already submitted a payout request (reward is `approved`), this panel still shows a "Confirm Payment" button → **double-payment risk**

**Track C — Partner side** (`PartnerEarningsPage.tsx`)
- Partner requested payout via `request_payout` RPC ✅
- After admin marks paid in Track A, the reward status updates to `paid` — but the partner only sees the update in their earnings history

### Fixes Required

#### Fix 1 — `PayoutsManagement.tsx`: Correct KPI labels
- Rename "Agent Pending" → "Partner Pending" for `social_media_partner` role requests

#### Fix 2 — `PartnerPayoutsPanel.tsx`: Block double-payment on `approved` rewards
- When `r.status === 'approved'` (reward has an active payout request), show a "Payout Requested" read-only badge instead of the "Confirm Payment" button
- Show a subtle info message: "This partner has a pending payout request in the Agent Payouts tab"
- Keep `pending` rewards (no request yet) actionable as before

#### Fix 3 — `PartnerPayoutsPanel.tsx`: Update the summary bar `totalPending`
- Currently: `rewards.filter(r => r.status === 'pending')` — misses `approved` in total
- Fix: include `approved` in the pending total display (already in groups via prev fix, just align the summary bar)

#### Fix 4 — `PayoutsManagement.tsx`: Fix role label in KPI strip
- "pendingInfluencer" KPI card → rename label to "Partner Pending" 
- Add a small info note: "Includes requests submitted by partners via their dashboard"

#### Fix 5 — `AdminFinancialsPage.tsx` (the page rendering both tabs)
- Add a visible callout/banner explaining the two flows to the admin:
  - **Agent Payouts tab**: Partner-initiated requests (formal flow, partner pressed "Request Payout")
  - **Partner Payouts tab**: Admin-initiated direct payments to partners (admin confirms without partner request)

### Files to Change

| File | Change |
|---|---|
| `src/components/admin/PayoutsManagement.tsx` | Fix KPI label "Agent Pending" → "Partner Pending" for social_media_partner |
| `src/components/admin/PartnerPayoutsPanel.tsx` | Show read-only "Payout Requested" badge for `approved` rewards instead of Confirm button; show cross-tab info tooltip |
| `src/pages/admin/AdminFinancialsPage.tsx` | Add info banner clarifying the two tracks; fix tab label "Agent Payouts" → "Partner Payouts (Direct)" |

### Flow After Fix
```text
Partner presses "Request Payout" →
  payout_requests: status=pending
  rewards: status=approved

Admin opens Agent Payouts tab →
  Sees ₪1,000 pending from partner@gmail.com
  Clicks Approve → status=approved
  Clicks Mark Paid → status=paid, rewards.status=paid, transaction_log row inserted ✅

Admin opens Partner Payouts tab →
  Sees ₪1,000 with badge "Payout Requested" (no Confirm button) ✅
  After admin marks paid in Agent tab → reward goes to paid history ✅

Partner opens Earnings →
  KPI "Paid Out" shows ₪1,000 ✅
```
