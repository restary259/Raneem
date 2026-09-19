# One messaging system for staff

## What's wrong now

The screen in your photo is the case-conversations page. WhatsApp lives on a different page (Inbox), which sits hidden under "More" on mobile. Two destinations, so WhatsApp looks missing.

## The fix

Make the messaging page you already open the single place for every conversation, with tabs across the top:

- **Case conversations** — exactly what you see today, unchanged (search, filters, direct chats, notification settings, new conversation).
- **WhatsApp** — the full WhatsApp workspace: conversation list, student profile, notes, templates, AI drafts, and the receiving-status line.

The Inbox page keeps the application and request tabs (applications, partnership, contact, partner recruits, data requests) but loses its WhatsApp tab, so WhatsApp exists in exactly one place.

Same treatment on the team side: the team messaging page already has Messages / WhatsApp tabs, so it stays consistent.

## Navigation and links

- The main mobile tab and the sidebar item both keep pointing at the messaging page — now it holds everything.
- Old WhatsApp links (`/admin/whatsapp`, `/admin/inbox?tab=whatsapp`) redirect to the messaging page's WhatsApp tab.
- The chosen tab is remembered in the address, so refreshing or sharing a link reopens the same tab.

## Mobile and Arabic

- Tabs stay readable and side-scrollable on a narrow phone, no overflow.
- Opening a conversation still goes full-screen on mobile.
- Arabic labels and right-to-left order checked for both tabs.

## Technical notes

- `CaseMessagesInboxPage` becomes a tabbed shell: existing body moves under a `messages` tab; `WhatsAppInboxPage embedded` renders under a `whatsapp` tab. Tab state syncs to the `?tab=` query param, same pattern as `AdminInboxPage`.
- Remove `whatsapp` from `INBOX_TABS` in `AdminInboxPage` and reset its default tab to `all`.
- Route redirects updated in `App.tsx`; no database, RLS, connector, or template changes.
- Verify with typecheck, the translation parity test, and the build log.

## Still outside this change

Incoming WhatsApp messages only start arriving once the receiving project is selected under Connectors, and chats from before that switch can't be imported.
