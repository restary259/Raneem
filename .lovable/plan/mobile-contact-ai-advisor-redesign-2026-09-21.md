# Mobile Contact & AI Advisor Redesign

## Goal
Turn `/ai-advisor` into a distinct DARB contact-and-guidance destination, optimized for phones. The mobile bottom navigation will label this destination **Contact**, while the existing desktop `/contact` page remains the standard contact form.

## Experience

### 1. Mobile navigation
- Replace the current **Advisor** bottom-navigation item with **Contact** in Arabic and English.
- Keep it linked to `/ai-advisor`, so it opens the new combined experience rather than the existing `/contact` form.
- Use a contact/message icon and preserve active-state, accessibility, and 44px touch targets.
- Leave desktop header navigation and the normal `/contact` route unchanged.

### 2. Rebuild the advisor page as a contact hub
- Replace the current generic page hero and framed chat layout with a mobile-first, white DARB surface.
- Lead with the existing DARB advisor portrait, a concise human welcome, and clear availability/context copy.
- Present three direct choices near the top:
  - WhatsApp the DARB team
  - Email `info@darb.agency`
  - Ask the AI study advisor
- Keep the human-contact choices visually primary and make the distinction between human support and AI guidance clear.
- Use DARB navy, logo-spectrum accents, consistent pill buttons, semantic colors, and restrained motion.
- On desktop, use a polished two-column composition for this hybrid page without copying the normal Contact page.

### 3. Integrate the AI conversation properly
- Keep the existing authenticated, bilingual AI service and its Germany-study scope unchanged.
- Compose the transcript and composer from the already-installed AI Elements primitives (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, and `Shimmer`) instead of the older custom bubble/composer presentation.
- Assistant responses will sit directly on the page without a colored bubble; user messages will use a deliberate high-contrast DARB token pair.
- Preserve history, quick questions, offline state, clear-history action, streaming, RTL, and the current sign-in-required behavior.
- On mobile, keep the composer reachable above the bottom navigation without covering content or typed text.

### 4. Remove space-taking floating chat controls
- Do not add a separate AI floating chat bubble; the rebuilt advisor page becomes the dedicated AI entry point.
- Convert the global WhatsApp circle into the selected **slim side tab**:
  - attached to the logical screen edge
  - compact text/icon treatment
  - positioned above mobile navigation and safe-area insets
  - hidden on Apply and dashboards as it is today
  - keyboard accessible and non-overlapping in Arabic and English

### 5. Copy, metadata, and accessibility
- Add all new labels and explanatory text to both Arabic and English dictionaries.
- Add unique `/ai-advisor` title, description, Open Graph metadata, and Twitter card metadata.
- Keep one clear page heading, meaningful portrait alt text, visible focus states, reduced-motion support, and correct reading direction.

## Verification
- Test `/ai-advisor` at 390px mobile and 1024/1280/1440px desktop.
- Confirm the bottom item says Contact and opens `/ai-advisor`; desktop Contact still opens `/contact`.
- Confirm WhatsApp and email links use the canonical DARB details.
- Confirm the side tab never overlaps the bottom navigation, composer, cookie notice, or page controls.
- Confirm AI empty, signed-out, loading, streamed response, offline, error, and saved-history states remain usable.
- Confirm Arabic/English layouts, keyboard navigation, reduced motion, no horizontal overflow, route metadata, build, and focused tests.

## Technical scope
- Frontend presentation and route metadata only.
- No changes to the normal Contact form’s submission, inbox delivery, database permissions, authentication gates, or AI backend behavior.
