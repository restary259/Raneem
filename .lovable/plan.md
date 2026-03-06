
## Problem
In `src/pages/admin/AdminSpreadsheetPage.tsx`, line ~116:
```tsx
<SelectItem value="">All months</SelectItem>
```
Radix UI `Select` throws a runtime error when a `SelectItem` has `value=""` (empty string is reserved for clearing selection). This crashes the entire page via ErrorBoundary.

## Fix (single file change)
Replace the empty-string sentinel with `"all"` and update the 3 places that reference it:

1. `<SelectItem value="">` → `<SelectItem value="all">`
2. `filterMonth` clear button: `setFilterMonth('')` → `setFilterMonth('all')`  
3. `filteredRows` filter condition: `filterMonth ? rows.filter(...)` → `filterMonth !== 'all' ? rows.filter(...)`
4. Initial state: `useState('')` → `useState('all')`

This is a minimal, targeted fix in one file with no structural changes.
