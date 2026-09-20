# Team WhatsApp — render only the inbox

## Goal

On the Team dashboard, the WhatsApp tab becomes a clean three-pane inbox — conversations, chat, lead panel — exactly like the sketch. The metrics dashboard, stage board, template management, lead-stage editing, tags, assignment controls and AI panel disappear for team members. Admin keeps everything as it is today.

```text
┌───────────────┬───────────────────────────┬───────────────┐
│ Conversations │ Chat                      │ Lead          │
│ search/unread │ messages + reply box      │ name, phone,  │
│ state filter  │ (24h text / template)     │ city, major,  │
│               │                           │ status, notes │
└───────────────┴───────────────────────────┴───────────────┘
```

## What team members keep

- Both tabs on Messages (Messages / WhatsApp) — unchanged.
- Conversation list: search, unread-only, state filter, unread counters.
- Chat: full history, day dividers, conversation-state dropdown, and the existing reply rules — free text inside 24 hours, admin-approved template picker outside 24 hours.
- Lead panel (right side): read-only name, WhatsApp number, city, desired major, stage badge.
- Internal notes: read existing notes and add new ones.
- The "start new conversation" and connection-status header stay.

## What team members lose (admin unaffected)

- The operational dashboard (new leads, unassigned, response time, leads-by-stage).
- The Templates tab (already admin-only).
- Editing the lead stage, tags, lead fields, and conversation assignment.
- The AI-assist drafting panel.

## Technical notes

- `WhatsAppInboxPage.tsx`: add an `inboxOnly` prop. When set, skip the dashboard/Tabs section and render the three-pane inbox layout; the lead panel renders fields read-only plus the notes list and note composer. All existing data loading, realtime refresh, and the 24-hour/template send logic stay untouched.
- `TeamInboxPage.tsx`: pass `inboxOnly` when the signed-in user is not an admin (team members); admins keep the full workspace.
- Server rules already block non-admin template management and unreleased templates — no backend change needed; this is presentation-only.
- New i18n strings (lead panel labels) added to both English and Arabic locale files.
- Verify: typecheck, unit tests, build, then a Playwright pass on the preview confirming a team member sees only the inbox and an admin still sees the full view.
