# Finish the WhatsApp repair work

Phase 0 (appointment booking crash) and the data-damage fixes are done. This plan closes the rest of Phase 1 and does Phase 2, so staff can see problems and own conversations. Nothing here depends on Meta.

## Part A — Staff can see what failed (WA-011)

Today, when an incoming message can't be processed or a scheduled message never goes out, it is recorded but nobody sees it. There is no screen.

Add a **Delivery health** tab inside the WhatsApp workspace (admins only):

- **Today at a glance** — messages in, messages out, how many were delivered, how many failed, how many are still queued.
- **Blocked incoming messages** — the quarantined items: when, what kind, the phone number if known, and the error. Each has a "Mark handled" action so the list stays short. Nothing is auto-deleted.
- **Messages that never went out** — scheduled follow-ups and campaign sends that used up their retries, with the reason and the student's name, plus a "Retry" action that puts the job back in the queue.
- Empty state reads "Nothing failed" rather than a blank panel.

Team members with WhatsApp access see a reduced version: only failures on conversations they are assigned to, no retry button.

## Part B — Conversations get an owner (WA-009)

- Add an assign control to the conversation header in the team view (it exists only in the admin view today), plus a one-tap **Claim** for the signed-in staff member.
- Show the owner's name in the conversation list, and add an "Unassigned / Mine / All" filter.
- Assigning is already permission-checked on the server; this only exposes it.

## Part C — Consent can actually be recorded (WA-010)

Campaigns already refuse to send without granted consent, but nothing ever grants it, so every campaign audience is zero.

- Add a consent control on the contact profile panel: Granted / Refused / Not asked, with who set it and when.
- Record an opt-in automatically when a contact writes in through a campaign link, and keep the existing automatic opt-out on "stop".
- Show the consent state as a small badge in the conversation header so nobody messages someone who refused.

## Part D — Two small finishes

- Surface the tag editor that already exists but is never displayed (WA-015).
- Move the 24-hour reply-window rule into one shared place instead of two copies, so a future change can't land in only one (WA-014).

## Arabic, mobile, and permissions

Every new label goes into English and Arabic together. The new tab scrolls sideways on a phone like the existing tabs, and the health lists collapse to stacked cards. Admins see everything; team members see only what they're assigned.

## Technical notes

- New admin-facing read function `get_whatsapp_health()` (SECURITY DEFINER, admin-gated) returning today's counts from `whatsapp_messages`, `whatsapp_ingest_failures`, `whatsapp_follow_up_tasks`, `whatsapp_campaign_recipients`. Team members get a scoped variant limited to their assigned conversations.
- `whatsapp_ingest_failures` already has admin SELECT + UPDATE policies; add a `resolved_at`/`resolved_by` write path through an RPC rather than a direct table update.
- Retry = reset `status`/`attempt_count`/`last_error` on the queue row via an admin-only RPC; the existing five-minute dispatch workers pick it up. No new worker.
- Consent writes go through an RPC that stamps actor and timestamp; the campaign audience query is unchanged.
- New UI lives in `src/components/messages/` and plugs into the existing `WhatsAppInboxPage` tab shell — no new dashboard page.
- Migrations are manual-deploy as always.

## Still out of scope

Template approval with Meta (blocks all outbound initiation), CRM/pipeline linking, multiple numbers, Hebrew text, and the durable AI rate limit. Those are Phases 3–6.
