
## Fix: Conversion Funnel Chart Spacing

**Root cause**: `height={380}` with 9 bars = ~42px per row. Arabic label text at 11px needs ~50px of vertical space minimum. The bars appear crushed together.

**Single file change**: `src/pages/admin/AdminAnalyticsPage.tsx`

### Change:
**Line 106** — `height={380}` → `height={500}`

**Line 107-110** — Add `barCategoryGap="40%"` and `barSize={20}` to the BarChart:
```tsx
// Before
<BarChart data={funnelData} layout="vertical" margin={...}>

// After  
<BarChart data={funnelData} layout="vertical" barCategoryGap="40%" barSize={20} margin={...}>
```

This gives each of the 9 rows ~55px (500/9), with 40% of that being gap = ~22px gap between bars. The bar itself gets `barSize={20}` fixed height so it doesn't balloon. Result: labels are clearly separated with visual breathing room.

**No other files need changes** — this is purely a chart dimension tweak.
