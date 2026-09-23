# WhatsApp System Audit — DARB

Every claim here was checked against the live database, not only the code. Where I could not prove something, it is marked UNVERIFIED and verifying it is the first task.

## 1. Executive summary

DARB has a real WhatsApp workspace, not a toy. There is a shared staff inbox, a receiving address that works, message history, templates, an internal-notes trail, follow-up scheduling, marketing campaigns with consent filtering, and background workers that run on a five-minute schedule without anyone's browser being open. 418 real messages and 20 real contacts are in the system.

It is not yet an operational CRM channel, for four reasons that are visible in the data today:

1. **No message template has been approved by WhatsApp.** All three are still PENDING. Until one is approved, DARB cannot legally start a conversation with anyone — only reply within 24 hours of the person writing first. Every automation that sends a customer message is therefore dormant, whether or not its code works.
2. **Delivery receipts for messages the app sends are never matched up.** 18 outbound messages are stuck showing "sent" while their "delivered"/"read" receipts sit unmatched in a holding table. Staff see wrong ticks.
3. **Nobody owns anything.** Zero conversations have an assigned advisor, zero contacts have a recorded consent decision, and 18 of 20 contacts have a blank name.
4. **One number only.** The architecture supports exactly one WhatsApp number. A second number (admissions, Germany office, a campaign number) cannot be added without schema and code changes.

## 2. Critical findings

**WA-001 — Delivery receipts for app-sent messages are never applied. CRITICAL / P0. BROKEN.**
Receipts are matched to messages only when a message arrives *inbound*. Messages the app sends are written by a different path, so their receipts are parked and never picked up. Live: 18 rows parked, 16 of which have no matching message at all (they belong to messages sent from the WhatsApp phone app, which are not stored). Impact: staff cannot tell whether a student received anything; a failed message looks identical to a delivered one.

**WA-002 — One bad incoming message blocks the inbox permanently. CRITICAL / P0. BROKEN.**
All events in a delivery are processed in one transaction together with the "already handled" ledger entry. If any single event fails, everything rolls back including the ledger, so the provider retries the same payload forever and it fails identically forever. There is no quarantine and no alert. Ten message kinds are accepted; anything else WhatsApp introduces triggers this.

**WA-003 — No approved template, so DARB cannot initiate. CRITICAL / P0. BLOCKED EXTERNALLY.**
All three templates are PENDING with Meta. Appointment confirmations, reminders, payment notices and every campaign are unsendable until approval. This is a submission/approval task, not a code task, and it gates most of the roadmap.

**WA-004 — Case-event automation has a latent fault. CRITICAL / P0. UNVERIFIED.**
The trigger that turns case events (appointment booked, payment received, application submitted) into WhatsApp messages is installed and its harmless branches run fine. One line inside it looks malformed and, on the reading of it I trust most, would only fail the first time an appointment is actually booked — aborting the booking itself. The last appointment predates the current version, so it has never run. I could not prove this either way without booking a test appointment. **Verifying this is task one of any work.**

## 3. High-priority findings

**WA-005 — Scheduled follow-ups send templates with empty blanks. HIGH / P1. BROKEN.** The fields-to-fill detector in the follow-up dialog uses a corrupted pattern and always finds zero, so staff are never asked for the values and the message goes out with placeholders unfilled.

**WA-006 — Contact names are thrown away. HIGH / P1. BROKEN.** A later change overwrote a careful version of the ingest routine and reintroduced blank names. Live: 18 of 20 contacts have no name. Staff work an inbox of phone numbers.

**WA-007 — Nothing connects WhatsApp to the pipeline. HIGH / P1. MISSING.** No WhatsApp activity moves a case forward, and the WhatsApp contact list keeps its own source field unconnected to the main lead attribution. "Which campaign produced this student?" cannot be answered.

**WA-008 — Single number. HIGH / P1. MISSING.** No number registry, no routing, no per-number templates, campaigns, permissions or analytics.

**WA-009 — Team members cannot claim a conversation. HIGH / P1. PARTIAL.** Assignment works server-side and in the admin view; the team view has no control at all. With zero conversations assigned today, everything is effectively unowned and two people can reply at once.

**WA-010 — Consent is never recorded. HIGH / P1. PARTIAL.** Campaigns correctly filter on granted consent, but no path sets it, so the campaign audience is permanently zero. Opt-out on inbound is handled.

**WA-011 — Failures disappear quietly. HIGH / P1. PARTIAL.** Exhausted jobs are marked failed in a table nobody surfaces; ingest exceptions are not recorded anywhere staff can read. "Why didn't this student get their reminder?" needs a developer.

**WA-012 — The AI draft limit resets constantly. MEDIUM / P2.** The per-user hourly cap lives in memory and is lost on every restart, and is not shared across instances.

**WA-013 — Hebrew is missing on these screens. MEDIUM / P2.** Hebrew is an offered language; no Hebrew text exists for the inbox, so it silently falls back to English.

**WA-014 — The 24-hour rule is written twice. MEDIUM / P3.** Two files define it independently; a future change will land in only one.

**WA-015 — Finished tagging control is wired to nothing. MEDIUM / P3.** The editor exists and the field is supported; it is never displayed.

## 4. What is genuinely solid

Signature checking on the receiving address; duplicate-delivery protection; out-of-order receipt ordering; role gating (admins always, team members only when explicitly enabled per person); the five-minute background workers with vault-held credentials; campaign retry with backoff and duplicate-send protection; appointment reminder scheduling with correct cancel-on-reschedule; notifications and push fan-out; inbox realtime with correct teardown; right-to-left layout; Arabic/English text parity.

## 5. Status by area

| Area | State | Note |
|---|---|---|
| Receiving messages | COMPLETE | verified, live traffic |
| Sending (text, media, templates) | COMPLETE | blocked by approval for new conversations |
| Delivery status | BROKEN | WA-001 |
| Ingest resilience | BROKEN | WA-002 |
| Templates | PARTIAL | none approved; 3 of ~20 useful purposes exist |
| Shared inbox | PARTIAL | no ownership in team view |
| Appointments → WhatsApp | BROKEN/UNVERIFIED | WA-004 |
| Follow-up engine | COMPLETE | idle, no approved template |
| Campaigns | COMPLETE but unusable | audience is zero without consent |
| WhatsApp → CRM | MISSING | |
| Attribution / QR entry points | MISSING | |
| Multiple numbers | MISSING | |
| Observability | PARTIAL | no health view, no failure view |
| Testing | PARTIAL | good unit tests on policy helpers; none on ingest, dedup, receipts, permissions |

## 6. Missing screens

Number registry; WhatsApp health (today's volume, delivery rate, failures, queue depth, token/template state); failed-message and failed-job views; opt-out list; automation configuration; contact/tag management; campaign attribution reporting; per-advisor response-time reporting.

## 7. Proposed roadmap

**Phase 0 — prove the appointment fault (WA-004).** Book a test appointment on a scratch case and read the outcome. Everything else waits on knowing whether booking is currently at risk.

**Phase 1 — stop the data damage.** Fix receipt reconciliation for app-sent messages and backfill the 18 parked rows (WA-001). Isolate each event so one poison message cannot block the inbox, with a quarantine table and a visible failure list (WA-002, WA-011). Restore contact-name capture and backfill from stored payloads where possible (WA-006). Fix the follow-up blanks detector (WA-005).

**Phase 2 — make it operable.** Conversation ownership for team members including self-claim (WA-009). Consent capture with an audit trail (WA-010). Surface the tag editor (WA-015). Single shared 24-hour rule (WA-014).

**Phase 3 — templates.** Submit the full set for approval (appointment confirm/remind/reschedule/cancel, documents missing, payment reminder/received, application updates, enrolment, welcome, re-engagement) and show real approval state.

**Phase 4 — connect to the CRM.** WhatsApp activity updates the pipeline; pipeline changes trigger messages; unify attribution with the main lead source so campaign-to-enrolment can be answered. Campaign-specific entry links and QR codes.

**Phase 5 — multiple numbers.** Number registry, routing, per-number templates/campaigns/permissions/analytics.

**Phase 6 — visibility and hardening.** Health dashboard, durable AI rate limit (WA-012), Hebrew text (WA-013), and a test suite covering duplicate deliveries, receipt ordering, poison events, permission boundaries and timezone handling.

## 8. Recommendation

Approve Phase 0 and Phase 1 now as one piece of work. They are the only items that are actively corrupting what staff see, and none of them depend on Meta. Phases 2–6 should be re-scoped after Phase 0 tells us whether appointment booking is currently at risk.
