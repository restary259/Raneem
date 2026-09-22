# Homepage Identities, WhatsApp Dock, and School Branding

## Goal
Refine the public homepage and existing dashboard school surfaces without changing backend behavior, data permissions, forms, authentication, AI, or verified claims.

## Confirmed audit findings
- The homepage limits the existing nine-entry TU9 dataset to six with an explicit display slice.
- The homepage still renders a six-school identity grid between TU9 and exams.
- Exam identities are currently plain outbound tiles; they do not reveal information in place.
- The CEFR block opens with A1 details already visible and uses a generic language icon.
- The global WhatsApp control is a direct link, not a two-step dock.
- Dashboard school identity is inconsistent: catalog cards treat the first general photo as identity media, admin listings use generic graduation icons, and Partner Schools pages show no logo.
- Existing reusable local school marks cover Alpha Aktiv, GoAcademy!, KAPITO, and Perfekt Deutsch. Partner-school records do not have a dedicated logo field.
- The five city records use remote primary images even though local city fallbacks already exist.

## Implementation

### 1. Remove the homepage school-network block
- Remove only the partner-language-school logo grid from the homepage.
- Keep the internal Partner Schools knowledge base and dashboard school data unchanged.
- Retitle and tighten the surrounding ecosystem copy so the sequence reads naturally as TU9 universities → German exams → CEFR → destination cities.
- Remove unused homepage school imports after the block is removed.

### 2. Make all nine TU9 members visible
- Remove the six-item display limit and render all nine existing verified members in a stable 3×3 desktop grid and responsive mobile grid.
- Keep each card linked to the university’s official website and show its name and city.
- Preserve contained aspect ratios, fixed media stages, loading behavior, visible focus states, and text fallback when an image fails.
- Prefer reliable local assets only where provenance and reuse are confirmed; never fabricate or redraw an institutional emblem.

### 3. Add a shared dashboard school identity component
- Create one `SchoolLogo` presentation component that maps known school names/slugs to the existing local marks for Alpha Aktiv, GoAcademy!, KAPITO, and Perfekt Deutsch.
- Use a stable text-initial fallback for F+U, VICTORIA, and any unmatched school rather than a broken image or invented logo.
- Apply it to the Team Catalog cards, admin school directory/profile header, and Partner Schools country/detail headers.
- Preserve campus/accommodation photos as photography; do not reinterpret the first photo as a logo.
- Keep light/dark dashboard contrast, bounded aspect ratios, and bilingual names intact. No database column or migration will be added.

### 4. Replace exam tiles with accessible flip cards
- Add cards for TestDaF, telc Deutsch C1 Hochschule, Goethe-Zertifikat, DSH, and TestAS. Keep onSET only if its existing verified copy and official destination remain supported.
- Front: verified official mark when licensed for reuse; otherwise a clean typographic identity, exact exam name, and interaction cue. DSH will use text identity because it has no single issuing-body logo.
- Back: concise bilingual description, qualification caveat, official portal link, and explicit back control.
- Support tap, click, Enter, Space, Escape, focus management, safe external links, and only one open card at a time.
- Use a true 180° Y-axis transition on capable devices; replace rotation with an immediate state change under reduced-motion settings.
- Do not claim that any exam guarantees admission; university/program requirements remain authoritative.

### 5. Convert CEFR into an on-demand explorer
- Start collapsed with only the CEFR text identity and A1–C1 selector visible; no level description appears until a level is chosen.
- Replace the generic language icon with a DARB-styled typographic `CEFR` identity. Do not reuse the protected Council of Europe institutional logo without permission.
- Reveal one concise bilingual can-do summary, user group, DARB-role disclaimer, and Council of Europe source link after selection.
- Preserve horizontal mobile scrolling, 44px touch targets, RTL, keyboard tabs, restrained transitions, and reduced motion.

### 6. Build the two-step WhatsApp side dock
- Collapsed: a small icon/tab flush with the logical screen edge, above mobile navigation and safe-area insets.
- First activation: expand an anchored mini-panel with DARB identity, a verification label that identifies the official DARB contact, and a “Chat with DARB” action.
- Second activation through that action: open the canonical DARB WhatsApp URL in a new tab.
- Close on outside pointer interaction, Escape, route change, or meaningful page scroll; return focus to the trigger.
- Preserve the existing exclusions on Apply and every dashboard route. Keep RTL anchoring and ensure the control never covers navigation or form actions.

### 7. Improve the five destination images safely
- Use recognizable compositions for Heidelberg Castle/Old Town, Düsseldorf’s Rhine Tower/riverfront, Dortmund U/skyline, Münster’s Prinzipalmarkt, and Berlin’s Brandenburg Gate/city core.
- Prefer reliable local files with explicit source/credit records; do not hotlink fragile redirects.
- Preserve each city’s official destination link and existing text.
- Use responsive crops with stable dimensions, lazy loading below the fold, and city-specific local fallbacks without broken-image artifacts.

### 8. Bilingual content and accessibility
- Add/update English and Arabic copy together for card cues, back controls, exam summaries/caveats, CEFR collapsed state, WhatsApp panel, and adjusted homepage transitions.
- Keep Western numerals, correct RTL order, logical edge positioning, semantic headings, keyboard support, screen-reader state labels, and external-link safety.

## Technical details
- Frontend presentation/data mapping only; no schema, RLS, permissions, workflow, form, auth, or AI changes.
- Use existing design tokens and Button components; no raw page-level color system.
- Keep one homepage spectrum strip under the hero and retain the approved black translucent hero-panel direction without changing unrelated homepage sections.
- Keep logo and city image boxes dimensionally stable so loading/fallbacks cannot shift the page.

## Validation and expected results
Each item will be reported as `[PASSED]` or `[FAILED]`; failures will include the exact blocker.

- [ ] Homepage language-school network block is absent, with no orphaned heading, spacing, or school-reference copy.
- [ ] All five destination cities remain visible and linked after the homepage flow change.
- [ ] Dashboard surfaces use one consistent school-logo treatment with no broken images or generic icon where a local mark exists.
- [ ] All nine TU9 members render with name, city, official link, stable aspect ratio, and fallback.
- [ ] WhatsApp stays docked at the edge, expands on first activation, opens WhatsApp only from the confirmation action, and dismisses as specified.
- [ ] TestDaF, telc, Goethe-Zertifikat, DSH, and TestAS cards flip/reveal correctly with verified text and official links.
- [ ] No unlicensed, invented, or misleading exam/CEFR emblem is introduced.
- [ ] CEFR starts compact; no level detail appears until selection, and the source/disclaimer remain available.
- [ ] Heidelberg, Düsseldorf, Dortmund, Münster, and Berlin use recognizable, reliable imagery with controlled crops and fallbacks.
- [ ] English and Arabic keys remain in parity; RTL order and logical edge placement are correct.
- [ ] Keyboard, touch, focus, Escape, reduced-motion, and external-link behavior work from 320px through 1920px without horizontal overflow.
- [ ] Type checking and the relevant focused tests pass; the latest preview build reports no new errors.

## Out of scope
- Changes to the Contact form, inbox delivery, application flow, dashboard permissions, student records, database schema, AI backend, auth, RLS, pricing, or school/exam claims.
