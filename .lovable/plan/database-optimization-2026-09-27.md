# Database optimization

## What the measurements show

Slow-query statistics (the database's own records) rank these as the biggest cost:


| #   | Query                                                                  | Calls | Avg   | Worst    | Total  |
| --- | ---------------------------------------------------------------------- | ----- | ----- | -------- | ------ |
| 1   | WhatsApp inbox list (conversations + lead)                             | 2,218 | 18 ms | 359 ms   | 39.6 s |
| 2   | Count of WhatsApp messages by direction (exact count over whole table) | 411   | 55 ms | 1,091 ms | 22.6 s |
| 3   | Staff directory lookup                                                 | 3,044 | 4 ms  | 320 ms   | 11.9 s |
| 4   | Latest inbound WhatsApp message time                                   | 410   | 22 ms | 603 ms   | 8.9 s  |
| 5   | WhatsApp staff directory                                               | 411   | 17 ms | 831 ms   | 6.9 s  |
| 6   | Unread notification count (exact count)                                | 571   | 11 ms | 447 ms   | 6.5 s  |


The indexes these queries need already exist (`updated_at`, `direction + created_at`, unread notifications). So the cost is not missing indexes — it is how often the app asks, asking for exact counts of whole tables, and per-row security checks. The overall health snapshot was unavailable, so it is not included.

## Fixes (in order of impact)

1. **WhatsApp message count (#2, #4)** — replace the full-table exact count and the separate "latest time" query with one small server function returning both numbers. Removes a 1-second worst case.
2. **WhatsApp inbox list (#1)** — select only the columns the list shows instead of every column of both tables, and stop refetching the full page on every realtime event (update the one changed row instead).
3. **Staff directories (#3, #5)** — called 3,000+ times; cache the result in the app for several minutes (it rarely changes) and mark the functions as stable so the database can reuse plans.
4. **Unread notifications (#6)** — use a lightweight count that hits the existing unread index, and share one count across the bell and app badge instead of each querying separately.
5. **Security-check cost** — inspect the row-security rules on `whatsapp_conversations`, `whatsapp_messages` and `notifications`; where a rule calls a role check per row, wrap it so it is evaluated once per query. Verified with query plans before and after.
6. **Verify** — reset nothing; re-run the slow-query ranking after a day of use and compare totals.

## Will not change

Permissions, who can see what, WhatsApp routing, notification delivery, money and case logic. No data is deleted.

## Technical details

- New SQL: `get_whatsapp_inbound_stats()` (SECURITY DEFINER, staff-gated) returning `{ inbound_count, last_inbound_at }`; `ALTER FUNCTION get_staff_directory / get_whatsapp_staff_directory STABLE` if currently volatile.
- RLS: rewrite `has_role(auth.uid(), ...)` 
- predicates as `(select has_role(auth.uid(), ...))` for initplan caching; confirm with `EXPLAIN (ANALYZE, BUFFERS)`.
- Frontend: move directory + unread count reads into shared React Query keys (`staleTime` 5 min / 30 s); replace `count: 'exact'` with `'estimated'` or the RPC where an exact number is not required.