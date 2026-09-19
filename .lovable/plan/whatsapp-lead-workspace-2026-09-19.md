# WhatsApp Lead Workspace

## Goal
Add a staff-only WhatsApp operations area for admins and team members without changing public consultancy pages or existing case chat.

## Important connector constraint
- DARB’s native WhatsApp Business connection is now linked and the connected number is active.
- The current React/Vite app can send messages and manage approved templates through the native connector, but this connector cannot deliver incoming-message callbacks to this app type.
- Therefore, the workspace will be production-ready for secure lead management, human-approved outbound replies, templates, assignments, notes, reporting, and AI drafts. It will show an accurate connection/empty state for inbound messages rather than fabricating live conversations.
- No Meta credentials or custom WhatsApp integration will be requested or added.

## What will be built

### 1. Staff-only workspace
- Add **WhatsApp Inbox** to admin and team navigation, protected by existing staff authentication.
- Use a responsive three-area layout: conversation list, active conversation, and lead profile.
- Mobile switches between list, conversation, and profile without horizontal overflow.
- Add search, unread indicator, status filter, owner filter, tags, assignment, conversation state, internal notes, and a clear **Human takeover** control.

### 2. Lead record
Store the requested study-consultancy fields:
- Name, WhatsApp number, country, target country, programme, budget, intended start date, language level.
- Assigned advisor, source, consent status, lead stage, tags, and timestamps.
- Lead stages: new, qualified, consultation booked, documents pending, application in progress, won, lost.
- Conversation states: new, open, waiting, resolved.

### 3. Secure persistence
Create migration-backed tables for:
- WhatsApp contacts/leads.
- Conversations and messages.
- Internal notes and tags.
- Assignment/state audit events.
- Human-approved template mappings.

Security rules:
- Explicit grants plus row-level security on every table.
- Only authenticated admins and team members can read or write data.
- Contact details and message bodies have no public, student, partner, ambassador, or agent access.
- Provider sends occur only in a staff-authenticated backend function.
- Assignment, takeover, stage, status, and send actions are validated and audited server-side.

### 4. Native WhatsApp sending and templates
- Add a backend function that uses only the linked WhatsApp Business connector.
- Allow free-form replies only when the stored customer-service window permits them.
- Outside that window, require an approved WhatsApp template.
- Add the four requested template purposes: inquiry follow-up, consultation confirmation, document reminder, and application update.
- Clearly mark these as required for business-initiated messages.
- Sync native template names, language, category, and approval status; never present pending/rejected templates as sendable.
- Preserve the provider’s exact error status and safe message when a send fails.

### 5. Human control and AI assist
- Human takeover pauses any assisted workflow for that conversation and records who took over.
- AI never sends. It only creates an editable draft or concise lead summary for staff approval.
- Use the required Lovable AI model through a staff-authenticated backend function.
- Guardrails prohibit prices, acceptance promises, timelines, legal/visa advice, payment guidance, and unsupported claims.
- Human requests, price/payment questions, visa/legal questions, or uncertainty produce an advisor-escalation draft instead.
- Add the standard AI message/composer building blocks, customized to DARB’s interface; no generic AI branding.

### 6. Operations dashboard
Add compact metrics for:
- New WhatsApp leads.
- Unassigned conversations.
- Median first-response time.
- Leads grouped by stage.

Metrics will be derived from secured server-side data and use explicit empty/loading/error states.

### 7. Bilingual, accessible interface
- Add English and Arabic together, with Arabic-first RTL behavior.
- Reuse DARB dashboard tokens, controls, spacing, typography, status treatments, and mobile navigation patterns.
- Include keyboard focus states, accessible labels, readable contrast, and non-color status cues.
- Empty state will explain that incoming WhatsApp messages require connector authorization and a supported incoming-message destination.

## Technical details
- Add routes beneath the existing admin/team protected layouts.
- Keep WhatsApp data separate from case/direct chat tables; link to a case later only through an explicit staff action.
- Use realtime database subscriptions for workspace updates that originate inside DARB.
- Add focused unit tests for permission helpers, status/stage transitions, service-window rules, template eligibility, AI escalation rules, and dashboard metrics.
- Run the repository test suite and verify desktop/mobile layouts in the browser.

## Not included
- Custom Meta developer credentials or direct calls to Meta.
- Automatic AI replies or automatic outbound sends.
- Invented imported WhatsApp history.
- Public access to student messages or contact data.
- Changes to the public website or existing consultancy workflows.
