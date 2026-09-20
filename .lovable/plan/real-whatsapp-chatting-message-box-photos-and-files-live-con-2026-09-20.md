# Real WhatsApp chatting: message box, photos and files, live connection

Right now the chat area shows no place to type. That is not a bug in the layout — three things are genuinely missing, and this plan fixes all three.

## What is actually missing

1. **Incoming messages never reach this app.** No message, in or out, has ever been recorded. WhatsApp has nowhere to deliver to, so every conversation stays empty and the app treats the contact as "never wrote to us".
2. **Because nobody wrote to us, WhatsApp only allows a pre-approved template.** That is a WhatsApp rule, not our choice: outside a 24-hour window after the person writes, a business may only send approved templates. No template has been released yet, so the box disappeared entirely and left the empty area you circled.
3. **There is no way to attach a photo or a file at all** — only text was ever built.

## What you will get

**A real inbox that receives.** This app gets its own receiving address for WhatsApp. Once you point the WhatsApp connection at this project (one selection in Connectors → WhatsApp Business → Incoming messages), every message a student sends lands in the conversation within a second or two, with the contact created automatically if they are new. Delivery and read updates arrive the same way.

**A chat box that is always visible.** The typing area never disappears again:
- When the student has written in the last 24 hours: type freely, press send, the message appears immediately.
- Outside that window: the same box is shown but locked, with a short line explaining WhatsApp's rule and the approved-template picker directly underneath. If no template is released yet, it says so and points to the administrator.

**Photos, documents and voice notes.** A paperclip next to the box. Pick an image, PDF, or file; it uploads, previews in the thread, and sends. Incoming photos and files show as thumbnails/downloadable items instead of the current "unsupported" placeholder. Same 24-hour rule applies — WhatsApp does not allow attachments outside it.

**Live everywhere.** Already working for the list and lead panel; the new pieces (incoming messages, attachments, ticks) plug into the same live channel, so admin and team see each other's activity without refreshing.

## What still needs you

After this is built, you must open Connectors → WhatsApp Business → the connection → **Incoming messages**, and select this project. Nothing can receive until that is set, and it will redirect delivery away from any other project currently selected. Chats that happened before that switch cannot be imported — WhatsApp provides no history.

## Technical plan

**Receiver route** — new `src/routes/api/public/whatsapp/webhook.ts` (TanStack server route; the path is a contract with the gateway).
- Verify every delivery with `verifyWebhookRequest` from `@lovable.dev/webhooks-js` using `WHATSAPP_API_KEY` as the secret, `maxBodyBytes: 4 * 1024 * 1024`; 401 on failure.
- Require non-empty `X-Lovable-Delivery` / `X-Lovable-Event`; insert the raw delivery into a `whatsapp_webhook_events` inbox table (unique `delivery_id`, `event`, `payload`, `received_at`, `processed_at`, `processing_error`) via the service-role client loaded inside the handler.
- Then call the ingest RPC; 5xx (never 200) on any storage/processing failure so the gateway retries; duplicate `delivery_id` reuses the row and skips only completed work.

**Ingest RPC** — migration creating `whatsapp_ingest_event(jsonb)`, `SECURITY DEFINER`, `EXECUTE` to `service_role` only. It resolves the contact by normalized phone (creating `whatsapp_leads` + `whatsapp_conversations` when unknown), inserts `whatsapp_messages` idempotently on provider message id, reconciles `statuses[]` by provider id using `whatsapp_status_rank` (never downgrading delivered→sent), parks statuses that arrive before their outbound row in a pending table and replays them, logs unknown event types, and bumps `unread_count` / `last_inbound_at`. It does not touch cases, core leads, consent or advisor assignment. Also add `whatsapp_webhook_events` (admin/team SELECT RLS, service_role full) and grants.

**Attachments** — private storage bucket `whatsapp-media` with staff-only RLS; upload from the composer, then a time-limited signed URL is passed to the gateway. `supabase/functions/whatsapp-connector/index.ts` `send` action accepts `media: { type, url, filename?, caption? }` and posts `type: "image" | "document" | "audio" | "video"` to `/messages`; the outbound row stores `message_type` and `media_url`. Inbound media ids are resolved to stored files by the ingest path and rendered.

**Composer** — in `src/pages/messages/WhatsAppInboxPage.tsx`, replace the current either/or branch so `PromptInput` always renders; when `requiresApprovedTemplate(active.last_inbound_at)` is true the textarea and attach button are `disabled` with the explanation line, and the template picker renders beneath it. Add the attach control (`PromptInputFooter`), an upload-progress state, and image/file bubbles in the message list. Service layer gains `sendWhatsAppMedia(conversationId, file, caption)`.

**i18n** — new keys added to both `en` and `ar` `whatsapp` locale files together (parity guard enforces this).

**Verification** — send a real message to the connected number and confirm it appears in the thread; reply with text and with a photo; confirm ticks update and both admin and team windows update live.
