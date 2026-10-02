# Fix: Google Reviews/Photos/Posts sync shows "Error 404"

## What's wrong (confirmed)
Your office's saved Google account is stored as `accounts/106853541274708677066`. When the dashboard builds the request for reviews, photos or posts, it adds `accounts/` again. Google gets `accounts/accounts/106853541274708677066/...`, doesn't recognise it, and returns its "404 Not Found" web page. That page is what the red box shows.

Insights and Profile use a different address format, so this bug doesn't affect them.

## Steps
1. Add a small helper that turns an account or location value into its bare number. It accepts `accounts/123`, `locations/456`, `accounts/123/locations/456` or a plain number.
2. Use it in every place that builds a Google address for reviews, replies, photos, photo uploads, posts and insights. Saved data stays the same, and old and new formats both work.
3. When Google sends back an HTML error page, show a short readable message ("Google couldn't find this listing (404)") instead of raw page code.
4. Tests:
   - A helper test that covers all the input formats.
   - A path test that passes `accounts/…` and checks that `accounts/` never appears twice.
5. Check it works:
   - Typecheck and the Google tests.
   - A live read-only call for reviews, photos and posts on the Tamra listing.
   - Press Sync on each page and confirm the data appears.

## Not changed
The database, permissions, the connection, and anything that gets posted to Google.

## Technical details
- Files: `src/lib/googleBusinessGateway.ts`, which gets a new `bareGoogleId()` helper. It's applied inside `reviewsPath`, `reviewReplyPath`, `mediaPath`, `mediaItemPath`, the media upload path, `postsPath`, the post item and create paths, `locationPath` and the performance paths.
- The resource name built in `googleBusinessPosts.functions.ts:656` gets the same treatment.
- Error mapping: in `GbpError` creation, detect a `<!DOCTYPE html` body and replace it with a status-based message.
