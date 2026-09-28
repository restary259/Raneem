# WhatsApp spacing and page scrolling

## Changes

- Remove the unnecessary vertical gap between the WhatsApp inbox heading/tab area and the conversation search field on mobile and desktop.
- Keep the open conversation and conversation list as internally scrolling, full-height surfaces so chat behavior is not changed.
- Make the WhatsApp Dashboard, Delivery Health, Templates, and other non-chat WhatsApp sections vertically scrollable within the dashboard page.
- Preserve the fixed dashboard navigation and mobile bottom bar while ensuring the final content is not hidden beneath them.

## Verification

- Check the admin WhatsApp inbox at mobile and desktop sizes: the search field should sit directly below the inbox controls.
- Check long Dashboard, Delivery Health, and Templates content at mobile and desktop sizes: each page must scroll to its final item.
- Open a conversation and confirm only the message area scrolls, with the chat header and message controls remaining usable.
- Run the focused messaging tests and the TypeScript check.

## Technical scope

- Adjust only the WhatsApp inbox wrapper and its containing Messages tabs layout.
- Use separate overflow behavior for inbox/chat views versus long non-chat views; no messaging, permissions, or data logic changes.
