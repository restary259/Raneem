# Fix "undefined is not an object (evaluating 'this.rest')" on the office Google section

## Cause (confirmed in code)
The office edit screen's Google Business section calls the database through a shortcut saved in `src/lib/googleBusinessApi.ts`. That shortcut was copied off the database client without keeping its link to it, so every Google action breaks as soon as it runs: loading the Google section, listing locations, choosing a Primary or Side Manager, or removing one. The team "Google" page uses the same shortcut and fails the same way.

The tests didn't catch it because their fake database client doesn't need that link.

This is the only place in the app that uses this pattern.

## Fix
1. In `googleBusinessApi.ts`, keep the shortcut tied to the database client (`supabase.rpc.bind(supabase)`, or call `supabase.rpc(...)` directly). No other change in behaviour.
2. Make the test's fake client need the same link, so this kind of mistake fails the tests next time.
3. Check that it works:
   - Run the typecheck and the Google tests.
   - Open Admin, then Offices, then edit an office in a browser, signed in as admin. Confirm the Google section loads with no red error.
   - Open the team Google page as Kheir and confirm it loads.

## Not changed
Database, permissions, and the Google connection.
