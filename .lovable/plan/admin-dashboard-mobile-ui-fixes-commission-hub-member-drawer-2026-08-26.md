# Admin dashboard mobile UI fixes (Commission Hub + Member drawer)

Presentation-only pass. No data, RPC, RLS, or commission logic changes.

## 1. Member detail sheet — content showing through the header (high)

`src/components/admin/MemberDetailDrawer.tsx` renders the header and a scrolling
body; the header has a border but no opaque background and no stacking context, so
scrolled rows (e.g. a "Recent Rate Changes" entry) bleed under/behind it and read as
floating next to "PERFORMANCE".

- Make the header `sticky top-0 z-20` with a solid `bg-background` (both the Drawer
  and Sheet variants share the same panel, so one change covers mobile + desktop).
- Give the mobile body a real scroll container instead of `max-h-[calc(100vh-200px)]`
  (use flex column: header fixed height, body `flex-1 min-h-0 overflow-y-auto`) so the
  scroll area can never extend past the header.

## 2. Role badge crowding the name row (low, same file)

- Move the role badge out of `<Title>` into its own line under the name on mobile
  (`flex-wrap`, `mt-1`), keep it inline from `sm:` up.
- Add `min-w-0` + `truncate` to the name so a long name never pushes the badge into
  the row above.

## 3. "Recruited · Agent" badge overlap and stray dot (high)

`src/pages/admin/AdminCommissionHubPage.tsx`, the partner/ambassador row badge:

```
<Badge>Recruited{account.agent_name && <span>· {agent_name}</span>}</Badge>
```

The separator sits inside the badge with no spacing and wraps badly on narrow screens.

- Render one badge whose content is `Recruited` and, when known, ` · {agent_name}` as a
  single non-wrapping string (`whitespace-nowrap`, `truncate`, `max-w-[9rem]`), with the
  dot only inside that string — no standalone `·` node.
- Wrap the name + badge container in `flex-wrap gap-x-2 gap-y-1` so the badge drops to
  its own line rather than overlapping.

## 4. "custom₪1,000" runs together (medium, same file)

Three places render `custom` immediately followed by the amount. Add an explicit
separator: `custom · ₪1,000` (a `·` span with `mx-1`), applied to the team row, the
agent self-referral/additive rows, and the partner/ambassador row.

## 5. Truncated names/emails in the Commission Hub tabs (medium, same file)

Rows are a single `flex` line, so on a 400px viewport the name column collapses to
`team…`.

- On mobile stack the row: identity block full width on its own line, then the badge +
  input + Save on a second line (`flex-col sm:flex-row`).
- Give the identity block `w-full sm:flex-1 min-w-0`; keep `truncate` but add `title`
  attributes on name and email so the full value is available on long-press/hover.

## 6. Tab bar clipped with no scroll cue (medium)

`src/components/shell/SegmentedTabs.tsx` is a plain `overflow-x-auto` row.

- Add edge fade masks on the scroller (CSS `mask-image` linear-gradient, applied only
  when the row overflows) so both edges signal more tabs, RTL-safe via logical
  gradients.
- Scroll the active trigger into view on mount/active change
  (`scrollIntoView({ inline: "center", block: "nearest" })`), so an active tab is never
  half-cut.

## Verification

- `npm run build` and `npx vitest run` green (existing `AdminCommissionHubPage` and
  `MemberDetailDrawer.agentFlags` tests must still pass).
- Visual check at 402px width: Commission Hub tabs (Team/Agents/Partners/Ambassadors)
  and the agent + partner detail sheets.
