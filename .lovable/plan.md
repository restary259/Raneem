## SEO & AI-Search Plan (Arabic-only, Israeli-Arab audience)

### Context
Diagnostic scan (2026-08-06) result: technical foundations are largely solid — metadata, structured data (EducationalOrganization schema), sitemap, robots.txt, page basics, and AI-crawler rendering all pass. Two amber findings, one low-priority gap, one recently-fixed item awaiting rescan confirmation. Web search for Arabic "study in Germany" queries confirms zero existing Darb presence, and confirms the top-ranking Arabic content is generic pan-Arab (Jordan/Egypt/Gulf-oriented), none addressing the Israeli-citizen-specific visa/recognition process. Real content gap, not a crowded field.

Owner decisions locked in:
- Arabic-only site, deliberately — no Hebrew version. Trust signal for the community, not an oversight.
- Testimonial/gallery content must stay anonymous or aggregate — no fabricated names/photos, ever. Real partial-consent testimonials (first initial + city) are fine once available; until then, use aggregate stats.
- Google Business Profile status: not yet confirmed/set up.

### Technical fixes (low-risk, pending owner approval to execute — not yet approved)
1. Replace generic link text ("Learn More"/"Read More") with descriptive text across `partners/UniversityCard.tsx`, `educational/MajorCard.tsx`, `resources/GuidesReferences.tsx`, `partners/components/UniversityCarousel.tsx`.
2. Fix weak/generic image alt text ("logo", empty) across the same components and `landing/StudentGallery.tsx`.
3. Rework `locales/ar/landing.json` gallery/testimonial copy: replace empty/placeholder names with either (a) aggregate stats ("X students placed since 2025, Y cities") or (b) partial-consent real testimonials (first initial + city + outcome) as they become available. Never fabricate identities.
4. Connect Google Search Console once workspace connector is enabled — needed for sitemap submission and real search-query visibility, does not affect crawling itself.
5. Rescan after (1)-(3) to confirm the previously-fixed social-preview duplication finding actually resolved.

### Local SEO — Google Business Profile
Not yet set up. Needs owner input to create: business name, category (education consultant / study abroad agency), service area (should cover the specific Arab-Israeli communities served, e.g. Nazareth, Sakhnin, Umm al-Fahm, Haifa, Rahat, Jerusalem — confirm actual coverage with owner), phone, Arabic business description. This is external account setup Claude cannot do on the owner's behalf, but can draft the description/category text once owner confirms coverage area.

### Content strategy — cornerstone pages (the real ranking driver)
Target the confirmed gap: Israeli-citizen-specific study-in-Germany content, in Arabic, that generic pan-Arab guides don't cover. Proposed initial pages:
1. Visa process for Israeli passport holders specifically (differs from other Arab-nationality applicants).
2. Whether an Israeli bagrut (תעודת בגרות) is recognized for German university admission, and what supplementary steps are needed.
3. Real cost breakdown in ILS (₪), not just EUR — tuition, living costs, translated/converted for the target audience's actual currency reference point.
4. City-specific guides for where the target community is concentrated (Nazareth / Sakhnin / Umm al-Fahm / Haifa / Rahat / Jerusalem, etc. — confirm actual list with owner) framed around "students from [city] who studied in Germany" once real (even partial/anonymized) testimonials exist.
5. FAQ-structured content answering literal search questions ("هل يمكنني الدراسة في ألمانيا مجاناً وأنا من إسرائيل؟" etc.) — also improves AI-search (AEO) visibility since assistants favor clear direct Q&A structure.

### Backlink / off-site strategy
Arabic-language local news outlets serving the Israeli-Arab community (e.g. Panet, Bokra, Kul al-Arab — verify current relevance/reach with owner before pursuing), community Facebook groups, local organizations. Lower priority than on-site content until cornerstone pages exist to link to.

### Sequencing (nothing executed yet — all pending explicit owner approval per step)
1. Technical fixes (1)-(3) above — small, isolated, low risk.
2. Connect Google Search Console.
3. Draft cornerstone content pages (owner to confirm target cities and any local outlet names before publishing).
4. Google Business Profile — owner sets up account, Claude can draft copy.
5. Backlink outreach — after cornerstone content exists.

No execution without explicit owner approval, step by step.
