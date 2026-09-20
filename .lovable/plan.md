# WhatsApp — final integration check, verification and polish

No rebuild. The existing flow (provider → receiver → database → identity → lead/case → inbox → outbound) stays exactly as it is. This plan verifies it end to end, fixes whatever the checks expose, and finishes the interface work.

## What is already confirmed present

Checked before writing this plan:

- All four named changes are in the current code history: receiver hardening, the production build fix, removal of the duplicate WhatsApp tab from the normal messages inbox, and the mobile WhatsApp layout.
- The setting that broke production loading is gone from the project config.
- No old routing library is installed; the app is fully on the current routing system.
- There is one WhatsApp inbox screen, one receiver endpoint, and one messaging service.

So this is a verification-and-finishing job, not an integration rescue.

## Steps

### 1. Behaviour checks against the real database
Confirm on live data, not mocks: the same incoming event arriving twice produces one message; an outgoing message coming back from the provider is not recorded as a new incoming one; the same phone number written in different formats resolves to one person; a known number attaches to the existing lead or student file instead of creating a second one.

Anything that fails here gets fixed at the server level, since that is where these decisions are made.

### 2. Inbox screen review
Walk the inbox on desktop and phone: conversation list, latest message, time, unread mark, filters, selecting a conversation, sending, delivery marks, notes and the linked-file panel. Check that new messages appear without refreshing, in two windows at once.

### 3. Phone layout
Test at 320, 360, 375, 390, 392 and 414 pixels wide. List first, conversation takes the screen when opened, back returns to the list, nothing overflows sideways, long text, links and phone numbers wrap.

### 4. Arabic and themes
Full pass in Arabic right-to-left and in English, in both light and dark mode. Mixed Arabic/English/number text inside a message must read correctly.

### 5. Sending, empty, loading and error states
Send button locks while sending so one click cannot send twice; clear message when sending fails, written for a person and not a raw technical error; sensible empty and loading screens.

### 6. Access rules
Check who can see conversations and phone numbers by trying to read the data directly as each kind of account: admin, team, manager, agent, partner, ambassador, student. Only admin and team may see WhatsApp conversations.

### 7. Production and the live connection
Run the build, type check, tests and the link check. Then confirm the live site loads, the team messages page loads, and the receiver address answers. Confirm the WhatsApp Business connection is pointed at this app for incoming messages, then send a real message in and a real message out and follow it through to the inbox.

## Technical notes

- Fixes stay in existing files: `src/routes/api/public/whatsapp/webhook.ts`, `src/services/WhatsAppService.ts`, `src/pages/messages/WhatsAppInboxPage.tsx`, `src/lib/phone.ts` and the related components. No new tables, endpoints or inbox screens.
- Database-side corrections go through new migrations only; nothing is edited in place.
- Access checks are done by querying as each role, not by reading policy text.
- Commits are split by area: backend verification fixes, inbox data flow, desktop polish, mobile, Arabic/responsive, tests.

## Known limits

- A real incoming message can only be proven once this app is selected as the incoming-message destination on the WhatsApp Business connection. If it is pointed elsewhere, I will report that rather than build a second endpoint.
- Live checks reflect the published version, so production verification happens after a publish.
- Conversations from before the connection was activated cannot be imported; the provider offers no history.

## Report at the end

Commit check, backend, inbox, interface, access rules, production, and a test table with real pass/fail — plus anything still open, ranked by severity. No result reported as passing unless it actually ran.
