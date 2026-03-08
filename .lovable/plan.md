

## What's Still Broken — Live Screenshot Analysis

### Bug 1 — Header completely broken on RTL mobile (line 691)
The header `div` uses `flex items-start gap-3 flex-wrap` but has **no `dir` attribute**. In Arabic RTL, the back arrow `ArrowLeft` appears on the right, the name is squeezed, and the badge group with `appointment scheduled` is colliding with the truncated name `...est`. The layout needs `dir="ltr"` forced on the header row (navigation arrows should always be LTR), and the name block needs stronger truncation.

### Bug 2 — Notes text bleeds outside card (line 535)
`pendingAppt.notes` renders as `<p className="text-xs text-muted-foreground mt-0.5 truncate">`. The parent `div className="min-w-0 flex-1"` has `min-w-0` but the containing flex row (line 527) uses `flex-col sm:flex-row`. On mobile this stacks fine but the note text still bleeds to the **left edge of the screen** because the outer `CardContent` has no `overflow-hidden`. The fix: add `overflow-hidden` to `CardContent` of the Next Action card, and change `truncate` → `line-clamp-2 break-words` on the notes paragraph.

### Bug 3 — "about 1 hour ago" word-wraps (line 708)
`<span dir="ltr" className="inline-block">` — `inline-block` doesn't prevent internal wrapping in narrow containers. Need `whitespace-nowrap` added to prevent "about 1 / hour ago" split.

### Bug 4 — Course Program card rows missing overflow protection (lines 1031–1078)
The `flex justify-between` rows at lines 1031–1075 have no `gap-2`, no `min-w-0` on labels, and no `shrink-0 whitespace-nowrap` on values. Long program names like "Intensive German B2 (Goethe Institut)" will overflow. Same fix as Financial Summary: add `truncate flex-1 min-w-0` to labels and `shrink-0 whitespace-nowrap` to values.

### Bug 5 — Header direction in RTL mode causes arrow/name collision (line 691–731)
The outer header wrapper needs `dir="ltr"` since it contains a navigation arrow that must point left always. Without this, in RTL the `←` arrow renders on the right side while the name bleeds left. Adding `dir="ltr"` to the header row preserves correct navigation affordance cross-language.

---

## Files to Change

| File | Lines | Fix |
|------|-------|-----|
| `src/pages/team/CaseDetailPage.tsx` | 691 | Add `dir="ltr"` to outer header wrapper |
| `src/pages/team/CaseDetailPage.tsx` | 534–535 | Change notes `p` to `line-clamp-2 break-words overflow-hidden` |
| `src/pages/team/CaseDetailPage.tsx` | 708 | Add `whitespace-nowrap` to `dir="ltr"` timestamp span |
| `src/pages/team/CaseDetailPage.tsx` | 934 | Add `overflow-hidden` to Next Action card |
| `src/pages/team/CaseDetailPage.tsx` | 1031–1078 | Add `truncate flex-1 min-w-0` to label spans, `shrink-0 whitespace-nowrap` to value spans |

---

## Precise Diffs

**Fix 1** — Line 691: `<div className="flex items-start gap-3 flex-wrap">` → `<div className="flex items-start gap-3 flex-wrap" dir="ltr">`

**Fix 2** — Line 534–535 (notes paragraph in Next Action):
```
<p className="text-xs text-muted-foreground mt-0.5 truncate">{pendingAppt.notes}</p>
```
→
```
<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words overflow-hidden">{pendingAppt.notes}</p>
```

**Fix 3** — Line 708 (timestamp span):
```
<span dir="ltr" className="inline-block">
```
→
```
<span dir="ltr" className="inline-block whitespace-nowrap">
```

**Fix 4** — Line 934 (Next Action Card): add `overflow-hidden` to the `Card` element:
```
<Card className="border-primary/30 bg-primary/5">
```
→
```
<Card className="border-primary/30 bg-primary/5 overflow-hidden">
```

**Fix 5** — Lines 1031–1075 (Course Program card rows): wrap each label `<span>` in `truncate flex-1 min-w-0` and each value `<span>` in `shrink-0 whitespace-nowrap font-medium`, and add `gap-2` to each `flex justify-between` row.

Single file change only: `src/pages/team/CaseDetailPage.tsx`

