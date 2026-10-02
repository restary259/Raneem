# Fix: Google location not showing in the dashboard

## What's wrong (confirmed)
When DARB asks Google for its business locations, it also asks for a field called "locationState". Google's current system doesn't recognise that field, so it rejects the whole request ("Request contains an invalid argument"). That gives DARB 0 locations, so the Tamra office can't be linked, and the team Google pages (Reviews, Photos, Posts, Insights) stay empty.

Asking without that field works and returns your listing: "درب للدراسة في المانيا", Al-Quds street, Tamra.

## Steps
1. **Remove the bad field** from both Google requests: the location list and the office profile.
2. **Get verification status from the right place.** Google now sends it in the "metadata" section, which we already ask for. Verified means the business has owner access (`hasVoiceOfMerchant`). Not verified means Pending. If Google marks the listing as disconnected or a duplicate, it shows as a problem instead of "Open". Older saved rows that still hold the old field keep working.
3. **Update the tests.** Replace the test that requires "locationState" with one that makes sure it's never requested again. Add tests for the new verification reading.
4. **Check it works:**
   - Typecheck and the Google tests.
   - A read-only call to Google with the new request, to confirm it no longer fails and returns the Tamra listing.
5. **What you do afterwards:** in Admin → Offices, press Refresh on the Google panel. Then link "درب للدراسة في المانيا" to the Tamra office. After that, the team Google pages fill in.

## Not changed
The database, permissions, the Google connection, and anything that gets posted to Google.

## Technical details
- `src/lib/googleBusinessGateway.ts`: remove `locationState` from `GBP_LOCATION_READ_MASK` (line 253) and `GBP_PROFILE_READ_MASK` (line 616).
- Rewrite `verificationStateOf` and the `location_state` mapping in `normalizeGbpLocation`, plus the state logic in `normalizeGbpProfile`. They should read `metadata.hasVoiceOfMerchant`, `metadata.isDisconnected` and `metadata.duplicateLocation`, and fall back to the old `locationState` when it's present. Extend the `metadata` types to match.
- Tests: `googleBusinessLocation.test.ts` (lines 31-32, 83, 118) and `googleBusinessGateway.test.ts` (lines 120, 147).
- Gates: `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?` and `bunx vitest run src/lib/googleBusiness*`.
