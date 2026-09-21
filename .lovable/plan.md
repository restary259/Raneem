# DARB UI/UX Improvement Plan

## Goal
Create one coherent DARB experience across the public website and every signed-in area, with mobile treated as the primary usability constraint. Preserve all current permissions, business rules, data, bilingual behavior, and working workflows.

## Confirmed priorities

### P0 — Make every first screen dependable
- Verify every public route renders meaningful content immediately on desktop and mobile. The current preview audit returned blank first screens for several routes and found missing rendered H1s on the homepage and educational programs page.
- Replace empty public-route loading fallbacks with a lightweight branded page shell so navigation never looks frozen.
- Correct the homepage image preload to match the hero image actually rendered.
- Give every public page one visible H1, a clear first action, and stable reserved media dimensions to prevent layout jumps.

### P1 — Establish one DARB interface system
- Keep public pages light-only; preserve dashboard theme behavior.
- Use DARB Navy for primary actions, white for secondary actions, and the logo spectrum only as a restrained brand accent.
- Remove the spectrum line from the header and keep one logo-matched spectrum strip directly beneath page heroes.
- Change translucent hero text panels from blue to high-contrast black.
- Standardize public buttons through the shared button system: consistent height, pill shape, weight, icon spacing, focus state, disabled state, and minimum 44px touch target.
- Retain semantic destructive, warning, success, and status colors where their meaning matters; do not recolor operational statuses as brand decoration.
- Standardize public headings, section spacing, form fields, filters, cards, image treatment, and empty/loading/error states.
- Remove hardcoded visual colors and one-off button markup from public components; use shared semantic tokens and components.

## Homepage reorganization

### New customer-first order
1. **Hero:** clear study-in-Germany promise, one primary “Start your application” action, one WhatsApp action, black translucent text panel, and the single spectrum strip.
2. **Trust proof:** concise partner-school and TU9 logo rows with reliable fallbacks, followed by the supported language exams.
3. **Choose your route:** degree study, language preparation, or profile guidance, written as decisions a student can understand.
4. **How DARB helps:** the complete service scope, with one selected detail at a time on mobile instead of five tall competing cards.
5. **Your journey:** assessment → documents → travel preparation → study, presented as a scannable progress story.
6. **Destinations and schools:** visual destination discovery linked to relevant program information.
7. **Language and exam preparation:** simplify the current dense two-column tool into progressive disclosure; show the essential choice first and details after selection.
8. **Student confidence:** real student outcomes and support reassurance, avoiding unsupported claims.
9. **What is included and what remains the student’s decision:** transparent scope before pricing expectations.
10. **Fees and payment approach:** concise explanation without invented prices.
11. **Frequently asked questions.**
12. **Final action:** application and WhatsApp, followed by the footer.

### Homepage mobile rules
- Fit the first promise and primary action above the fold without hiding the next section completely.
- Stack actions full-width only where needed; maintain 44–48px controls and safe thumb spacing.
- Replace oversized vertical card runs with swipeable rows, compact accordions, or one-detail-at-a-time selectors where this improves scanning.
- Keep marquee motion smooth, pausable, reduced-motion safe, and horizontally stable at 360–430px and desktop widths.
- Keep headings and descriptions concise enough to avoid tall text walls in Arabic.

## Public website improvements

### Navigation and footer
- Simplify the mobile header: logo, language, and menu remain immediately available; move phone/email into the menu or contact action so the header does not compete for narrow width.
- Preserve transparent navigation over heroes and the white sticky state after scrolling, with readable contrast in both states.
- Rebuild the mobile menu around the student’s questions: Study in Germany, Find your path, Services, Resources, About DARB, Contact, and Student login.
- Add clear current-page states and keep all menu rows comfortably tappable.
- Redesign the footer into a compact branded directory with contact information, main links, social links, legal links, and the DARB identity rather than a centered list of underlined links.

### Shared page structure
- Apply one reusable public-page structure: transparent header, photographic hero, black title panel, single spectrum strip, focused content sections, contact action, and footer.
- Avoid repeating a large hero when the page’s task should begin immediately; calculators, quizzes, sign-in, activation, and application flows should prioritize the task.
- Ensure public pages expose one obvious next step and no competing primary actions.

### Contact, services, programs, destinations, resources, and content pages
- **Contact:** shorten the introduction, place the form before secondary office/map/social information on mobile, group email and phone logically, keep errors beside fields, and show a persistent success confirmation after submission.
- **Services:** lead with the most common student needs, reduce repeated “start now” buttons, separate available services from future/unavailable ones, then show process and scope disclosure.
- **Educational programs:** render a proper H1, make search/filter controls sticky after the hero, show active filters clearly, improve result count/empty-state actions, and use a mobile bottom sheet for major details instead of a cramped modal.
- **Destinations:** convert wide comparison tables into mobile comparison cards while retaining the table on larger screens.
- **Resources and tools:** group tools by task, surface recent progress where genuine, and make calculators/forms single-column on mobile with results placed directly after the triggering action.
- **FAQ/blog/legal/about/locations/partnership/exam pages:** align typography, hero height, section rhythm, source/citation treatment, related actions, and contact CTA placement.
- **Auth/application/invitation/reset flows:** remove decorative distractions, preserve drafts and validation, show progress and recovery clearly, keep the primary action reachable above the mobile keyboard, and never hide errors in toasts alone.

## Dashboard and signed-in mobile UX

### Shared shell
- Keep the existing role-based navigation and permissions, but make all four primary mobile destinations reflect the most frequent tasks for each role.
- Make the “More” sheet grouped and scannable rather than a flat icon grid when a role has many destinations.
- Add safe-area spacing, visible current-state feedback, and unread badges without changing message behavior.
- Replace the text-only sidebar “DARB” mark with the approved compact logo treatment while preserving collapsed mode.
- Standardize page titles/actions with a mobile-safe two-column header pattern; actions collapse into an overflow menu when they cannot fit.

### Dense screens
- Convert wide tables into cards or labeled rows below the tablet breakpoint; do not rely on horizontal scrolling for routine work.
- Prioritize the highest-value action and summary on Admin Pipeline, Students, Submissions, Appointments, Finance, Commission, Partner Schools, Catalog, and WhatsApp Inbox.
- Keep filters in a compact sticky toolbar; show active filters as removable chips; retain search terms and tab state when returning.
- Break very large screens into focused visual sections without changing their data or workflow logic.
- Preserve chat, WhatsApp, appointment, case-stage, payment, commission, and permission behavior exactly.

### Forms and dialogs
- Standardize labels, help text, required markers, inline errors, saved/draft states, destructive confirmations, and success states.
- Use a mobile bottom sheet or full-screen step where a dialog contains long forms, galleries, student details, or multi-step actions.
- Keep the main submit action visible above the keyboard and disable it only with an adjacent reason.
- Preserve Arabic RTL ordering while keeping phone numbers, emails, dates, prices, and identifiers readable left-to-right.

### Loading, empty, and error experience
- Adopt the existing shared loading/empty/error components on every dashboard page.
- Match skeletons to the final layout to avoid jumping.
- Every empty state should explain what it means and offer the next valid action; every recoverable error should offer retry.
- Cache inactive tab content where safe so switching tabs does not feel like restarting the page.

## Accessibility and motion
- Maintain WCAG AA contrast for text and controls.
- Verify keyboard order, visible focus, landmarks, one H1 per page, descriptive button names, and dialog focus return.
- Use 44px minimum interactive targets and avoid controls that depend on hover.
- Respect reduced-motion preferences for marquees, transitions, galleries, and progress effects.
- Test Arabic RTL and English LTR independently rather than assuming mirrored layouts are correct.

## Delivery sequence

### Phase 1 — Foundations and critical rendering
- Fix public first-screen rendering and H1 coverage.
- Build the shared public page shell and finalize tokens, buttons, fields, cards, states, and spectrum usage.
- Remove duplicate spectrum decoration and make hero panels black.

### Phase 2 — Homepage
- Reorder the homepage into the customer-first sequence above.
- Simplify dense interactive sections and optimize the first mobile viewport.
- Verify logo rows, imagery, calls to action, and reduced motion.

### Phase 3 — Public pages
- Migrate navigation, footer, contact, services, study pages, resources, content pages, and task flows to the shared system.
- Preserve every route, submission behavior, and bilingual string source.

### Phase 4 — Dashboard shell and high-frequency pages
- Improve mobile navigation, page headers, filters, cards/tables, states, and dialogs.
- Start with Team work/cases/messages, Student next steps/documents/fees, Admin pipeline/inbox/students, and Partner/Agent overview/earnings.

### Phase 5 — Remaining specialist tools
- Normalize calculators, CV builder, Major Intelligence, Partner Schools, Catalog, commission, analytics, exports, and settings.
- Keep specialist workflows dense where experts need density, but make them readable and touch-safe.

### Phase 6 — Verification and polish
- Test public routes at 360, 390, 402, 768, 1024, 1280, 1440, and 1920px.
- Test each dashboard role on mobile, tablet, and desktop in Arabic and English.
- Verify no horizontal page overflow, clipped dialogs, hidden actions, overlapping fixed elements, broken images, duplicate H1s, or blank route transitions.
- Run keyboard, reduced-motion, color-contrast, form-error, offline/PWA, and slow-network checks.

## Measurable acceptance targets
- Primary mobile action visible within the first viewport on key public and role home pages.
- Every interactive target at least 44×44px unless it is an inline text link.
- No horizontal document overflow at 360px or wider.
- Exactly one visible H1 on every content page.
- No blank route transition longer than 300ms without a meaningful loading shell.
- Stable layouts with no major media-induced shift.
- All critical workflows usable one-handed on mobile and fully by keyboard.
- Arabic and English layouts pass the same route-by-route checklist.

## Scope guardrails
- UI and information architecture only unless a verified UX blocker requires a narrowly scoped technical repair.
- No changes to authentication, roles, RLS, case stages, payment/commission math, referral attribution, WhatsApp receiver logic, or stored data.
- No invented facts, testimonials, prices, guarantees, or contact details.
- Existing deep links, exports, PDFs, drafts, realtime behavior, and form submissions remain functional.
