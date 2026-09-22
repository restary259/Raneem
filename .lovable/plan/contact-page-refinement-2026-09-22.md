# Contact page refinement

## Goal
Bring Contact into the same art-directed system as the other public pages, while keeping the existing form and contact methods fully functional.

## What the audit confirmed
- Contact currently uses a custom split opening instead of the shared public-page banner.
- The advisor portrait dominates the opening: about 359 × 449 px on a phone and 446 × 558 px on desktop.
- On mobile, the portrait begins beneath the fixed navigation and the page title does not appear until far below it, weakening the page hierarchy.
- The form, office details, map, social links, WhatsApp, email, consent, and submission behavior are already separate from that opening and can be preserved.

## Changes

### 1. Use the shared Contact banner
- Replace the custom split opening with the same reusable photo banner used by the other internal public pages.
- Use one translated primary title and one short translated supporting sentence over the existing cinematic translucent panel and rainbow lower strip.
- Keep the banner shorter than the homepage and correctly clear of the fixed navigation on phone, tablet, and desktop.
- Add Contact to the shared public banner image configuration rather than creating another one-off banner.

### 2. Make the advisor portrait a small supporting detail
- Keep the existing advisor image, but present it as a compact circular portrait rather than a large arched photograph.
- Place the portrait before the related contact introduction in mobile reading order, without competing with the banner title.
- Pair it with concise translated advisor/support copy and the existing WhatsApp and email actions.

### 3. Refine the Contact content hierarchy
- Keep the enquiry form as the main action and preserve every current field, validation rule, consent control, submission, success/error message, and spam trap.
- Rebalance the desktop layout so the form is prominent and office/contact information is easy to scan beside it.
- On mobile, use a clean sequence: banner → small advisor portrait/support → form → office details → map → social links.
- Reduce heavy card treatment, standardize spacing and corner radii, and improve field/action grouping using the existing DARB colors and controls.
- Keep the AI advisor link as a secondary option, not a competing feature card.

### 4. Language and accessibility cleanup
- Ensure all visible Contact copy has complete, natural English, Arabic, and Hebrew translations; remove fallback-language leakage.
- Preserve RTL/LTR alignment, logical spacing, 44 px tap targets, form labels, error states, image alternative text, and keyboard access.

## Technical details
- Reuse `DarbPageHero` for the opening and keep changes local to Contact wherever possible.
- Preserve the existing Contact route metadata and all contact/business logic.
- Do not modify other public banners, dashboard pages, contact details, or backend behavior.

## Verification
- Check Contact at phone, tablet, and desktop widths in English, Arabic, and Hebrew.
- Confirm the banner clears the navigation, the portrait stays small and circular, titles do not clip, and no horizontal overflow appears.
- Exercise required-field, invalid-contact, consent, sending, success, and error states.
- Verify email, WhatsApp, AI advisor, office, map, and social links remain reachable and correct.
