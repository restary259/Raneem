# WhatsApp pipeline: audit findings and repair plan

## What I checked and found

I traced the chain from WhatsApp to the inbox against the real code, the live database and the live site.

**The live site is down.** Every address on the published app answers with an error page, including the address WhatsApp must deliver to:

```text
https://darb-agency.lovable.app/                          -> 500 error page
https://darb-agency.lovable.app/api/public/whatsapp/webhook -> 500 error page
local app (same code, running here)                        -> 200 "DARB WhatsApp receiver is online"
```

The receiving code itself answers correctly when it runs. So WhatsApp deliveries have had nowhere working to land. This matches the empty tables: 0 deliveries, 0 ingest records, 0 messages (1 lead and 1 conversation exist, created manually earlier).

**The database side is in good shape.** The message-type rule already accepts text, template, system, image, video, audio, document, sticker, location, contacts, reaction, interactive, button and list. The ingest routine is service-role only — signed-in users and visitors cannot call it.

**Two things are still unverified** and can only be confirmed once the site is live: whether this app is the selected destination for incoming WhatsApp messages in Connectors, and whether a real message completes the whole chain.

## Plan

### 1. Get the live site working again (the blocker)
Find why the published app errors on every page: read the deployment error, reproduce it against a production build locally, and fix it. Nothing else in the chain can be proven until this is green.

### 2. Republish and re-test the receiving address
Confirm the live address answers "receiver is online" and that a signed test delivery is accepted, stored and made idempotent (a repeat of the same delivery must not duplicate anything).

### 3. Point WhatsApp at this app
In Connectors, WhatsApp Business, "Incoming messages", this app must be the selected destination. This is a manual selection you make; I will tell you exactly when to do it and verify afterwards that deliveries arrive. Selecting it moves deliveries away from any previously selected destination.

### 4. Prove inbound end to end with a real message
Send a real WhatsApp message to the business number and confirm, with evidence at each step: delivery recorded, ingest recorded, lead reused, conversation updated, message stored as incoming, unread count and last-message preview updated, and the message appearing in the inbox live without a refresh.

### 5. Prove outbound end to end
Reply from the inbox and confirm the reply is accepted, arrives on the phone, and the delivery ticks come back and update the message.

### 6. Add tests and safe logging for what is still untested
Automated tests over the receiving code for: normal text, media, button/list reply, delivery status, repeat delivery, business-sent echo, bad signature, missing signature, broken data, unknown message type, and a database failure returning a retryable error. Structured logs that record delivery id, event type, result and duration, with no phone numbers, message text, or keys.

### 7. Fix whatever the real run exposes
Any gap found in steps 4-6 gets repaired in place, smallest safe change, no rewrite of working parts and no weakening of access rules.

## Technical notes

- Receiver: `src/routes/api/public/whatsapp/webhook.ts` — signature verified against a cloned request before parsing, accepts both connector-normalized and raw Meta payloads, derives a delivery id from header, payload id or content hash, returns 503 unconfigured / 401 bad signature / 500 ingest failure (retryable) / 200 only after a successful ingest call. Echoes are normalized separately from inbound.
- Ingest: `whatsapp_ingest_event(p_payload jsonb)`, SECURITY DEFINER, execute granted only to `postgres` and `service_role` (verified live). Service key is read only inside the server handler via `@/integrations/supabase/client.server`.
- Live check constraint on `whatsapp_messages.message_type` already covers all 14 types (verified live) — the earlier migration is applied, no drift there.
- Remaining audit items (realtime publication vs. subscriptions, per-table access rules, outbound 24-hour/template enforcement, media bucket privacy) are re-verified in steps 4-6 against real traffic rather than by reading code alone.
- Connection in use: Darb's WhatsApp Business, number +49 176 23790623, gateway-backed. No Meta credentials are handled directly.
