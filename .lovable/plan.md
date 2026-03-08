
## Root Cause Analysis

From image-19, the `/team/cases/{id}` detail page has severe character-by-character vertical overflow. The primary culprit is in `renderNextAction()` (lines 527–552) — the `appointment_scheduled` state renders a `flex items-center justify-between gap-4` row where:

1. **The date text `"Wed, Mar 18 · 9:00 AM"` has no `min-w-0` or `overflow-hidden`** on its container, and the sibling `flex gap-2 shrink-0 flex-wrap` button group steals all horizontal space, crushing the text into a 1-character-wide strip.

2. **The outcome notes `<span className="text-xs text-muted-foreground truncate">`** at line 978 needs `min-w-0` on its parent to truncate properly.

3. **`flex justify-between` rows in Financial Summary** (lines 880–920) render long labels (e.g., program names in parentheses) without `min-w-0` on the label side, causing overflow on narrow viewports.

4. **The `format()` call at line 531 and 965** uses `"EEE, MMM d · h:mm a"` which outputs English regardless of language — needs locale-aware formatting (per memory: always use `"en-US"` locale for numeric safety, but format call still hardcodes English month names via date-fns which has no locale passed in).

5. **The header area** (lines 689–729) `flex items-center gap-4 flex-wrap` with badge group and delete button can wrap badly on 360px viewports.

6. **The `outcome_notes` span** at line 978 inside a `flex items-start justify-between` has `truncate` but its parent div `className="min-w-0"` only applies to the first child — the `<span>` itself needs `max-w-[150px] sm:max-w-none` or the badge wrapper needs `flex-shrink min-w-0`.

## Precise Fixes — `src/pages/team/CaseDetailPage.tsx` only

### Fix 1 — Next Action: appointment_scheduled layout (lines 527–552)
Change the outer `div` from `flex items-center justify-between gap-4` to `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3` so on mobile it stacks vertically. Add `min-w-0 flex-1` to the text container div and `flex-wrap justify-start` to the button group.

### Fix 2 — Appointment date format (lines 531 + 965)
`format(new Date(pendingAppt.scheduled_at), "EEE, MMM d · h:mm a")` → use `new Date(a.scheduled_at).toLocaleString("en-US", { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })` per numeric safety memory (always en-US for numbers).

### Fix 3 — Appointments history list row (lines 958–1014)
The `div className="flex items-start justify-between gap-2"` at line 960 needs `min-w-0` on the left `div`. The button group on the right needs `flex-col sm:flex-row` wrapping. The outcome notes `<span>` at line 978 needs `block max-w-[160px] truncate` so it doesn't overflow.

### Fix 4 — Financial Summary rows (lines 880–920)
Each `flex justify-between` row's left `<span>` needs `truncate flex-1 min-w-0 me-2` and the right `<span>` needs `shrink-0 whitespace-nowrap` so long program names (e.g., "Accommodation (Stadtmitte Heidelberg)") don't cause overflow.

### Fix 5 — Header area button group (lines 709–728)
The badge/button group `div className="flex items-center gap-2 flex-wrap"` needs `shrink-0` to prevent it eating into the name.

### Fix 6 — `formatDistanceToNow` on line 706
Wrap in `<span dir="ltr" className="inline-block">` (same fix already done for TeamCasesPage, but CaseDetailPage was missed).

## Files to Change
| File | Lines |
|------|-------|
| `src/pages/team/CaseDetailPage.tsx` | 527–552, 531, 695–728, 880–920, 958–1014 |

Single file, no DB or locale changes needed.
