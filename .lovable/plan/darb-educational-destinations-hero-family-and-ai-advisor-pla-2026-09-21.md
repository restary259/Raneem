# DARB Educational Destinations, Hero Family, and AI Advisor Plan

## Verified current state

- `/educational-destinations` currently presents ten content sections: setup grids, a comparison table, repeated city/school cards, and a separate TU9 grid. This reads as a directory rather than a destination story.
- The supported language-year set is exactly five cities: Heidelberg, Düsseldorf, Dortmund, Münster, and Berlin. Six named language institutions are mapped to those cities. The TU9 list is a separate Germany-wide university layer and must not be presented as city-specific DARB placement.
- City descriptions and actions already link to official city and institution sources. Current destination media is remote; Wikimedia city files are comparatively stable, while external school-logo hosts need resilient fallbacks.
- The Destinations route currently has no page metadata; the homepage, Services, Contact, and Advisor routes do.
- The homepage hero already has the right photographic foundation, one spectrum strip, black translucent panel, and arch, but its campaign still says “Your Future Without Borders” and its destination shortcut incorrectly opens Educational Programs.
- Shared public heroes use different heights, overlays, arch behavior, spacing, and CTA treatment. Transparent navigation has no current-route indicator.
- The AI Advisor source portrait is square, but its main page frame forces a rectangular `16:11` crop; the empty-chat avatar is already circular.

## 1. Establish one DARB hero family

- Extend the existing shared public hero rather than introduce a competing system.
- Standardize photographic background behavior, strong readable overlay, black translucent content panel, controlled `BrandArch`, one bottom spectrum strip, header clearance, responsive type, and CTA slots.
- Keep page-specific personalities through image, copy, alignment, and compact/standard/tall variants.
- Add route-aware desktop and mobile navigation states with the existing DARB underline treatment.
- Preserve the transparent header before scroll and white sticky header after scroll.

## 2. Rebuild Educational Destinations as an editorial journey

- Replace the ten-section directory with this mobile-first sequence:
  1. Destination hero: **“SAME DREAM. DIFFERENT DESTINATION.”** and “Explore the cities where your path to Germany can begin.”
  2. Short choice framework explaining that city, language route, university direction, and daily life shape the decision.
  3. Five numbered, art-directed city stories with alternating image treatment on desktop and a clean single-column flow on mobile.
  4. A concise language-institution layer grouped under the correct city.
  5. A compact Germany-wide university layer that clearly labels TU9 as exploration, not guaranteed placement.
  6. Provider-boundary disclosure and one decision CTA.
- Each city story will expose only supported facts under consistent labels: Study, Language, University, Life, and Next Step. Missing facts will not be inferred.
- CTAs will lead to the official city/institution source, Major Explorer where relevant, Contact/Advisor for guidance, and Apply for the next step. No fake city detail routes will be added.
- Retain school/university trademark disclaimers and official-source links.

## 3. Make destination media reliable

- Keep only recognizable, city-specific imagery with documented credit/source.
- Preserve aspect ratios with stable responsive frames and deliberate focal positions.
- Add a reusable image fallback that replaces failed images with a branded city-name stage, never a broken-image icon.
- Use the existing resilient identity stage for school and TU9 marks, including text fallback when a remote mark fails.
- Do not invent new schools, cities, costs, university relationships, credentials, or outcomes.

## 4. Align the homepage hero and destination handoff

- Change the bilingual campaign to **“DREAMS WITHOUT BORDERS.”**
- Keep the local Germany photograph, black translucent panel, DARB arch, clear primary/secondary actions, and one spectrum strip.
- Match the shared hero’s contrast, spacing, button hierarchy, and mobile composition.
- Correct the homepage destination shortcut to `/educational-destinations` and make its copy lead naturally into city exploration.

## 5. Correct the AI Advisor portrait

- Replace the main rectangular portrait frame with a responsive square circle using `aspect-square`, `rounded-full`, `overflow-hidden`, and `object-cover`.
- Tune the focal position for the existing portrait so the face stays centered at mobile, tablet, and desktop sizes.
- Remove rectangular image artifacts while preserving every AI, authentication, history, streaming, offline, and contact behavior.

## 6. Bilingual content and metadata

- Add synchronized English and Arabic destination/campaign labels and concise city decision copy.
- Preserve natural RTL reading order and Western numerals where numbers appear.
- Add unique Destinations route metadata: title, description, Open Graph title/description/type, and Twitter card.
- Keep all official names, language levels, exams, and institution names unchanged.

## 7. Verification

- Verify Homepage, Educational Destinations, and AI Advisor at 320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920 px.
- Check Arabic and English, RTL/LTR composition, one visible H1, no horizontal overflow, no broken media artifacts, readable overlays, visible actions, keyboard navigation, touch targets, reduced motion, and transparent-to-sticky header behavior.
- Exercise every internal CTA and sample external source links; confirm the homepage destination link reaches the rebuilt page.
- Run the focused typecheck/build signal and the relevant public-page browser checks without touching backend, submissions, authentication, permissions, or AI behavior.

## Acceptance targets

- A first-time visitor understands within five seconds that DARB helps Arab 48 students compare supported German destinations and plan a language-to-university route.
- All five supported cities are identifiable by image, name, region, concise fit, linked institution context, and a useful next step.
- No content implies guaranteed admission, a DARB-issued credential, an unsupported partnership, or a city-specific TU9 placement.
- No blank/broken media state, clipped portrait, hidden CTA, layout shift from media, or horizontal overflow at any required width.
