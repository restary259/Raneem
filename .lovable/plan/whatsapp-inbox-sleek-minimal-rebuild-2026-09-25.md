# WhatsApp inbox — sleek minimal rebuild

Rebuild the WhatsApp inbox screens (admin + team) as a clean, compact, pro-tool workspace using the new DARB branding (navy + signature blue, rainbow accent line). Visual only — every existing behavior (sending, templates, Direct Send, delivery health, pagination, live updates, stage names matching the pipeline) stays working.

## What you will see

**Conversation list (left column)**
- Flat, borderless panel with thin dividers instead of boxed cards
- Compact rows: avatar, name, one-line preview, time, unread counter
- Selected chat highlighted with a subtle blue tint + blue edge bar
- Stage chips become a slim underline-tab strip (pipeline stage names: New, Contacted, Appointment, Profile, Payment, Submitted, Enrolled)
- Search field slimmed to a single quiet line with icon

**Chat area (center)**
- Clean header: name, number, pipeline-stage chip, assignee — one row, no clutter
- Messages: your replies in DARB blue bubbles, customer messages in soft neutral; tighter spacing, small timestamps, delivery ticks kept
- Day dividers reduced to a tiny centered label
- Reply box: single rounded bar pinned above the phone keyboard, template button inside it
- 24-hour window notice becomes a one-line slim banner

**Lead panel (right column, desktop)**
- Same flat style: section labels in small caps, thin dividers, no nested boxes
- Stage dropdown styled with the pipeline stage colors
- Notes, CRM context, identity tools kept — restyled, not removed

**Phone layout**
- Chat opens full-screen with a back button; list and chat never cramp together
- Lead details open in the existing bottom sheet, restyled to match

**Branding**
- DARB signature blue for sent bubbles, selected states, and primary buttons
- Navy for headings; the rainbow accent line appears once, as a thin top strip on the inbox header
- Works in light and dark dashboard themes; English + Arabic (RTL) throughout

## Technical notes

- Main work in `src/pages/messages/WhatsAppInboxPage.tsx` (1,329 lines) — restyle in place, no behavior changes
- Restyle shared pieces: `WhatsAppHealthPanel`, `WhatsAppIdentityPanel`, `WhatsAppCrmContextPanel`, `WhatsAppDirectSendToggle` to match
- Colors only via existing tokens (`--brand`, `--primary`, muted/foreground) — no hardcoded hex in components
- Stage names/colors keep coming from `src/lib/whatsappStages.ts` (already aligned to the pipeline)
- Keep: cursor pagination, realtime merge, optimistic send, Direct Send switch, template dialogs, admin/team access rules
- New/updated text added to en + ar locale files together (parity test guards this)
- Verify with typecheck + vitest; visual check blocked by the admin 2FA gate, so you review the preview after

## Out of scope

- No changes to sending rules, Meta templates, Direct Send logic, or the database
- No message search, second number, or Hebrew (separate backlog items)
