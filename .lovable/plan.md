
# Fix Admin Dashboard: Contain Tables Within Viewport

## Problem
Tables are bleeding out of the viewport, pushing the page width beyond the sidebar. The root cause is two-fold:
1. The `<main>` tag in `AdminLayout.tsx` uses `overflow-x-auto`, which allows the entire content area to expand horizontally instead of constraining it
2. Tables use `min-w-full`, which forces them to be at least as wide as their parent -- preventing them from shrinking when the viewport is smaller

## Solution

### 1. Fix AdminLayout.tsx (the parent -- most critical fix)

Change `<main>` from:
```text
<main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-auto min-w-0 w-full">
```
to:
```text
<main className="flex-1 p-4 md:p-6 lg:p-8 overflow-hidden min-w-0">
```

Key changes:
- `overflow-x-auto` changed to `overflow-hidden` -- prevents the main area from scrolling; scrolling will happen inside each table card instead
- Removed `w-full` -- `flex-1` already handles width distribution
- Kept `min-w-0` -- this is the critical Flexbox fix that allows the flex child to shrink below its content size

### 2. Fix all table components (the children)

For every table component, apply this consistent pattern:

```text
<div className="w-full overflow-x-auto border rounded-lg">
  <table className="w-full text-sm">
```

Changes per file:
- Remove `min-w-full` from all `<table>` elements -- replace with `w-full`
- Add `border rounded-lg` to the overflow wrapper for a clean contained look
- Keep `overflow-x-auto` on the wrapper so horizontal scroll happens inside the card only

### Files to modify

| File | Change |
|------|--------|
| `AdminLayout.tsx` | `overflow-x-auto` to `overflow-hidden`, remove extra `w-full` |
| `LeadsManagement.tsx` | Table: `min-w-full` to `w-full`, wrapper: add `border rounded-lg` |
| `PayoutsManagement.tsx` | Same pattern |
| `ReferralManagement.tsx` | Same pattern |
| `MoneyDashboard.tsx` | Same pattern |
| `StudentManagement.tsx` | Same pattern |
| `AuditLog.tsx` | Same pattern |

### RTL Compatibility
- `overflow-x-auto` works correctly with RTL -- scrollbar direction follows the document direction
- No special RTL handling needed since the layout uses `dir={dir}` on the root container
- `text-start` classes (already in use) automatically adapt to RTL

### Mobile Safety
- Mobile views use card-based layouts (not tables), so these changes only affect desktop
- The `overflow-x-auto` on table wrappers ensures that if columns overflow on tablet, users get a horizontal scrollbar inside the card -- not on the whole page
- No `hidden md:block` or responsive conditionals are being removed
