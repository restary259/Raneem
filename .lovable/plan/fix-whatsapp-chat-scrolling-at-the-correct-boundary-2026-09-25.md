# Fix WhatsApp chat scrolling at the correct boundary

## Confirmed cause

The live preview shows the message log at **3,849px high** inside a **223px-high clipped wrapper**. The log reports `scrollHeight === clientHeight`, so it has nothing to scroll; its parent hides the overflow instead.

The outer inbox sizing is working. The remaining break is inside the center chat column: the wrapper around the message log is a normal block, while the log relies on `flex-1`. Because that flex sizing has no effect inside a block parent, the log expands to the full message history and gets clipped.

## Change

- Make the center message-area wrapper a vertical flex container with a definite bounded height.
- Keep the message log as the only vertical scroller and preserve `min-h-0`, internal overflow, the fixed header, and the fixed message box.
- Add a defensive full-height constraint to the shared conversation surface only if the wrapper fix alone does not make its live `clientHeight` smaller than `scrollHeight`.
- Do not change sending, pagination, realtime updates, templates, stages, or the `+` actions menu.

## Verification

- Re-check the live selected WhatsApp conversation and confirm the message log itself has `scrollHeight > clientHeight`.
- Programmatically scroll the log upward and confirm `scrollTop` changes.
- Test mouse-wheel scrolling inside the message history while the header and message box stay fixed.
- Confirm the conversation list and lead-details panel keep their own independent scrolling.
- Check the same inbox in Admin and Team views, plus a phone viewport.
- Confirm the preview build remains clean and run the focused WhatsApp tests.
