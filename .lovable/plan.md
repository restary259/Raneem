# WhatsApp inbox: full visual rebuild + pipeline stages

## Goal
Rebuild the WhatsApp inbox as a clean 3-pane workspace (chats | conversation | lead details), like WhatsApp Business Web. Replace the WhatsApp lead stages with the same stages the case pipeline uses. All sending rules, templates, Direct Send and permissions stay as they are.

```text
┌──────────────┬───────────────────────────┬──────────────┐
│ Chats        │ Header: name, stage, 24h  │ Lead         │
│ search       │                           │ stage picker │
│ filter chips │ messages (newest first    │ contact info │
│ rows: avatar │  on open, load older)     │ tags, notes  │
│ name, stage, │                           │ case link    │
│ time, unread │ reply box (text/template) │ follow-ups   │
└──────────────┴───────────────────────────┴──────────────┘
```

## 1. Audit (written first, in the reply)
Short list of what is wrong today: one 1,279-line screen, a metrics block pushing chats down, tabs mixing chat and admin tools, lead details cramped, stages that don't match the pipeline, inconsistent spacing/colors on phones.

## 2. Stages = pipeline
- WhatsApp lead stages become: New, Contacted, Appointment, Profile, Payment, Submitted, Enrolled, Forgotten, Cancelled — same names, colors and Arabic wording as the case pipeline.
- Old stages are removed. All 24 current leads are "New", so nothing changes for them.
- Stage colors come from the shared pipeline color set, not new ones.

## 3. Layout rebuild
- **Chats pane:** search, filter chips (All, Unread, Unassigned, Mine, by stage), compact rows with avatar initials, name or number, last message, time, unread dot, stage chip.
- **Conversation pane:** slim header (name, number, stage, time left in the 24-hour window, assign/state menu), message bubbles with day dividers and delivery ticks, pinned reply box that switches to the template picker outside 24 hours.
- **Lead pane:** stage picker, contact details, tags, consent, notes, follow-ups, linked case. Collapsible on medium screens.
- **Admin tools** (Dashboard, Templates, Message purposes, Delivery health, Direct Send switch) move behind one "Tools" menu at the top instead of sharing the chat screen.
- **Phones:** one pane at a time — chat list → conversation (back arrow) → lead details as a slide-up sheet. Reply box stays above the keyboard.
- **Team members** keep the current reduced view (read-only lead fields, no admin tools), just in the new layout.
- Full English/Arabic support, right-to-left mirrored correctly.

## Out of scope
Meta template approvals, Direct Send permission, second number, Hebrew, search inside all messages.

## Technical details
- Migration: drop the old `whatsapp_leads.lead_stage` CHECK, `UPDATE` existing values (only `new` exists), add a CHECK matching `CaseStatus` values; default stays `new`. Also update any DB function/automation that references old stage names (grep `qualified|consultation_booked|won|lost` in migrations/functions).
- Frontend: WhatsApp stage list derived from `CASE_STATUS_ORDER` + terminal statuses; labels via `CASE_STATUS_LABELS` / `usePipelineStatuses`, colors via `statusColorClasses`. Remove `stage.*` keys from whatsapp locales.
- Split `WhatsAppInboxPage.tsx` into `src/components/messages/whatsapp/` pieces: `ConversationList`, `ChatHeader`, `MessageList`, `Composer`, `LeadPanel`, `ToolsMenu`. Existing data loading, pagination, realtime merge and send logic are moved, not rewritten.
- Semantic design tokens only; no new colors.
- Verify: typecheck, vitest (incl. i18n parity, whatsappMerge), build, Playwright screenshots at desktop + mobile in EN and AR for admin and team.
