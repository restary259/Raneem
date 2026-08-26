# Fix admin catalog header overlap + payout filter correctness

## 1. School header actions overlapping the school name (the bug in the screenshots)

`src/components/admin/programs/SchoolInfoCard.tsx` puts the identity block and the
action cluster (Active badge, Edit, Pause/Activate, Delete) in one row, and the action
cluster is marked `shrink-0`. At 402px the four controls take the full row width, so the
name column collapses to a few characters and the buttons visually sit on top of the
Arabic school name and city.

Fix (presentation only, same actions and handlers):

- Stack the header on mobile: outer row becomes `flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`.
- Drop `shrink-0` from the action cluster and let it wrap: `flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end`.
- Keep the identity block `min-w-0` and let the name wrap instead of truncate on mobile
  (`break-words`, `sm:truncate`) so a long name never gets cut to one word.
- Delete button gets `ms-auto sm:ms-0` so it doesn't jam against Pause on a 2-line wrap.

## 2. Scan of the rest of the admin dashboard for the same pattern

Checked every `justify-between` header/row in the admin catalog and directory
components. The other surfaces already handle narrow widths correctly:

- `SchoolProgramsList` / `SchoolAccommodationsList` — actions live in their own footer
  row below the content, badges are `shrink-0` next to a `min-w-0 truncate` block.
- `SchoolDirectory`, `InsuranceSection` — single badge/trigger, no cluster.
- `catalog/*` shared cards (Team side) — already `flex-col sm:flex-row`.

No other overlap of the same kind found. If the scan surfaces a second instance during
implementation it gets the same treatment (stack + wrap, never `shrink-0` on a cluster).

## 3. Payout page filter

`src/components/admin/RoleDirectory.tsx` — the search and the `all/open/balance/settled`
select work, but two correctness issues:

- **Overlapping buckets**: `balance` counts `available_amount > 0 || locked_amount > 0`,
  while `settled` only checks `available_amount === 0` and ignores locked. A requester
  with locked-only rewards appears under *both* "Has balance" and "Settled". Fix:
  `settled` = no open requests **and** no available **and** no locked, so the buckets are
  mutually exclusive.
- **Missing counts**: only "All" and "Pending requests" show a count; add counts to
  "Has balance" and "Settled" using the same predicates, so the dropdown states what it
  will return before you pick it.

Also extract the three predicates into one small `matchesFilter(row, filter)` helper used
by both the list filtering and the option counts, so counts can never drift from results.
No RPC, RLS or payout logic changes.

## Verification

- `npx vitest run` and the build stay green.
- Visual check at 402px: Admin › Catalog school profile header (Active/Edit/Pause/Delete
  no longer over the name), and Finance › Payouts filter counts matching the rendered list
  for each of the four options across the role tabs.
