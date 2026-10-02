# DARB × Google Business — Secret Rotation

## Where secrets live (and where they must never be)

DARB does **not** store Google OAuth tokens. The Google access/refresh tokens are
held by the **Lovable connector** for
`connector-gateway.lovable.dev/google_business_profile`. The repository holds
only **server-side environment variables** read via `process.env` in
`.functions.ts` / `.server.ts` modules:

| Variable | Purpose | Lives in |
|---|---|---|
| `GOOGLE_BUSINESS_PROFILE_API_KEY` | connector connection key | server env only |
| `LOVABLE_API_KEY` | connector bearer | server env only |
| `SUPABASE_SERVICE_ROLE_KEY` | server RPCs (bypasses RLS) | `src/integrations/supabase/client.server.ts` only |
| `GOOGLE_PUBSUB_AUDIENCE` | expected Pub/Sub push audience | server env only |
| `CRON` dispatch secret | worker tick auth (stored in DB, not env) | `get_cron_dispatch_secret()` |

**Never**: committed, in the browser bundle, in a URL, in `localStorage`, or in
logs. `googleBusinessGateway.ts` (the only file that constructs Google requests)
contains no `process.env` reads and no secret — it is safe to bundle, but keep
it that way: any new env read there would leak into the client bundle.

## Rotation procedure (general)

1. **Create the new credential** while the old one still works.
2. **Stage it** in the target environment's server secrets.
3. **Switch** the dependent service to the new credential; verify one safe read.
4. **Revoke the old credential** only after the new one is proven.
5. **Record**: who rotated it, where, which functions depend on it, how it was
   verified, and the rollback (re-point to the previous value).

## Specific rotations

- **Connector / Google API key.** Rotate in the connector settings and update
  `GOOGLE_BUSINESS_PROFILE_API_KEY` (+ `LOVABLE_API_KEY` if applicable) in the
  server environment. No Google OAuth re-consent is needed if the connector
  keeps its grant; verify with one `gbpGet` health read.
- **Supabase service role key.** Supabase project settings → rotate. Update the
  server env; redeploy backend + worker. The browser never sees it.
- **Cron dispatch secret.** Update the DB value used by
  `get_cron_dispatch_secret()` and the scheduler's header in one change; the
  worker compare is timing-safe, so a brief mismatch only fails ticks (events
  are not lost — Pub/Sub redelivers).
- **Pub/Sub push audience.** Change `GOOGLE_PUBSUB_AUDIENCE` only together with
  the Google subscription's audience; otherwise pushes are rejected (401).

## Zero-downtime Google OAuth client rotation

1. Create the **new OAuth client** in the DARB Google Cloud project.
2. Update the connector to use it; keep the old client valid.
3. Verify a live read + a live write on the pilot office.
4. Revoke the **old** client.
5. Re-verify OAuth **and** Pub/Sub independently (a new OAuth grant does not
   guarantee event delivery).

There is no documented secret value in this file, by design.
