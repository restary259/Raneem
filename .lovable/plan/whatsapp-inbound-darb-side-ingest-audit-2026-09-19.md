# WhatsApp inbound — DARB-side ingest audit

## Where the boundary actually falls

Your document audits the **receiver project**. Those files are not in this repo
— this is the DARB app itself (classic Vite + React + Supabase Edge Functions,
no `src/routes/`, no server-route capability). It therefore cannot host
`POST /api/public/whatsapp/webhook`; the separate receiver project is the right
home for it, and your split of responsibilities is correct.

So the only work this project owns is **step 2 of your list**: the durable,
idempotent ingest endpoint the receiver forwards to, plus the small schema gaps
that endpoint needs.

## What is already in place here (verified)

- Tables `whatsapp_leads`, `whatsapp_conversations`, `whatsapp_messages`,
  `whatsapp_internal_notes`, `whatsapp_templates`, `whatsapp_events` all exist.
- `whatsapp_leads.whatsapp_number` is unique; `whatsapp_conversations.lead_id`
  is unique (one thread per number); `whatsapp_messages.provider_message_id` is
  unique. Those three constraints are exactly what idempotent upserts need.
- Outbound sending and template management already run through the gateway in
  the `whatsapp-connector` edge function; nothing there needs to change.
- **No ingest function exists.** There is no `whatsapp_ingest_event` (or
  anything like it) in the database today.

## Gaps that block durable ingest

- `whatsapp_messages` has no `delivery_id`, so gateway retries can only be
  deduped by provider message id — a status-only delivery carries no message id
  of its own and would re-apply on every retry.
- `whatsapp_messages.body` is `NOT NULL` with no default, so a media-only
  inbound message has nothing to store.
- There is no place for the media provider id, the reply-parent id, the raw
  provider payload, or a status timestamp — without the last one, an out-of-order
  `sent` callback will overwrite `delivered`/`read`.
- Nothing records a status that arrives **before** its outbound row exists.

## Plan

### 1. Schema additions (one migration, additive only)

- `whatsapp_messages`: add `delivery_id text`, `media_provider_id text`,
  `reply_to_provider_id text`, `status_updated_at timestamptz`,
  `raw_payload jsonb`; relax `body` to allow empty by defaulting it to `''`.
- New `whatsapp_pending_statuses` table (provider message id, status, timestamp,
  raw payload) holding statuses whose message row has not arrived yet, drained
  when the message appears.
- New `whatsapp_deliveries` table keyed on the gateway's `delivery_id`, written
  first inside the ingest transaction — a repeat delivery id short-circuits and
  returns success without re-applying anything.
- Indexes on `whatsapp_messages(delivery_id)` and the pending-status key.
- No RLS change: both new tables stay service-role only, like the rest of the
  WhatsApp set. Staff still read messages through the existing policies.

### 2. `whatsapp_ingest_event` RPC (`SECURITY DEFINER`, service-role execute only)

Takes `{ "events": [...] }` in the receiver's contract shape and, per event:

- **`whatsapp.message`** — resolve or create the lead by normalized E.164 number
  (never touching `leads`/`cases`), ensure its conversation, insert the message
  on conflict of `provider_message_id` do nothing, bump `last_inbound_at`,
  `unread_count` and `last_message_preview`, and drain any pending statuses.
- **`whatsapp.status`** — locate the outbound row by provider message id; apply
  only if the new status ranks higher than the stored one
  (`pending < accepted < sent < delivered < read`, `failed` always wins) and
  `status_updated_at` is not older; if no row exists, park it in
  `whatsapp_pending_statuses`.
- **`whatsapp.message_error`** — record `error_status`/`error_message` on the
  message and log a `whatsapp_events` row.
- **`whatsapp.template_status`** — update `approval_status` on the matching
  `whatsapp_templates` row.
- **`unhandled`** — store the raw payload in `whatsapp_events` and return
  success, so nothing is lost while real event bodies are being confirmed.

Consent, lead/case linking, stage changes and advisor assignment stay untouched
— the RPC never infers them.

Everything runs in one transaction and returns per-event results only after the
writes commit, so the receiver can answer `200` honestly.

### 3. Inbox behaviour that follows for free

Once inbound rows land, the existing inbox already has what it needs: the
24-hour service window is computed from `last_inbound_at`, so free-form replies
unlock automatically on a real inbound message, and the unread counters and
previews start moving. No UI rewrite is planned in this step.

## Blocked on you (cannot be done from code or chat)

1. Add `DARB_SUPABASE_URL` and `DARB_SUPABASE_SERVICE_ROLE_KEY` as secrets in
   the **receiver** project. Note that on Lovable Cloud the service-role key for
   this project is not retrievable by me — you will need it from your own
   Supabase access.
2. In Connectors → WhatsApp Business → *Darb's WhatsApp Business* → **Incoming
   messages**, select the receiver project. This redirects callbacks away from
   whatever is selected now, and only a human can do it.
3. Meta approval of `darb_inquiry_follow_up_ar` is still pending and is
   unrelated to ingest — outbound business-initiated sends stay blocked until
   Meta approves it.

## Verification

- Unit tests for the status-ranking and pending-status drain, exercised through
  the RPC with synthetic contract payloads (no fabricated Meta bodies).
- Replay the same `delivery_id` twice and assert a single message row.
- Deliver a status before its message and assert it reconciles on arrival.
- Full test suite and build.
- Live confirmation only after step 2 above, against the first real delivery.
