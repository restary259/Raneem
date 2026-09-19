# One official WhatsApp number + the receiving gateway

Two pieces of work: make **+49 176 23790623** the single official DARB WhatsApp number everywhere, and deliver the separate receiving gateway that hands incoming messages to DARB.

## Part 1 — The official number

1. Open the WhatsApp Business connect card so you authorise the connection for +49 176 23790623. Nothing else in this part can be confirmed until that is done.
2. Read the connected number back from the provider and confirm it matches, rather than trusting the setting.
3. Set +49 176 23790623 as the one business number in the single place the app keeps contact details.
4. Audit every WhatsApp link in the product and point them all at that number:
   - home page hero and the two home page buttons
   - floating WhatsApp button
   - contact page and office locations
   - student overview "contact us"
   - broadcast submission page
   - the support link inside the email footer, which today still points at an old WhatsApp endpoint and is the one link outside the shared contact file
5. The community group link stays exactly as it is, clearly labelled as community, never as support.
6. Confirm afterwards that no other WhatsApp address remains anywhere in the product.

## Part 2 — The receiving gateway (separate project)

The gateway is a TanStack Start project and cannot live inside this app, which is React/Vite. I will write its complete source into your Files as a ready-to-paste folder, and prepare the DARB side so it works the moment you deploy it.

What the gateway does, and nothing more:

- Accepts WhatsApp events on one public endpoint.
- Rejects anything that is not a genuine event from the connector.
- Normalises each event into a single shape: contact number, message, media, delivery status.
- Forwards it to DARB through one service-role entry point.
- Stores nothing itself. DARB stays the only record.
- Answers quickly and lets the connector retry on failure, since repeats are already de-duplicated on the DARB side.
- Redacts message content from its own logs.

DARB side:

- The ingest entry point already exists and already handles duplicate deliveries, out-of-order delivery statuses, statuses arriving before their message, and unknown event types. No change needed there.
- No case, lead, consent or advisor assignment is ever written by incoming messages. Linking a chat to an existing student file stays a staff decision.
- WhatsApp stays admin and team only, in its own tables, separate from case chat.
- Sending keeps the 24-hour rule: free text inside the window, an approved template outside it.
- No automation sends anything until it is explicitly registered.
- Old chats from before this is switched on cannot be pulled in; that stays out of scope.

Steps you complete once, after I hand over the gateway:

1. Create the new project and paste in the source.
2. Add the two DARB access values it needs; I will tell you exactly which and where to get them.
3. In Connectors, WhatsApp Business, Incoming messages, select the gateway project.

## Technical notes

- Canonical number lives in `src/lib/contactConfig.ts`; `supabase/functions/_shared/email-ui/theme.ts` is corrected to import from the same value instead of its own hardcoded link.
- Gateway endpoint: `POST /api/public/whatsapp/webhook`, forwarding to the existing service-role `whatsapp_ingest_event(jsonb)`.
- Gateway secrets: `DARB_SUPABASE_URL`, `DARB_SUPABASE_SERVICE_ROLE_KEY`. They live only in the gateway project, never in this app.
- No Meta Graph credentials, no direct Meta calls, no schema or RLS change in this part.

## Verification

Full test run and build, a check that no stray WhatsApp address remains, and finally a real message sent to the business number appearing in the staff inbox with its contact, timestamp and delivery state.
