# AI Advisor Mobile Layout Refinement

## Goal
Make `/ai-advisor` open cleanly below the fixed navigation, present the AI chat as the first experience, improve mobile chat usability, and place compact Contact-page-style actions after the chat.

## Confirmed findings
- The public header is fixed and occupies about 68px on the tested 402px-wide mobile view.
- The advisor page currently starts at the top of the viewport, so its first card renders underneath that header.
- The standalone portrait/intro card currently sits above the chat.
- The chat composer reaches the fixed mobile navigation area and is partially obscured in the current viewport.
- The normal Contact page uses the same advisor portrait plus WhatsApp and email destinations; the requested bottom treatment is compact actions rather than the full form, offices, or map.

## Implementation

### 1. Clear the fixed navigation
- Add route-local top spacing based on the existing public-header height token so the page begins immediately below the header on mobile and desktop.
- Keep the mount-time scroll reset, with no animated jump.

### 2. Make the AI chat the first content
- Remove the standalone portrait/contact intro card above the chat.
- Move the advisor portrait and identity into the chat’s own header/empty state, following the selected “Direct AI interaction” composition.
- Keep the existing AI title, Germany-study scope, quick questions, clear-history action, offline state, and bilingual RTL behavior.

### 3. Improve the chat workspace
- Replace the oversized nested-card feeling with a cleaner, mobile-first conversation surface.
- Size the transcript from the available viewport so it remains useful without pushing the composer behind navigation.
- Keep assistant messages directly on the chat surface and user messages in the existing high-contrast semantic bubble.
- Tighten the empty state and stack quick questions as comfortable full-width touch targets on mobile.
- Keep the composer inside the chat, visually anchored at its bottom, with a multiline input, centered send control, keyboard-safe spacing, and sufficient clearance above the public bottom navigation.
- Preserve AI Elements, message rendering, loading shimmer, auto-scroll, focus behavior, and all AI logic unchanged.

### 4. Move contact actions below the chat
- Add a compact bottom section styled consistently with the normal Contact page.
- Include WhatsApp, email, and a link to the full Contact page.
- Reuse the canonical contact destinations and existing translated copy; do not duplicate the full contact form, offices, map, or social section.
- Keep the page-specific navy footer removal already requested.

## Technical details
- Frontend presentation only; no AI backend, message history, contact submission, navigation, database, or permission changes.
- Use existing semantic colors, spacing variables, Button components, portrait asset, and AI Elements components.
- Preserve the fixed public bottom navigation and provide safe-area-aware clearance rather than hiding it.
- Keep route metadata unchanged.

## Validation
- Verify at 402×725 and a narrow 320px mobile width that the first content begins below the header.
- Confirm the chat composer and send button remain fully visible above the bottom navigation.
- Confirm quick questions, sending, loading, scrolling, clear history, and offline messaging still work.
- Confirm WhatsApp, email, and Contact links appear only after the chat and open the existing destinations.
- Check Arabic RTL and English LTR, desktop layout, keyboard focus, accessible names, and reduced-motion behavior.
- Confirm type checking and the preview build complete without new errors.

## Out of scope
- The full Contact form, offices, map, AI model/backend, conversation persistence, shared public navigation, and other pages.
