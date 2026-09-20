# Live WhatsApp chat for team and admin

Make the WhatsApp inbox update by itself for both team members and admins: new messages, delivery ticks, lead edits and internal notes appear instantly for everyone looking at the same conversation, and every row in the conversation list shows the contact's phone number next to the name.

## What changes

### 1. Conversation list shows the number
Each row shows the contact name on the first line and the WhatsApp number (always left-to-right, even in Arabic) under it, with the last message preview and unread badge as today. When there is no name saved, the number stays the headline. Applies to the team inbox, the admin workspace, and the mobile list.

### 2. Everything updates live
Today only new messages and conversation rows refresh by themselves. After this change:
- A new incoming or outgoing message appears in the open chat and bumps the conversation to the top of the list without a refresh.
- Delivery and read ticks update as WhatsApp reports them.
- Lead details a colleague edits (name, stage, program, advisor) refresh in the side panel.
- Internal notes another staff member adds appear in the notes list right away.
- The unread counter clears for the person who opened the chat and stays accurate for everyone else.

### 3. Quiet new-message cue
When a message arrives in a conversation that is not currently open, its row highlights with the unread badge. No sound, no popup.

## Technical notes

- Database change: add `whatsapp_leads` and `whatsapp_internal_notes` to the `supabase_realtime` publication. `whatsapp_conversations` and `whatsapp_messages` are already published. Read access stays governed by the existing admin/team RLS policies, so nothing new is exposed.
- `src/pages/messages/WhatsAppInboxPage.tsx`:
  - Extend the `whatsapp-workspace` channel to also listen for `UPDATE` on `whatsapp_messages` (status ticks) and keep the existing conversation/lead listeners.
  - Extend the per-thread channel (`whatsapp-thread-${selectedId}`) from `INSERT`-only to `event: "*"` on `whatsapp_messages` filtered by `conversation_id`, plus a filtered listener on `whatsapp_internal_notes` that refetches notes.
  - Replace the full `listWhatsAppThreads()` refetch on every event with the same call but debounced (~300 ms) so a burst of inbound rows causes one refresh instead of many.
  - Both channels are created in `useEffect` and torn down with `supabase.removeChannel` on unmount and on thread change — the existing pattern, kept intact.
  - Add the number line to both the desktop thread list and the mobile fallback list rows (`dir="ltr"` on the number).
- No change to sending rules: the 24-hour window, approved-template gating, admin-only template management and draft-only AI all stay exactly as they are.

## Verification

- Open the same conversation as admin in one window and team in another; send a message and confirm both update without refresh.
- Add an internal note as one user and confirm it appears for the other.
- Confirm the phone number renders left-to-right in the Arabic interface.
- Typecheck, i18n parity test and build stay green.
