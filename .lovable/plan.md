# Phase 2 — Connect info@darb.agency to Google Business Profile (built-in connector)

## Goal
An admin can connect DARB's Google Business account (info@darb.agency) once, see that the connection is healthy, and see which Google business accounts and locations DARB can reach. Nothing is mapped, edited or posted in this phase.

## What changes versus the document
The built-in Google Business connector replaces sections 1–8 and 11–14 of the document: Google sign-in, consent, offline access, refresh tokens, encryption and token refresh are all handled for us. We never see or store Google tokens. The connection belongs to DARB as a whole, not to one team member, which is what the document asks for.

## Steps
1. **Find Phase 1.** Search GitHub branches and open PRs for the Phase 1 Google Business foundation. If it turns up, build on it. If it doesn't, stop and ask you before creating any tables.
2. **Connect.** Open the connector card. You sign in as info@darb.agency and link the connection to this project.
3. **Smoke test.** Make a read-only call that lists Google business accounts. If Google hasn't approved API access yet, we show its exact message and stop.
4. **Admin-only server steps** (admin role checked on the server):
   - Connection health: connected, Google account, last successful call, last error.
   - Account and location discovery, read only, with paging.
5. **Admin UI.** Add a "Google Business" panel to the admin Offices area:
   - Not connected: explains how to connect.
   - Connected: shows the account, health and a list of discovered accounts and locations, with a Refresh button.
   - Every label in Arabic, English and Hebrew.
6. **Audit.** Write an audit event for each health check, discovery run and failure. Never log any credential.
7. **Team members:** nothing changes, and every Google Business server step returns 403 for anyone who isn't an admin.

## Out of scope (Phase 3+)
Linking offices to locations, reviews, replies, profile edits, posts, photos and insights.

## Technical details
- Server calls go to the connector gateway using LOVABLE_API_KEY plus GOOGLE_BUSINESS_PROFILE_API_KEY. They run in admin-gated server code only, never in the browser.
- Discovery calls: `account_management/v1/accounts`, then `business_information/v1/accounts/{id}/locations?readMask=name,title,storefrontAddress,metadata`.
- Errors: show Google's status and message. 403 means API not approved or no access. 401 leads to a reconnect card. 429 is retried after the wait Google asks for, with a maximum of 3 tries, and only for reads.
- Snapshots of discovered accounts and locations are cached, not fetched on every page load. Their storage uses the Phase 1 schema if it exists, or a migration you deploy yourself, with admin-only RLS and grants.
- Disconnecting only unlinks the connection from this project. It never touches office data.
- Checks: typecheck, the i18n key tests, tests for the admin guard and error mapping, and a build.
