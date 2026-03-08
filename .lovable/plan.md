
## What's Wrong — Side-by-Side Comparison

### English (correct)
- Funnel: labels on LEFT, bars grow RIGHT ✅
- Grid order left-to-right: [Funnel | Source Breakdown] ✅
- Avg Days X-axis: English short labels, angled cleanly ✅

### Arabic (broken — 3 bugs)

**Bug 1 — Funnel bars bunched to the right edge**
`orientation="right"` on YAxis moves the label axis to the right side — correct for RTL reading. BUT Recharts' internal chart area still draws bars starting from x=0 (left wall). With `width={130}` allocated on the RIGHT for labels, the actual bar drawing area shrinks and bars appear as tiny sliver lines near the right edge. The labels themselves are fine but bars look invisible.

**Fix**: Remove `orientation={isRtl ? 'right' : 'left'}` entirely. Instead, keep YAxis on the LEFT (default) and swap the entire card order using CSS for RTL. This is the correct pattern — Recharts does not support true RTL bar reversal. The label position swap via `orientation` breaks bar rendering.

**Bug 2 — Grid column order not RTL-aware**
The `grid md:grid-cols-2` wraps `[Funnel card | Source Breakdown card]`. In Arabic RTL, CSS grid auto-flow reversal means visual order becomes `[Source Breakdown | Funnel]` — the funnel ends up on the right. This is actually CSS-correct RTL behavior. But paired with Bug 1, the visual result looks broken.

**Fix**: Wrap the grid in a `dir="ltr"` container to keep consistent card placement, then let the card titles/content use their own RTL. Or use `order-1`/`order-2` classes to explicitly control card order regardless of direction.

**Bug 3 — "Avg Days" X-axis labels overlap in Arabic**  
`textAnchor="end"` with `angle={-30}` works for LTR (text rotates to align below-left of tick). For Arabic RTL text strings, `textAnchor="end"` anchors the END of the Arabic string (which visually appears on the LEFT), causing labels to shift leftward and overlap adjacent bars.

**Fix**: Use `textAnchor="middle"` in both languages and increase `height={80}` to give rotated labels more vertical room. Or switch the avg-days chart to `layout="vertical"` (horizontal bars) like the funnel, which eliminates the X-axis label problem entirely.

---

## Fix Plan — 1 file only: `AdminAnalyticsPage.tsx`

### Fix 1: Remove `orientation` prop from funnel YAxis
```tsx
// Remove this — it breaks bar rendering:
orientation={isRtl ? 'right' : 'left'}

// Keep YAxis always on left (Recharts default)
// Labels stay left, bars grow right — works in both LTR and RTL
```
The Arabic label text is already correct Arabic (RTL rendering inside the tick). The axis doesn't need to physically move.

### Fix 2: Fix chart grid card order for RTL
Add `dir="ltr"` to the grid wrapper so card placement is consistent, but allow card interiors to use `dir="auto"` for content:
```tsx
<div className="grid md:grid-cols-2 gap-6" dir="ltr">
  {/* Cards will always render: [Funnel LEFT | Source RIGHT] */}
```

### Fix 3: Fix "Avg Days" X-axis label anchor for Arabic
```tsx
// Change:
angle={-30}
textAnchor="end"

// To:
angle={-35}
textAnchor="middle"
height={80}
```
`textAnchor="middle"` centers the rotated label under its tick mark in both LTR and RTL, preventing the leftward drift.

### Fix 4: Correct funnel margin for RTL
With YAxis always on left, the margin should NOT add extra left space in RTL:
```tsx
// Change from:
margin={{ top: 4, bottom: 4, left: isRtl ? 4 : 0, right: isRtl ? 0 : 4 }}

// To:
margin={{ top: 4, bottom: 4, left: 0, right: 4 }}
// Uniform — YAxis is always left, so consistent margin
```

---

## Summary

| Bug | Root Cause | Fix |
|---|---|---|
| Bars are tiny/invisible in Arabic | `orientation="right"` breaks bar draw area | Remove orientation prop |
| Card layout confusing in RTL | CSS grid RTL direction flip | Add `dir="ltr"` to grid wrapper |
| Avg Days labels overlap in Arabic | `textAnchor="end"` wrong for RTL text | Use `textAnchor="middle"` |

**1 file changed**: `src/pages/admin/AdminAnalyticsPage.tsx` — 4 small targeted edits, no logic changes.
