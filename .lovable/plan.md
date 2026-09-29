# Compact pipeline cards (Admin → Pipeline)

Right now each card stacks 7 rows: name, phone, partner, EN/MA, a red "Unassigned" tag, the age and "Has info", and a full-width assign dropdown. Unassigned shows up twice. The new card uses 3–4 short rows, matching your sketch.

## New card layout
```text
┌─────────────────────────────────┐
│ Ataa Test          Apply  ⚠  1d │  name · source · warning · age
│ 0523698741 · Partner: Ataa I.   │  phone + partner on one line (truncated)
│ EN 3  MA 5  Has info   👤 Unass ▾│  chips on the left, compact assign button on the right
└─────────────────────────────────┘
```
- The age (e.g. "1d") moves up to the top line next to the name.
- The phone and partner/agent share one line and are shortened with "…" when long.
- The EN/MA chips, "Has info" and the duplicate-phone warning go on one wrapping chip row.
- The separate red "Unassigned" tag is removed. The assign control becomes a small pill at the end of the chip row: red "Unassigned" when nobody is assigned, otherwise the assignee's first name. Tapping it opens the same team-member list as now.
- Tighter padding and spacing (about half the current height). The stale warning borders stay.

## What stays the same
All the information shown, tapping a card to open its detail panel, assigning from the card, the colours and warnings. Nothing changes in how the data works.

## Technical notes
- `src/pages/admin/AdminPipelinePage.tsx` l.617–719: `CardContent` `p-2.5 space-y-1.5`. Move `{days}d` into the header. Merge the phone and `AttributionBadge` into one `min-w-0 truncate` row. Merge the chips, hasInfo, duplicate and assign into one `flex flex-wrap items-center gap-1` row.
- Remove the standalone assignee/unassigned block. The `SelectTrigger` becomes `h-6 w-auto max-w-[45%] ms-auto rounded-full px-2 text-[11px]`, with destructive tone when unassigned and `stopPropagation` kept.
- The loading skeleton height goes from `h-24` to `h-16`. No new i18n keys.
