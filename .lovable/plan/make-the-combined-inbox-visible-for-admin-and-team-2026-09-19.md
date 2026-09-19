# Make the combined Inbox visible for Admin and Team

## Goal
Provide one obvious inbox destination for each staff role, with WhatsApp available as a tab instead of a separate page.

## Admin
- Keep WhatsApp inside the existing Admin Inbox.
- Keep WhatsApp as the default tab and preserve the other submission tabs.
- Make the Inbox navigation label and WhatsApp tab unmistakable on desktop and mobile.
- Preserve `/admin/inbox?tab=whatsapp`; redirect the old `/admin/whatsapp` address there.

## Team
- Turn the existing Team Messages page into a tabbed Inbox with:
  - **Messages**: current case and direct conversations, unchanged.
  - **WhatsApp**: the existing staff WhatsApp workspace embedded in the same page.
- Persist the selected tab in the URL so `/team/messages?tab=whatsapp` opens WhatsApp directly.
- Remove the separate Team WhatsApp navigation item to avoid duplicate destinations.
- Redirect old `/team/whatsapp` bookmarks to `/team/messages?tab=whatsapp`.

## Mobile and RTL
- Keep the tabs visible and horizontally usable on narrow screens.
- Preserve full-screen mobile conversation behavior inside the Messages tab.
- Verify Arabic labels, right-to-left order, safe-area spacing, and no horizontal overflow.

## Verification
- Test Admin Inbox and Team Inbox in English and Arabic.
- Confirm old WhatsApp links redirect correctly.
- Confirm switching tabs updates the URL and browser navigation correctly.
- Confirm the current WhatsApp lead, filters, profile, notes, templates, and send controls still render.
- Run focused translation and WhatsApp tests, type checks, and confirm the preview build is clean.

## Scope
This is navigation and workspace consolidation only. It will not change message security, lead data, connector behavior, template approval, or sending rules.
