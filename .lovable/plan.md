# WhatsApp templates: Admin manages, Team only sends

Today Admin and Team open the exact same WhatsApp screen, including the Templates tab with "Sync" and "Create template". That tab should exist only for Admin. Team keeps the template picker inside a conversation, for the case where the 24-hour window has closed.

## Admin → Messages → WhatsApp

- Keeps the Templates tab: sync with WhatsApp, submit a new template, see approval status, category, language and the message text.
- Two new switches per template:
  - **Active** — off means nobody can send it.
  - **Available to team** — off means only Admin can pick it in a conversation.
- Everything else on the screen stays as it is.

## Team → Messages → WhatsApp

- Templates tab is removed; only the conversation view and the dashboard remain.
- No syncing, no creating, no editing, no provider settings.
- Inside a conversation:
  - Within 24 hours of the contact's last message: normal free-text reply (unchanged).
  - Outside 24 hours: pick from the approved templates Admin marked active and available to team, fill the fields, see the preview, send.
- If no template is available, a short message explains that Admin has not released one yet.

## Safety

The rules are enforced on the server, not just hidden in the interface: creating, syncing and switching templates will be rejected for anyone who is not an Admin, and a send will be rejected if the chosen template is inactive or not released to the team.

## Technical notes

- Migration: add `is_active boolean not null default true` and `available_to_team boolean not null default true` to `public.whatsapp_templates`. Table writes are already service-role only; read policy stays as is.
- `whatsapp-connector` edge function: `sync_templates`, `create_template` and a new `set_template_flags` action require `requireAuth(req, ["admin"])`; `send_message` additionally rejects a template that is inactive, or not `available_to_team` when the caller is a team member.
- `WhatsAppService.ts`: add `setWhatsAppTemplateFlags`, and have `listWhatsAppTemplates` return the two new flags.
- `WhatsAppInboxPage.tsx`: new `canManageTemplates` prop. When false, render the dashboard without the Tabs wrapper (no Templates tab) and drop the create/sync state. The conversation picker filters to `approval_status === "APPROVED" && is_active && (canManageTemplates || available_to_team)`.
- `CaseMessagesInboxPage` (admin) passes `canManageTemplates`; `TeamInboxPage` does not.
- New i18n keys for the two switches and the "no template released" empty state, added to both `en` and `ar`.
