# Mobile-first hero refinement

## Goal
Make the homepage and all matching photo heroes clearer, more polished, and safely separated from the fixed mobile navigation.

## Changes
- Apply the selected **Refined mobile hero v2** direction to the homepage:
  - stronger editorial hierarchy for the eyebrow, “Same Dream”, “Different Destinations”, and “Germany starts here”
  - tighter, more balanced spacing and line lengths for small screens
  - preserve the current background photo, two action buttons, and campaign wording
- Replace the reassurance sentence with:
  - English: **“Get started with a profile assessment — free of charge”**
  - natural Arabic and Hebrew equivalents
  - remove every “no online payment” version from the homepage hero
- Update both runtime locale sources for English and Arabic, plus the Hebrew locale, so all supported languages stay aligned.
- Standardize the shared dark hero panel at approximately `rgba(0, 0, 0, 0.75)` through the semantic hero token, covering:
  - the custom homepage hero
  - every page using the shared photo-hero component
- Improve the shared page-hero title, subtitle, and action spacing using the same visual direction without forcing homepage-specific campaign typography onto unrelated pages.
- Fix mobile positioning with an explicit header-height offset plus a visible gap, rather than a viewport-only spacing guess. The panel must never begin beneath or touch the fixed navigation.
- Keep desktop/tablet layouts balanced while prioritizing 393px mobile screens.

## Verification
- Check homepage and representative shared heroes in English, Arabic RTL, and Hebrew RTL.
- Test mobile widths around 320px and 393px, plus tablet and desktop.
- Confirm the navigation-to-panel gap, no clipping or horizontal overflow, readable translated text, and a consistent 75% black panel.
- Confirm the project builds successfully and translation parity remains valid.

## Technical details
- Reuse the existing semantic hero color token instead of introducing hardcoded component colors.
- Consolidate shared panel presentation in the global hero styles while retaining separate height/content behavior for homepage and inner-page heroes.
- Preserve existing brand fonts and buttons; the prototype guides composition only and will not introduce unrelated fonts, pagination controls, or new content.
