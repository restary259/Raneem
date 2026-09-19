# WhatsApp channel: lock in the rules, close the real gaps

Your 15 rules match how the WhatsApp channel was already built. I checked the live setup
before writing this, so below separates what is already true from the few things that are
genuinely missing.

## Already true (verified, no work needed)

- The DARB app is untouched React/Vite; incoming messages arrive through the separate
  receiver project and a service-role-only ingest entry point. No migration of DARB.
- WhatsApp data lives in its own tables (`whatsapp_leads`, `whatsapp_conversations`,
  `whatsapp_messages`, notes, templates, events). Nothing writes into case chat.
- Every WhatsApp table is readable only by admin and team members. Students, partners,
  ambassadors and agents have no access at all.
- Sending goes through one server-side function that enforces the 24-hour window: free
  text inside it, an approved template outside it. The inbox composer reflects that.
- Incoming messages and delivery updates are de-duplicated by provider message id and by
  delivery id, so repeats never create a second message.
- Outbound messages record the sender, timestamp, conversation and delivery state.
- Ingest never touches leads, cases, consent, advisor assignment or case status.

## The real gaps

### 1. Identity: a WhatsApp contact is not yet linked to the person in DARB

A WhatsApp contact today is an island — there is no field connecting it to an existing
lead, case or student. So Sara on WhatsApp and Sara who filled the apply form look like
two different people to staff.

Fix, without creating anything automatically:

- Add optional links from a WhatsApp contact to an existing lead, case and student
  profile. Empty by default.
- On a new inbound contact, match by normalised phone against existing leads, cases and
  profiles and record the match as a **suggestion** only.
- The conversation panel shows "This looks like <name> — existing case <ref>" with a
  staff button to confirm or dismiss the link. Only a staff confirmation writes the link.
- No case is ever created from WhatsApp. Creating a case stays in the normal DARB flow.
- Once linked, log one case event ("WhatsApp conversation linked") so the case timeline
  records it without copying the transcript.

### 2. One canonical business number

Three different WhatsApp destinations are used across the site today: a support link, a
direct number link, and the community group link. Decision needed from you (see question
below), then every public touchpoint — hero, floating button, contact page, office
locations, student overview, broadcast page, email footer — points at the one business
number, with the community group kept separate and clearly labelled as community.

### 3. One notification event, not four

An inbound WhatsApp message currently updates the inbox live but is not part of the
normal notification system. It will be wired as a single event feeding the existing
notification preferences (in-app badge, push, email) instead of adding a parallel alerting
path. Staff-only, assigned/admin recipients.

### 4. Consent stays split

WhatsApp keeps its own service-versus-marketing distinction rather than a single
"whatsapp = true" flag. Marketing templates are blocked for contacts without marketing
consent; service messages are unaffected.

### 5. Automations stay off until explicitly registered

No database event triggers a WhatsApp message. When you want one, it gets an explicit
entry: event, condition, template, delay, audience, on/off. Nothing fires before that.

### 6. Historical import stays deferred

Old chats are not imported. Once identity matching above is working and you want it, we
revisit it as its own piece of work.

## Technical notes

- New nullable columns on `whatsapp_leads` for the linked lead, case and profile, plus a
  staff-confirmed flag; suggestions computed at read time, never persisted as a link.
- Phone matching reuses the existing normalisation helper so it agrees with the apply-form
  duplicate rules.
- Linking is done through a server-side function gated to admin and team members, so RLS
  and existing case-event logging are not bypassed.
- Contact links centralised in `src/lib/contactConfig.ts`; no page keeps its own URL.
- No change to case status logic, case chat, the connector, templates or ingest.

## Verification

Full test suite and build, plus a staff walkthrough: an inbound contact whose phone
matches an existing case shows the suggestion, linking writes the case event, and no
duplicate lead or case appears anywhere.
