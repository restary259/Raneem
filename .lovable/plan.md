
# Earnings Panel — WhatsApp-First Simplification (Influencer & Team Member)

## What the user wants

1. **Influencer earnings page**: Change from the current complex bank-details + RPC payout flow to a **WhatsApp-first** approach, matching the same simple model the team member earnings tab uses.
2. **The team member earnings tab** already renders `<EarningsPanel userId={user.id} role="lawyer" />` — so whatever we do to `EarningsPanel.tsx` applies to **both** the influencer dashboard and the team dashboard in one change.
3. **Keep** the bank details storage (for future admin use) but **remove** the multi-step "confirm + notes" modal.
4. **New flow**: Click one button → opens WhatsApp with a pre-filled message that includes the reward amount, the number of students, and the user's name — admin handles payment manually.

---

## Current Flow (what we're replacing)

```text
[Request Payout btn] → check bank details → if missing: show bank modal
                     → if present: show confirm modal with notes field
                     → call request_payout() RPC
                     → on success: open WhatsApp
```

**Problems with this:**
- Complex two-modal flow confuses users
- Bank details are a hard blocker even though admin pays manually via bank transfer
- The `request_payout` RPC creates a DB record and sets reward status to `approved` — which is fine to keep, but the UI barrier is too high
- The confirm modal adds no value if WhatsApp is the communication channel

---

## New Flow (what we're building)

```text
[Request via WhatsApp btn] → if no eligible rewards: show disabled + reason
                           → if eligible: open WhatsApp with pre-filled message
                           → simultaneously: call request_payout() RPC silently (for admin tracking)
```

**Pre-filled WhatsApp message format:**
```
طلب سحب رصيد | Payout Request
الاسم: [Full Name]
المبلغ المستحق: [amount] ₪
عدد الطلاب: [N]
```

---

## What stays the same (no risk of breaking)

- Bank details storage modal — **kept** but optional; shown as a secondary "Add bank info" link, not a hard blocker
- The RPC `request_payout` call — **kept** as a silent background call for admin tracking so the Money Dashboard's payout requests section still works
- All KPI cards (total earned, available, paid) — **unchanged**
- Payout requests history table — **unchanged**
- Cancel request flow — **unchanged**
- Team dashboard earnings tab — gets the same improvement automatically since it uses `EarningsPanel`

---

## Specific changes to `EarningsPanel.tsx`

### Remove
- `showRequestModal` state and the Request Payout confirmation `<Dialog>` (lines 303-325)
- The hard bank-details gate in `handleRequestPayout` (lines 141-151) — replace with soft warning
- `requestNotes` state (unused in new flow)

### Keep
- `showBankModal` state and the Israeli bank `<Dialog>` — kept as optional "Add bank details" button
- `submitPayoutRequest` logic — kept but called **silently** (no confirmation dialog; fires on WhatsApp button click)
- All KPI cards, payout requests table, cancel flow

### Add
- Single primary `"Request via WhatsApp"` button that:
  1. Checks `eligibleRewards.length > 0` and `availableAmount >= minThreshold`
  2. Calls `submitPayoutRequest()` silently (awaited, errors shown as toast)
  3. Opens WhatsApp with pre-filled message

### Button states
| Condition | Button |
|-----------|--------|
| No eligible rewards | Disabled + "No rewards available yet" badge |
| Below threshold | Disabled + "Minimum [N] ₪ required" badge |
| Ready | Green WhatsApp button — enabled |

---

## Files to change

| File | Change |
|------|--------|
| `src/components/influencer/EarningsPanel.tsx` | Simplify to WhatsApp-first flow as described above |

**Only one file changes.** The team dashboard earnings tab (`TeamDashboardPage.tsx`) automatically benefits since it renders `<EarningsPanel role="lawyer" />`.

---

## Technical risk assessment

| Risk | Assessment | Mitigation |
|------|------------|-----------|
| Breaking team member earnings | None — same component, same improvement | Tested visually |
| Breaking payout request tracking | None — RPC call kept silent | RPC still fires, admin Money Dashboard still shows requests |
| Breaking cancel flow | None — unchanged | `cancelRequest()` untouched |
| Bank modal removed as hard blocker | Low — bank info optional now | Soft warning banner still shown if missing; admin collects details separately |
| 20-day lock bypass | None — `eligibleRewards` filter unchanged; same logic applies | `days >= LOCK_DAYS` still gates access |

---

## Implementation steps (single file edit)

1. Remove `showRequestModal` state, `requestNotes` state
2. Rewrite `handleRequestPayout` → `handleWhatsAppRequest(profile, isAr)`:
   - Build pre-filled WhatsApp message
   - Call `submitPayoutRequest()` silently (no modal)
   - Open WhatsApp
3. Replace the two-button row with a single green WhatsApp button + optional "Add bank details" link
4. Remove the Confirm Payout `<Dialog>` (lines 303–325)
5. Keep bank modal `<Dialog>` and all KPI cards unchanged
