

## Fix: Table Columns Not Distributing Width Across Full Card

### Problem
All 8 admin dashboard tables currently use `table-auto` which sizes columns based on content. When data is sparse (many "-" values or short text), columns collapse to minimum width and leave empty space on the right side of the card. The table technically has `min-w-full` but columns don't stretch to fill the available width.

### Root Cause
`table-auto` + `min-w-full` = table is at least as wide as container, but columns only take the space their content needs. Extra space is not distributed.

### Solution
Switch all 8 tables from `table-auto` to `table-fixed w-full` and add percentage-based widths to `<th>` elements so columns distribute evenly across the full card width.

### Files to Modify

**1. LeadsManagement.tsx (10 columns)**
- Change `<table className="min-w-full table-auto text-sm">` to `<table className="w-full table-fixed text-sm">`
- Add percentage widths to `<th>`: Name 15%, City 10%, Major 13%, Phone 13%, English 7%, Math 7%, Score 7%, Source 8%, Status 8%, Actions 12%

**2. PayoutsManagement.tsx (9 columns)**
- Same `table-fixed w-full` change
- Widths: Checkbox 4%, Requester 16%, Role 8%, Students 10%, Amount 10%, Status 10%, Date 14%, Method 12%, Actions 16%

**3. ReferralManagement.tsx**
- Same pattern with appropriate column width percentages

**4. MoneyDashboard.tsx**
- Same pattern with appropriate column width percentages

**5. StudentManagement.tsx**
- Same pattern with appropriate column width percentages

**6. AuditLog.tsx**
- Same pattern with appropriate column width percentages

**7. InfluencerManagement.tsx**
- Same pattern with appropriate column width percentages

**8. ReadyToApplyTable.tsx**
- Same pattern with appropriate column width percentages

### Technical Details

The key CSS change on every `<table>`:
```
Before: className="min-w-full table-auto text-sm"
After:  className="w-full table-fixed text-sm"
```

And on each `<th>`, add a `w-[X%]` class so widths total ~100%. This forces the browser to distribute column widths proportionally regardless of content, eliminating the "squished left, empty right" problem.

`table-fixed` tells the browser: "Use the widths I set on the first row, ignore content width." Combined with `w-full`, the table always fills the card edge-to-edge with evenly distributed columns.

