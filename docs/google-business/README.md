# DARB × Google Business — Architecture

The Google Business integration is **centralized**: one Google connection
(`info@darb.agency`) authorizes one Google Business account, and DARB routes
each Google location to exactly one DARB office internally.

```
info@darb.agency
      │
 Google Business account
      │
 ┌────┴─────────────────────────────┐
 │ Business API        Notifications API
 │ (connector gateway) (Pub/Sub push)
 │        │                    │
 │        │             DARB webhook
 │        │                    │
 │        │             event store (raw)
 │        │                    │
 │        │             event router → office
 └────────┴────────────────────┘
      │
 DARB office (Primary / Side / Admin)
```

## The three separated responsibilities

| Layer | What it is | Where |
|---|---|---|
| **Google event** | what Google told DARB | `google_business_events` (Admin-only, raw payload) |
| **DARB notification** | user-facing alert | `notifications` (`google_event_type`, office-scoped RLS) |
| **Audit** | what a human/system did | `google_business_activity` (append-only) |

A failure in one never implies failure in another.

## Single implementations (no duplicates)

- **One** Google HTTP layer: `src/lib/googleBusinessGateway.ts`. Every Google
  call goes through `gbpRequest` to the Lovable connector gateway
  (`connector-gateway.lovable.dev/google_business_profile`). OAuth /
  refresh/access tokens live **in the connector**, never in this repo.
- **One** authorization service: `public.authorize_google_office_action`
  (server) mirrored by `src/lib/googlePermissions.ts` (UI affordances only).
- **One** resource resolver: `public.resolve_google_event_office` — Google
  `location_id` → DARB office. A business **name is never used**.
- **One** sync engine: `processGoogleBusinessSyncJobs` +
  `claim`/`finish_google_business_sync_job`.
- **One** event router: `captureAndRouteGoogleEvent` → `route_google_business_event`.

## The authorization invariant

A user can never reach a Google resource by knowing its ID. Every path proves:

```
authenticated + active + DARB authorized + office authorized
  + Google location authorized + action authorized
```

The office is always derived from the Google location mapping, never trusted
from a request payload.

## Emergency controls (Phase 10)

`google_business_settings` (one global row) and `office_google_settings`
(per office). Enforced at `public.google_business_operation_allowed`, which the
authorizer, the event router and the worker's `claim` all consult:

| Switch | Effect |
|---|---|
| `global_enabled = false` | no live reads, writes, or event routing; **cached reads still work** |
| `read_enabled = false` | serve cache only; no syncs |
| `write_enabled = false` | block Google mutations, keep reads |
| per-office `enabled = false` | isolate one office without touching the rest |

## Reliability

- Pub/Sub push is authenticated (Google OIDC via JWKS,
  `mybusiness-api-pubsub@system.gserviceaccount.com`).
- Webhook is thin: validate → persist → queue → ACK. It never calls Google.
- Events are idempotent on `google_message_id`; a redelivered message never
  duplicates work, and a redelivery of an event persisted-but-not-routed
  re-runs the idempotent route.
- Retry/dead-letter: Pub/Sub handles delivery; the worker retries transient
  Google errors. `recover_stale_google_sync_jobs` reclaims jobs whose worker
  died, so a job can never stay `RUNNING` forever.

See `production-readiness.md`, `runbooks.md` and `secret-rotation.md`.
