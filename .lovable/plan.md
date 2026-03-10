
## Two UI Bugs Found — Confirmed by Screenshots

### Bug 1 — PartnerOverviewPage: 5-column table breaks on mobile (CRITICAL)

**Evidence:** Screenshot at 390px width shows columns completely mashed — "التخصص" truncated to "التخ ص", "الحالة" badge showing as "م س ج ل", commission column (₪1,000 متوقع) wrapping internally, date column wrapping as "3/10 /202 6". Completely unreadable.

**Root cause (lines 241–300 in `PartnerOverviewPage.tsx`):**
The table uses `table-fixed` with 5 columns (28% + 15% + 18% + 22% + 17%) — that's fine on desktop but on 390px all columns are only ~55–109px wide. Badges and commission text can't fit.

**Fix:** On mobile, collapse to a 3-column card-row layout (Name | Status | Commission). Hide the "Major" and "Date" columns on mobile using `hidden sm:table-cell`. The table already has `overflow-x-auto` wrapper but `table-fixed` fights against it — switching to just `overflow-x-auto` + `min-w-[520px]` on the table makes it horizontally scrollable instead of squashing.

**Implementation:**
- Add `min-w-[520px]` to the `<table>` element (remove `table-fixed`)  
- Add `whitespace-nowrap` to `<th>` and `<td>` cells
- Add `hidden sm:table-cell` to the "Major" th/td (4th column pair) on mobile to reduce to 4 cols
- Commission cell: remove `px-4` padding, use `px-2` on mobile

---

### Bug 2 — PartnerEarningsPage: commission breakdown table clipped on mobile

**Evidence:** Screenshot at 390px shows the 4-column grid (`grid-cols-4`) earnings breakdown table — the last column (commission amount ₪1,000) is cut off because the `min-w-[400px]` inner div doesn't prevent the parent card from clipping it. The horizontal scroll container isn't working correctly in RTL.

**Root cause (lines 215–246 in `PartnerEarningsPage.tsx`):**
The `overflow-x-auto` wrapper contains a `min-w-[400px]` div with `grid-cols-4`. In RTL (`dir="rtl"`), the first rendered column is on the right — but the scroll starts from the right side too, so the leftmost column (commission amount) is the one that gets clipped off-screen.

**Fix:**
- Change the inner div from `min-w-[400px]` to `min-w-[420px]` and add `dir="ltr"` on the scroll container (so horizontal scroll always starts from left), OR
- Better: collapse to 3 columns on mobile by hiding the "Stage" badge column (`hidden sm:block`), since "Payment Status" and "Stage" are somewhat redundant on mobile

**Best approach:** Replace the grid div layout with a proper `<table>` element with `whitespace-nowrap` cells inside an `overflow-x-auto` container. This ensures consistent horizontal scroll in both RTL and LTR.

---

### Files to change

| File | Change |
|------|--------|
| `src/pages/partner/PartnerOverviewPage.tsx` | Table: remove `table-fixed`, add `min-w-[540px]` + `whitespace-nowrap`, hide "major" column on mobile with `hidden sm:table-cell` |
| `src/pages/partner/PartnerEarningsPage.tsx` | Replace `min-w-[400px]` grid div with proper `<table>` + `whitespace-nowrap` cells inside `overflow-x-auto` |

No backend changes needed. No new dependencies.
