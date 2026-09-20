# Restore the published DARB site

## Confirmed failure

- `https://darb-agency.lovable.app/` currently returns HTTP 500 and the generic “This page didn’t load” fallback.
- Production server logs identify the exact exception: `Error: supabaseUrl is required` while the root server bundle initializes the browser database client.
- The preview returns HTTP 200 because the local environment contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the published build does not receive those browser-prefixed values.
- The prior `sideEffects` repair is present, but it cannot fix missing build configuration.

## Repair

1. Restore explicit compile-time definitions for the public database URL and publishable key in the Vite configuration.
   - Prefer configured environment values when present.
   - Fall back to this project’s existing public URL and publishable key, which are safe for browser use and already protected by row-level access rules.
   - Do not expose any private/service credential.
   - Do not edit the generated database client.
2. Strengthen the existing production-binding test so it verifies both required browser values are defined, preventing another deployment that builds successfully but crashes at startup.
3. Keep the current TanStack server entry, routes, authentication, WhatsApp flow, and UI unchanged.

## Verification

- Run the focused configuration test and the normal automated checks.
- Produce one production build and inspect the built server artifact to confirm the database URL is embedded and startup no longer receives an empty value.
- Run the production bundle locally and verify `/`, `/admin/messages?tab=whatsapp`, and `/api/public/whatsapp/webhook` respond without the startup 500.
- Publish the repaired build.
- Verify the published homepage and WhatsApp inbox entry route return successfully, then check fresh production logs for absence of `supabaseUrl is required`.
