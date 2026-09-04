# Darb public homepage redesign

## Goal
Rebuild only the public homepage into a premium, mobile-first admissions journey for Instagram visitors, while preserving every existing route, form, dashboard, and business workflow.

## Visual direction
- Use the selected **Premium Academic** direction with the locked **Darb Editorial** palette: ink `#0F172A`, white `#FFFFFF`, Darb orange `#F97316`, and travel green `#168A68`.
- Adapt the selected compact academic composition into a full-width **Editorial Journey**: large real photography, expressive editorial headings, clear body copy, restrained 4–8px corners, generous whitespace, and alternating image/text chapters.
- Use Instrument Serif/Work Sans for English and compatible Arabic editorial/sans fallbacks so Arabic remains polished and highly readable.
- Keep the public site light-only. Use ink as a strong framing color rather than turning the homepage into a dark dashboard.

## Page structure
1. **Sticky navigation** — preserve the existing navigation, language switcher, student login, and mobile menu; refine the homepage presentation without changing destinations.
2. **First-screen offer** — state plainly that Darb guides Arab students through studying in Germany; pair it with the existing real hero image, Apply and WhatsApp actions, and visible verified proof.
3. **Trust strip** — show only substantiated figures: **16+ students** and **6+ educational partners**, plus transparent, personal Arabic-language guidance. Remove the unsupported 98% success claim and the university-name marquee.
4. **What Darb does** — concise visual summary covering academic assessment, applications, visa-file preparation, accommodation support, and post-arrival guidance.
5. **Real student proof** — elevate existing student photos into an editorial photo story with accessible captions, efficient loading, and a strong mobile swipe experience.
6. **How the journey works** — rebuild the four existing stages as a clear route from assessment to arrival, with a CTA at the natural decision point.
7. **What is included** — explain Darb’s support and distinguish it from decisions made by universities, embassies, insurers, and accommodation providers.
8. **Pricing clarity** — explain that fees are confirmed after the student’s needs are assessed, a written breakdown is provided, and no payment is processed on the website. Do not invent a price.
9. **Parent confidence** — focus on personal follow-up, document clarity, Arabic support, and visibility into each stage without making guarantees.
10. **FAQ preview and final action** — answer the highest-friction questions briefly, link to the full FAQ, and finish with strong Apply and WhatsApp choices.
11. **Mobile sticky actions** — show compact Apply and WhatsApp actions after the visitor leaves the first screen, without covering page content or device safe areas.

## Content and conversion rules
- All visible copy will be supplied through the existing Arabic/English translation system; Arabic remains the default RTL experience.
- CTAs will use the existing `/apply` route and the verified WhatsApp number `+972 50-7368283`.
- No embedded form, fabricated testimonial, invented office claim, unsupported result guarantee, fake urgency, or unverified partner logo/name will be added.
- Repeat actions at meaningful points, but keep one clear primary action per section.

## Technical details
- Refactor the homepage into focused homepage-only sections and reuse the existing shared Button, header, footer, SEO, direction, and translation patterns.
- Add homepage semantic design tokens in the global design system; avoid raw colors in page components.
- Keep a single H1, semantic section headings, useful image alt text, keyboard-visible focus states, and reduced-motion behavior.
- Update the static Arabic site metadata and homepage SEO copy to match the clearer Germany-study offer while preserving canonical and social tags on the Darb domain.
- Preserve image performance: preload only the first-screen image, lazy-load later photos, set stable aspect ratios, and avoid autoplay media.

## Verification
- Check the homepage at mobile and desktop widths in Arabic RTL and English LTR.
- Verify Apply, WhatsApp, language switching, navigation, student login, FAQ, and footer links.
- Confirm no horizontal overflow, overlapping sticky actions, clipped Arabic text, duplicate H1, unsupported claims, console errors, or failed image requests.
- Confirm the project build completes and the latest preview build reports no errors.

## Scope boundary
No changes to `/apply`, authentication, dashboards, database/backend behavior, catalog, finance, commissions, or any other public page beyond shared header/footer styling needed for the homepage presentation.
