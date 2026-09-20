# DARB public pages and Contact redesign

## Goal
Give every public-facing page the same bright white navigation system shown in the references, and rebuild Contact as a close DARB-branded interpretation of the supplied Contact examples without changing how the form works.

## Public-page design
- Replace the current mixed public navigation treatments with one shared white header across Home, Contact, Services, About, Resources, tools, blog, and legal pages.
- Keep the enlarged DARB logo, language controls, student login, and all existing destinations.
- Style desktop navigation as light rectangular menu blocks with a thin DARB-orange lower border, matching the reference proportions and spacing.
- Keep a compact white mobile header and menu with correct Arabic RTL and English LTR behavior.
- Keep dashboards and authenticated student/staff pages unchanged, including their existing theme controls.
- Update the homepage opening composition to sit naturally below the shared white header while retaining its bright Germany image, DARB text, actions, and remaining homepage sections.

## Contact page
- Generate a bright daytime Germany/Düsseldorf city photograph suitable for a wide banner. It will contain no third-party branding or copied GoAcademy content.
- Build a wide Contact banner using that image, the DARB logo/identity, a restrained translucent title panel, and the same colored lower strip used by the new homepage.
- Recompose the white content area as a desktop two-column layout inspired by the reference: DARB’s existing lead form on one side and the existing Tamra office map/contact details on the other.
- Preserve the current DARB form fields, consent controls, validation, duplicate handling, lead/case submission, success messages, WhatsApp action, office details, map, and social-media links.
- Keep responsive mobile behavior: stacked form/map, readable controls, no horizontal overflow, and comfortable tap targets.

## Contact details and language
- Make `info@darb.agency` the single displayed public support email everywhere, replacing the old Gmail address in public office, services, privacy, terms, accessibility, and dashboard privacy copy.
- Keep Arabic and English copy synchronized; move any remaining hardcoded Contact labels/messages into the existing translation files.
- Keep the canonical WhatsApp number and all existing social links unchanged.

## Technical details
- Reuse the shared public header rather than duplicating navigation on each page.
- Use existing semantic colors and button controls so the white design remains consistent and accessible.
- Keep public pages light-only; do not alter dashboard dark/aurora themes.
- Add unique Contact route metadata for title, description, Open Graph title/description, `og:type`, and Twitter card.

## Verification
- Compare Contact against all three supplied references for banner hierarchy, white navigation, form/map balance, whitespace, and menu proportions.
- Check Home, Contact, representative content/tool/blog/legal pages on desktop and phone in Arabic and English.
- Submit the Contact form through its visible validation states without changing business behavior.
- Verify the email, phone, WhatsApp, map, language switcher, social links, student login, and all navigation destinations.
- Confirm there is no horizontal scrolling, overlapping text, missing imagery, dark public-page styling, or build error.

## Scope boundary
This redesign covers public pages only. Dashboard layouts, permissions, data rules, case/payment workflows, and authenticated navigation will not change.
