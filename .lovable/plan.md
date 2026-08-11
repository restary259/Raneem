# Remove the configuration blocker and restore rendering

## Confirmed diagnosis

- `src/integrations/supabase/client.ts:11-38` contains the entire visible **Configuration error** screen and throws before React can mount.
- The currently published bundle contains that guard, but it does **not** contain the Lovable Cloud endpoint/project marker. This proves the published snapshot was compiled without the required public `VITE_SUPABASE_*` values.
- Lovable Cloud itself is connected, active, and healthy. The local project environment also has all three values, so this is a frontend build-binding problem rather than a database outage.
- Removing only the custom screen is insufficient: `createClient()` would still receive missing values and fail during module initialization.
- `public/service-worker.js:125-130` uses network-only navigation and the deployed HTML points to a hashed bundle, so the service worker is not the root cause. A new deployment is still required after the code fix.

## Implementation

1. **Remove the custom startup safeguard completely**
   - Delete the missing-variable collector, direct `#root` HTML injection, console error, and explicit throw from `src/integrations/supabase/client.ts`.
   - Keep the normal Lovable Cloud client initialization and auth persistence behavior unchanged.

2. **Make Lovable Cloud public configuration build-safe**
   - Update `vite.config.ts` to resolve the three public frontend Cloud values from the build environment first and use this project's canonical public Cloud configuration as the fallback.
   - Apply the resolution at Vite compile time so every existing `import.meta.env.VITE_SUPABASE_*` call site receives the same valid values; no broad component rewrite is needed.
   - Do not add or expose any service-role key, private credential, or backend secret. The endpoint, project identifier, and publishable browser key are intentionally public and remain protected by database access policies.

3. **Align the production preflight**
   - Adjust `.github/workflows/ci.yml` so it no longer blocks a valid build merely because GitHub-specific copies of Lovable Cloud's public values are absent.
   - Keep a build verification that confirms the compiled frontend received usable Cloud configuration.

4. **Regression coverage and verification**
   - Add a focused startup/build test proving the custom Configuration error text is gone and the production bundle receives valid Cloud configuration without a local `.env` file.
   - Run the full unit suite and production build.
   - Open the built app in a clean browser context, verify the homepage renders, confirm there is no configuration exception, and make one harmless public backend request.
   - Verify the generated bundle contains the configured endpoint but no private backend credentials.

5. **Deployment validation**
   - Publish the corrected snapshot after tests pass.
   - Check the new published URL once deployment completes. Existing open tabs/PWA installs may need one hard refresh to load the new hashed bundle.

## Files affected

- `src/integrations/supabase/client.ts`
- `vite.config.ts`
- `.github/workflows/ci.yml`
- One focused test file, following the repository's existing Vitest conventions

## Scope

No database migration, auth-policy change, data reset, or service-worker redesign is required.