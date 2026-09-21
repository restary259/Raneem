# DARB Website Design Direction

## Permanent design target

Build DARB as a credible, modern educational institution—not as a catalogue of disconnected services.

The guiding target is:

> **Institutional clarity inspired by leading language-school / study-abroad ecosystems + modern European editorial design + DARB's bright white/orange identity + a much better mobile-first student journey.**

This is a presentation and hierarchy direction. It does **not** mean replacing the current DARB content wholesale. Preserve the strong existing student journey, student stories, process, transparency, FAQ, final CTA, real partner data, and working conversion flows unless a later brief explicitly changes them.

## 1. Brand and visual language

- Lead with **bright white surfaces**, generous whitespace, crisp borders, deep ink/charcoal typography, and restrained DARB orange as the main accent.
- Use real, high-quality photography where imagery helps communicate Germany, education, students, schools, cities, or arrival.
- Keep the visual system editorial and European: strong typography, clear grids, disciplined spacing, meaningful image crops, and confident but restrained hierarchy.
- Avoid decorative complexity that does not improve comprehension or conversion.
- Do not introduce a competing palette or a generic SaaS/dashboard aesthetic into public-facing DARB pages.
- Preserve RTL correctness for Arabic and Hebrew and LTR correctness for English.

## 2. Institutional clarity

DARB should feel like an educational ecosystem with connected stages, not a list of services.

Organize public-facing offers around the student's pathway:

1. **Explore** — understand Germany, study routes, majors, language requirements, and realistic options.
2. **Prepare** — language learning, exam preparation, academic preparation, documents, and readiness.
3. **Apply** — university/program selection, application preparation, submission, and tracking.
4. **Prepare to arrive** — visa preparation, accommodation, insurance/banking guidance, travel readiness.
5. **Start well** — arrival support, orientation, and early-stage follow-up.

Individual services can still exist, but their relationship to the pathway must be obvious.

## 3. Services-page rule

The services page must not read as an inventory of unrelated capabilities.

When a service is shown, explain:
- where it belongs in the student's journey;
- what student problem it solves;
- what DARB actually does;
- what is handled by the university, embassy/authorities, school, insurer, landlord, or other third party;
- what the student should do next.

Group related services into coherent educational pathways. Avoid giving equal visual weight to every feature simply because it exists.

## 4. Education ecosystem

The public website should make DARB's education offering feel tangible and institution-like.

Where verified data exists, present connected ecosystem elements such as:
- German language courses;
- exam preparation and language exams;
- university / pathway preparation;
- partner schools;
- accommodation options;
- certifications and academic readiness;
- student reviews / stories;
- destination and school identity.

Use the existing verified DARB partner-school and catalog data rather than inventing claims.

External institutions may be used as structural inspiration, but do not copy proprietary layouts, wording, imagery, branding, or content. Translate the useful information architecture into DARB's own brand and student journey.

## 5. Homepage hierarchy

The homepage should prioritize comprehension over feature volume.

A strong hierarchy is:

**Who DARB helps → what pathway DARB provides → why the pathway is credible → what happens next → proof / student stories → transparent scope and expectations → clear CTA.**

The current homepage already contains valuable material. Prefer tightening hierarchy, grouping, sequencing, and presentation over deleting content simply to make the page shorter.

## 6. Mobile-first student journey

Mobile is a primary experience, not a compressed desktop layout.

On small screens:
- keep the primary CTA visible and obvious;
- make navigation simple and thumb-friendly;
- use compact cards and sections that scan quickly;
- preserve RTL/LTR behavior;
- avoid horizontal overflow;
- keep forms focused and progressive;
- repeat the next meaningful action at natural decision points;
- make phone / WhatsApp contact easy to reach without obscuring content;
- respect safe areas and keyboard behavior;
- support reduced motion.

The student's next step should be understandable within seconds on a phone.

## 7. Conversion and trust

Public pages should use one clear primary action per section.

Prefer actions such as:
- Evaluate my profile
- Start my application
- Explore study routes
- Explore language schools
- Talk to DARB

Trust should come from:
- specific process explanations;
- real student stories;
- verified partner / school information;
- transparent scope;
- clear separation between DARB's work and decisions made by official institutions.

Do not promise university admission, visa approval, availability, prices, deadlines, or outcomes that DARB does not control.

## 8. Content hierarchy

Use short, concrete copy.

For each major section:
- one clear idea;
- one strong heading;
- brief supporting explanation;
- useful proof, detail, or visual;
- one logical next action.

Avoid stacking multiple competing headlines, CTAs, badges, statistics, and decorative elements in the same visual area.

## 9. Performance is part of design

Visual quality must not be achieved by shipping unnecessarily heavy assets.

For public pages:
- optimize hero and gallery images for their rendered dimensions;
- prefer modern image formats where supported;
- lazy-load below-the-fold imagery;
- avoid duplicate hidden image downloads;
- do not preload hero assets on routes that do not use them;
- keep critical localization loading focused on the current route;
- preserve route-level code splitting;
- avoid unnecessary third-party font families on the critical path.

The target is a site that feels fast as well as polished, especially on mobile networks.

## 10. Accessibility and semantics

Preserve:
- one meaningful H1 per public page;
- semantic section headings;
- descriptive image alt text;
- keyboard-visible focus;
- sufficient contrast;
- reduced-motion behavior;
- correct language and direction attributes;
- usable form labels and validation.

## 11. Implementation principle

Before adding a new visual pattern, ask:

**Does this make DARB easier to understand as an educational pathway?**

If not, prefer the simpler existing pattern.

Before removing existing content, ask:

**Is this content redundant, or does it provide proof, clarity, or a meaningful student decision?**

Preserve useful content and improve its hierarchy first.

## 12. Reference summary

The permanent design direction is:

**Institutional clarity + modern European editorial design + bright DARB white/orange identity + mobile-first student journey.**

This direction applies across the public website: homepage, services, schools, destinations, majors, resources, about, contact, application entry points, and related public education surfaces. Authenticated dashboards may retain their own operational design system unless a separate brief explicitly changes them.
