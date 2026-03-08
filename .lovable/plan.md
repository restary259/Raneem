
## Money Logic Overhaul + Remove Translation + One-Partner-at-a-Time

### Current State (what exists)
- `platform_settings` has `partner_commission_rate` (flat per-case amount) and `team_member_commission_rate`
- `record_case_commission` DB function reads those rates and writes `influencer_commission` + `lawyer_commission` onto the `cases` row, then inserts `rewards` rows
- `CommissionSettingsPanel.tsx` exposes global rates + per-person overrides via `partner_commission_overrides` / `team_member_commission_overrides` tables
- `PartnerEarningsPage.tsx` shows earnings as `cases_in_qualifying_statuses × commissionRate`
- `MoneyDashboard.tsx` (admin) reads `translation_fee` from cases/student_cases in KPIs, transaction rows, net-profit calculations
- `StudentCasesManagement.tsx` has a "translation_fee" row in the Edit Financials panel
- `SubmitNewStudentPage.tsx` (Step 4) has a "Translation Fee" input field
- `PaymentConfirmationForm.tsx` sends `translation_fee` to `case_submissions`
- `CaseDetailPage.tsx` shows and tallies `translationFee`
- `AdminSubmissionsPage.tsx` shows "Translation Fee:" in payment detail
- `AdminFinancialsPage.tsx` has a KPI card for `translationFees`
- `AdminTeamPage.tsx` creates accounts but has NO delete button — partner accounts can pile up

### What the user wants — 4 distinct changes

**1. Money split: admin controls the exact split per person, not a flat rate**  
When admin marks a case as enrolled (via `AdminSubmissionsPage` → mark enrolled → `admin-mark-paid` edge function), the system should use whatever per-partner/per-team-member override is set. The key insight: this already works via `record_case_commission` + override tables. The UX problem is that the `CommissionSettingsPanel` is hidden in Admin Settings — not surfaced at the moment of marking enrolled. **The fix**: on the Submissions page, when admin marks enrolled, show a "Payment Split" summary that lets them set/confirm the amounts before finalizing. Additionally, clarify the UI in `CommissionSettingsPanel` so it reads as "money that appears on their dashboard" not "percentage."

**2. Remove translation everywhere**  
Remove all UI references to `translation_fee` from:
- `SubmitNewStudentPage.tsx` — remove the translation fee input (Step 4), leave only service fee
- `PaymentConfirmationForm.tsx` — remove `translationFee` state, only send `service_fee`
- `CaseDetailPage.tsx` — remove translation from totals display and the `amountPaid` calculation
- `StudentCasesManagement.tsx` — remove from net profit formula, from the breakdown display, and from the Edit Financials fields
- `MoneyDashboard.tsx` — remove translation_fee transaction rows, remove from KPI calculations
- `AdminFinancialsPage.tsx` — remove the "Translation Fees" KPI card
- `AdminSubmissionsPage.tsx` — remove "Translation Fee:" row from payment details
- `TeamStudentProfilePage.tsx` — remove translation line

**3. One partner at a time: delete before create**  
`AdminTeamPage.tsx` currently lists team members + partners but has no delete button. Add a delete (deactivate) action on partner accounts — specifically, before the admin can create a new `social_media_partner`, enforce a check: if one already exists, block creation and prompt "Delete the existing partner first." Add a delete button to the partner rows.

**4. Auto-split flows to dashboards correctly**  
This is already architecturally correct — `record_case_commission` writes `influencer_commission` + `lawyer_commission` onto the `cases` row and inserts `rewards` rows. Partner sees earnings on `PartnerEarningsPage` via `cases` with their `partner_id`. The gap: the `cases` table's `partner_id` may not be set when team member submits (`SubmitNewStudentPage` inserts without `partner_id`). This means the partner commission never gets linked. **Fix**: when the `record_case_commission` function runs, it already queries `cases.partner_id`. So the issue is just display — make sure `CommissionSettingsPanel` describes that setting these amounts controls what appears on partner/team dashboards.

### Files to change — 7 files

| File | Change |
|---|---|
| `src/pages/team/SubmitNewStudentPage.tsx` | Remove translation fee input; remove from totals; remove from `case_submissions` insert |
| `src/components/team/PaymentConfirmationForm.tsx` | Remove translation fee state + UI; only submit service_fee |
| `src/pages/team/CaseDetailPage.tsx` | Remove translationFee from totals (line 455-456) and display |
| `src/components/admin/StudentCasesManagement.tsx` | Remove translation from net profit, breakdown, Edit Financials fields |
| `src/components/admin/MoneyDashboard.tsx` | Remove translation_fee transaction rows + KPI |
| `src/pages/admin/AdminFinancialsPage.tsx` | Remove translationFees KPI card |
| `src/pages/admin/AdminSubmissionsPage.tsx` | Remove "Translation Fee" row + update total calculation; add payment split panel before marking enrolled |
| `src/pages/admin/AdminTeamPage.tsx` | Add delete button for partner accounts; block new partner creation if one already exists |
| `src/components/admin/CommissionSettingsPanel.tsx` | Improve labels: "Amount shown on their dashboard per enrolled student" |
| `src/pages/team/TeamStudentProfilePage.tsx` | Remove translation line from payment display |

### Commission split UX improvement (AdminSubmissionsPage)
When admin clicks "Mark as Enrolled," before showing the password gate, show an intermediate step:

```
Payment Split (before confirming)
──────────────────────────────────────
Service Fee: [input — prefilled from case_submissions.service_fee]
Partner Commission: [₪500 — read from overrides or global rate]  
Team Member Commission: [₪100 — read from overrides or global rate]
──────────────────────────────────────
Platform Revenue: ₪3400 (auto-calculated)
```

This calls the existing `admin-mark-paid` edge function with `total_payment_ils = service_fee`, which triggers `record_case_commission` to compute and write rewards automatically.

### One-partner constraint (AdminTeamPage)
- Add a `Delete` button next to each `social_media_partner` row
- Delete = call `selective-delete` edge function or directly: delete from `user_roles` where `user_id = partner.id AND role = 'social_media_partner'`, then set `profiles.deleted_at = NOW()`
- When "Create Member" dialog opens with role=`social_media_partner`, check if any partner exists → if yes, show error: "You must delete the existing partner account first."

### No DB schema changes needed
All required columns exist. Translation_fee column stays (just hidden from UI). `record_case_commission` function already handles the split correctly.
