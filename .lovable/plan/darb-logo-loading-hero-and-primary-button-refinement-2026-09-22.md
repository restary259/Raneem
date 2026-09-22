# DARB logo, loading, hero, and primary-button refinement

## Goal
Apply one focused brand correction across the website and dashboards without changing content, navigation, forms, workflows, or data.

## Changes

1. **Correct the DARB logo artwork**
   - Edit the uploaded logo without redesigning it.
   - Add a small white horizontal pill directly behind the three center dots, so the dots read clearly as white while the surrounding speech bubble remains navy.
   - Preserve the headphones, speech-bubble shape, rainbow ring, transparency, proportions, and original colors.
   - Produce the required transparent logo/icon assets from this corrected master.

2. **Update every active logo placement**
   - Replace the current visual logo in the public header, Apply page, sign-in and activation pages, student onboarding, dashboard/loading surfaces, email branding, structured metadata, social sharing, favicon, Apple touch icon, and installable-app icons.
   - Keep each placement’s existing size and purpose unless the corrected mark needs a small containment adjustment.
   - Ensure transparent artwork remains readable on both photo and white backgrounds.

3. **Use a logo-only full-screen loading state**
   - Replace the dashboard spinner and visible loading words with the centered corrected DARB logo.
   - Replace public and protected route-loading shells with the same clean logo-only presentation.
   - Keep hidden accessibility status text for screen readers, but show no loading words on screen.
   - Preserve smaller in-page loading states where they communicate that a specific table, card, or action is still working.

4. **Make all photographic hero panels lighter**
   - Reduce opacity and blur on the shared hero panel and homepage hero panel so more of each photo remains visible.
   - Keep the panel light, readable, and consistent in Arabic and English; do not return to a dark or navy block.
   - Preserve the transparent navigation-over-photo treatment, DARB arch, and single spectrum strip.

5. **Standardize primary actions in DARB navy**
   - Make the shared primary button use the logo navy consistently across public pages and dashboards.
   - Align primary CTA links that currently duplicate button styling with the same navy treatment.
   - Preserve secondary/outline controls, WhatsApp-specific actions where context requires them, and red destructive actions.
   - Keep existing pill shape, touch size, focus states, disabled states, and contrast.

6. **Validation**
   - Confirm the corrected logo has no dark or transparent artifacts behind the three dots.
   - Check logo-only startup/loading screens on public and protected routes.
   - Check homepage and shared heroes at mobile and desktop sizes for readable text, visible photography, and no overflow.
   - Confirm primary actions are navy while destructive and secondary actions retain their semantic meaning.
   - Run type validation and the normal build check, including the stylesheet that recently caused the blank screen.

## Boundaries
- No copy, routes, submissions, inbox behavior, authentication, permissions, AI behavior, database logic, or business workflows will change.
- Inline content loaders remain informative; only full-page/app loading presentations become logo-only.
- The uploaded logo is the visual source; its identity will not be regenerated or restyled beyond the white pill behind the three dots.
