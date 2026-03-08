
## Root Cause Analysis from Screenshot

The screenshot shows the "Data Reset" tab of AdminSettingsPage. The overflow is caused by the `<span>` showing `cat.tables.join(", ")` (e.g., `"cases, case_submissions, case_service_snapshots"`) inside a flex row with no width constraint. Because the flex item has no `min-w-0` or `truncate/break-all`, the long table names string forces each row to expand and the text wraps character-by-character.

## All Issues Found (CSS-only fixes)

### 1. `AdminSettingsPage.tsx` — Data Reset category rows (line 616–627)
The category row: `flex items-center gap-3 p-3 border rounded-lg`
- `<Label>` has `flex-1` ✅ but `<span className="text-xs text-muted-foreground">{cat.tables.join(", ")}</span>` has **no max-width, no truncate, no min-w-0** — it can be 50+ chars wide
- Fix: Add `truncate max-w-[120px] sm:max-w-none` to the tables span, OR wrap the flex row in `flex-wrap` and give the span `break-all text-xs`

### 2. `AdminSettingsPage.tsx` — Visa Fields DialogContent (line 507)
`<DialogContent dir={isRtl ? "rtl" : "ltr"}>` — **no max-w class** at all, will use browser default which can overflow on mobile
- Fix: Add `className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto"`

### 3. `AdminSettingsPage.tsx` — AlertDialogContent (line 688)
`<AlertDialogContent>` — no responsive max-w
- Fix: Add `className="max-w-[95vw] sm:max-w-md"`

### 4. `SecurityPanel.tsx` — 24h summary grid (line 171)
`grid grid-cols-3 gap-3` — on 320px, 3 equal cards with labels like "Successful (24h)" will be very tight
- Fix: `grid-cols-1 sm:grid-cols-3` or keep 3 cols but ensure text wraps with `text-[10px] sm:text-xs` on the labels

### 5. `SecurityPanel.tsx` — Search input min-w (line 191)
`min-w-[200px]` on the search div inside a flex row — on small screens, 200px + 140px select = 340px > 320px viewport
- Fix: Remove `min-w-[200px]`, use `min-w-0 w-full` instead; the flex `flex-1` already handles sizing

### 6. `CommissionSettingsPanel.tsx` — `mr-2` on icons (lines 303–304)
`<Loader2 className="... mr-2" />` and `<Save className="... mr-2" />` — hardcoded LTR spacing
- Fix: `me-2`

### 7. `CommissionSettingsPanel.tsx` — Example calc grid (line 256)
`grid grid-cols-3 gap-2` — on narrow screens with currency values, very tight
- Fix: `grid-cols-1 sm:grid-cols-3`

### 8. `CommissionSettingsPanel.tsx` — Visibility override buttons (line 390)
`grid grid-cols-3 gap-2` — 3 option cards each with description text, at 320px they're ~90px each, text overflows
- Fix: `grid-cols-1 sm:grid-cols-3` 

### 9. `EligibilityConfig.tsx` — Thresholds grid (line 136)
`grid grid-cols-2 gap-4` — bare grid-cols-2 with no sm: breakpoint
- Fix: `grid-cols-1 sm:grid-cols-2`

### 10. `EligibilityConfig.tsx` — Legend row (line 152)
`flex justify-between text-[10px]` — 3 items in a flex row with Arabic text, can overflow
- Fix: `flex flex-wrap justify-between gap-1`

### 11. `AuditLog.tsx` — Search filter row (line 41)
`min-w-[200px]` on search div — same issue as SecurityPanel
- Fix: Remove `min-w-[200px]`, use `min-w-0`

## Files to Edit

| File | Lines | Change |
|---|---|---|
| `AdminSettingsPage.tsx` | 616–626 | Tables span → `truncate min-w-0` or `break-all`; wrap row with `flex-wrap` |
| `AdminSettingsPage.tsx` | 507 | Visa DialogContent → `max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto` |
| `AdminSettingsPage.tsx` | 688 | AlertDialogContent → `max-w-[95vw] sm:max-w-md` |
| `SecurityPanel.tsx` | 171 | 3-col summary grid → `grid-cols-1 sm:grid-cols-3` |
| `SecurityPanel.tsx` | 191 | Search `min-w-[200px]` → `min-w-0` |
| `CommissionSettingsPanel.tsx` | 303–304 | `mr-2` → `me-2` |
| `CommissionSettingsPanel.tsx` | 256 | Example calc `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `CommissionSettingsPanel.tsx` | 390 | Visibility options `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` |
| `EligibilityConfig.tsx` | 136 | Thresholds `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `EligibilityConfig.tsx` | 152 | Legend `flex justify-between` → `flex flex-wrap justify-between gap-1` |
| `AuditLog.tsx` | 41 | Search `min-w-[200px]` → `min-w-0` |

All changes are CSS classes only. Zero logic, state, queries, or translations touched.
