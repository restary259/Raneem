# Transparent public navigation and universal Contact flow

## Goal
Restore the earlier transparent public navigation style, keep it over the top image, and switch it to a sticky white header only after scrolling. Simplify Contact into a universal enquiry page whose submissions appear in **Admin Inbox → Contact** without creating a student case.

## What will change

### 1. Public navigation
- Make the shared public header transparent and overlaid at the top of each public page.
- Keep the logo and navigation readable over imagery with appropriate contrast.
- After the visitor scrolls, transition the header to a fixed/sticky white background with border/shadow and dark navigation text.
- Preserve all current routes, dropdowns, language switcher, student login, mobile menu, and Arabic RTL behavior.
- Ensure public pages without a large image still reserve suitable top spacing so content is never hidden behind the transparent header.

### 2. Contact banner
- Keep the bright Düsseldorf image already used on Contact.
- Simplify the centered banner content to the single page title: **Contact** / **تواصل معنا**.
- Remove the extra logo and descriptive paragraph from the banner panel.
- Retain the restrained dark translucent title band and colored strip inspired by the supplied reference, without copying its branding.

### 3. Universal contact form
- Replace the education/application-specific questions with a general enquiry form:
  - Full name
  - Email
  - Phone / WhatsApp
  - Enquiry topic
  - Message / question
- Require name, message, consent, and at least one contact method (email or phone).
- Add bilingual field labels, topics, validation, success, duplicate-safe submission, and error messages.
- Keep office details, map, WhatsApp shortcut, social links, consent, spam honeypot, and the clean white two-column presentation.

### 4. Admin Inbox delivery
- Save each successful form submission to the existing `contact_submissions` source with `form_source: contact_form`, `status: new`, and the submitted topic/message/contact details.
- Do **not** create or update a student lead or case from this universal form.
- The existing **Admin Inbox → Contact** tab already reads this source; update its labels/display where needed so topic and full message are clear.
- Tighten the public submission validation around the exact allowed fields and length limits while preserving admin-only read/update/delete access.

## Technical details
- Use shared semantic theme tokens for transparent, scrolled, light, and mobile header states.
- Add one scroll listener with cleanup and reduced visual-motion behavior.
- Validate with Zod before submission and enforce equivalent limits at the database policy/RPC boundary.
- Preserve the existing `contact_submissions` table, status controls, exports, and admin workflow; no new inbox system or duplicate table.
- Update English and Arabic locale files together.

## Verification
- Desktop and mobile: transparent header at page top, white sticky header after scroll, no jump or overlap.
- Arabic RTL and English LTR: navigation, banner, form, validation, and Admin Inbox content.
- Submit representative email-only and phone-only enquiries; confirm each appears once under **Admin Inbox → Contact** with topic and message.
- Confirm no lead/case is created by the Contact form.
- Confirm office/map/social links still work, form failures remain visible, exports include the message, and the build is clean.

## Out of scope
- Dashboard navigation/theme redesign.
- Changes to partnership applications, WhatsApp Inbox, case pipeline, commissions, or permissions beyond the Contact submission boundary.
