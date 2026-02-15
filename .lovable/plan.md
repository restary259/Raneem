
# Standardize All Admin Dashboard Tables with Contained Borders

## Problem
Tables across admin dashboard tabs have inconsistent wrapper patterns. Some have double borders (Card border + inner div border), some have no Card wrapper, and some lack the `border rounded-lg` styling. This makes some tables (like Payouts) look like floating headers without a proper container.

## Solution
Standardize ALL admin table wrappers to use ONE consistent pattern -- a clean `div` with `bg-background rounded-xl border shadow-sm` wrapping the table, with `overflow-x-auto` for horizontal scroll containment. No double-nesting inside Card components (which adds a second border).

### Target Pattern (matches the "good" Leads look from screenshot 2):
```text
<div className="bg-background rounded-xl border shadow-sm w-full overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b bg-muted/50">...</tr>
    </thead>
    <tbody>...</tbody>
  </table>
</div>
```

## Files to Modify

| File | Current Pattern | Fix |
|------|----------------|-----|
| `PayoutsManagement.tsx` | `Card > CardContent p-0 > div.border.rounded-lg > table` | Remove Card/CardContent wrapper, use single `div.bg-background.rounded-xl.border.shadow-sm` |
| `LeadsManagement.tsx` | `Card > CardContent p-0 > div.border.rounded-lg > table` | Same fix |
| `ReferralManagement.tsx` | `Card > CardContent p-0 > div.border.rounded-lg > table` | Same fix |
| `MoneyDashboard.tsx` | `Card > CardContent p-0 > div.border.rounded-lg > table` | Same fix |
| `StudentManagement.tsx` | `div.bg-background.rounded-xl.border.shadow-sm` | Already correct -- no change needed |
| `AuditLog.tsx` | `div.bg-background.rounded-xl.border.shadow-sm` | Already correct -- no change needed |
| `InfluencerManagement.tsx` | `div.bg-background.rounded-xl.border.shadow-sm` (missing `w-full`) | Add `w-full` |
| `ReadyToApplyTable.tsx` | `Card > CardContent p-0 > div.overflow-x-auto` (no border on inner div) | Remove Card/CardContent, use standard `div.bg-background.rounded-xl.border.shadow-sm` |
| `SecurityPanel.tsx` | Inside Card with CardContent (has padding) | Already contained inside a Card with header -- keep as-is since it's a different layout |

## Technical Details

### Changes for PayoutsManagement.tsx (lines ~282-284)
Replace:
```text
<Card className="w-full">
  <CardContent className="p-0">
    <div className="w-full overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
```
With:
```text
<div className="bg-background rounded-xl border shadow-sm w-full overflow-x-auto">
  <table className="w-full text-sm">
```
And close the `</div>` instead of `</div></CardContent></Card>`.

### Same transformation for:
- LeadsManagement.tsx (lines ~292-295)
- ReferralManagement.tsx (line ~188)
- MoneyDashboard.tsx (lines ~312-314)
- ReadyToApplyTable.tsx (lines ~247-249)

### InfluencerManagement.tsx (line ~171)
Add `w-full` to existing div class.

### No changes needed for:
- StudentManagement.tsx (already correct pattern)
- AuditLog.tsx (already correct pattern)
- SecurityPanel.tsx (different layout with CardHeader)
- CasesManagement.tsx (uses collapsible cards, not tables)
