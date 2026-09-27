# Add a back arrow to the internal chat conversation header (all screen sizes)

## Problem

In the staff Messages inbox (shared by `/admin/messages` and `/team/messages`), opening a conversation hides the path back to the chat list on desktop:

- The conversation header already has a back button, but it is mobile-only (`md:hidden` in `src/pages/messages/CaseMessagesInboxPage.tsx`, ~line 460).
- On desktop there is no back arrow — the conversation stays open in the right column with no one-click way to collapse it and return to the chat list.

Verified: the back button's label key `chat.back` already exists in both English ("Back") and Arabic ("رجوع"), and the icon already flips direction in RTL (ArrowRight in Arabic).

## Change

Single one-line edit in `src/pages/messages/CaseMessagesInboxPage.tsx`:

- Remove `md:hidden` from the back button's className (`"shrink-0 md:hidden"` → `"shrink-0"`), so the back arrow renders in the conversation header on every screen size.
- Behavior stays the same: clicking it calls `setSelected(null)`, which closes the conversation and returns to the chat list (full-width list on desktop, list view on mobile).
- No i18n, RTL, or layout changes needed — the button, label, and RTL icon flip already exist.

## Verification

- Typecheck (`bun x tsgo`) clean.
- i18n parity test still green (no key changes).
- Confirm in the preview: open Admin → Messages → open a chat → the back arrow appears in the header next to the conversation name; clicking it returns to the chat list. (Note: the chat page crashes headless Chromium during automated screenshots — a known flaky issue unrelated to this change — so final visual confirmation is done in the live preview.)
