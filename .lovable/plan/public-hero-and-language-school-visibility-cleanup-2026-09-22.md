# Public hero and language-school visibility cleanup

## Goal
Keep calls to action only in the homepage hero, eliminate clipped internal heroes, temporarily remove public language-school partnership signals until contracts are signed, and make advisor photos appear before related contact details.

## Confirmed audit findings
- The Destinations hero is shorter than its content at phone, tablet, and desktop sizes. Its content height exceeds the fixed hero height, so the bottom is clipped; the two stacked hero buttons are the main extra height.
- Only two internal heroes still contain buttons: **Destinations** has two and **Partnership** has one. Other shared internal heroes already use title and supporting copy only.
- Named schools, logos, links, credentials, and city-to-school mappings are publicly rendered on **Educational Destinations**. The public cost calculator also exposes named schools and school-specific pricing.
- Homepage copy includes a “language-school network” label, while an unused partner marquee still contains school names.
- On the Contact page and reusable contact section, contact text currently precedes the advisor photo on mobile. The AI Advisor header already leads with the photo.

## Changes

### 1. Audit and fix the Destinations hero
- Remove both buttons from the Destinations hero so its title and supporting copy fit without clipping.
- Recheck its height, header clearance, text wrapping, and bottom edge at mobile, tablet, and desktop sizes in EN, AR, and HE.
- If any overflow remains after button removal, adjust only the Destinations hero sizing; do not change other shared heroes unnecessarily.
- Keep homepage hero actions unchanged.

### 2. Temporarily hide language-school contract signals on public pages
- On **Educational Destinations**, keep the city and university guidance but remove:
  - named school lists inside city cards;
  - the public school-logo/network section;
  - school-specific links, credentials, awards, and partnership-style wording.
- Rewrite affected EN, AR, and HE public copy to neutral wording about German-language preparation and city research, without saying DARB has a language-school network or supported school routes.
- On the homepage, remove or neutralize the “language-school network” wording while keeping general German-language and exam guidance.
- Temporarily remove the named-school cost calculator from the public Resources listing and prevent its direct public page from exposing school names and prices. Keep the underlying data intact for later restoration.
- Remove named schools from the unused public partner-marquee source as a safeguard.
- Leave authenticated team/admin/student school tools and their data unchanged.
- Leave required legal disclosures and neutral educational articles unchanged; they describe service categories or learning advice rather than claiming a signed partnership.

### 3. Put the advisor photo first wherever contact details accompany it
- Reorder the Contact page introduction so the advisor photo appears first on mobile, then the heading and contact actions; retain a balanced side-by-side desktop layout.
- Reorder the reusable contact section the same way wherever its photo is shown.
- Keep compact variants without a photo unchanged.
- Keep the AI Advisor chat header unchanged because its portrait already precedes its contact identity.

### 4. Translation and regression checks
- Update matching English, Arabic, and Hebrew public translations together, including duplicated runtime locale copies where they exist.
- Add a focused guard that prevents named language-school brands and “language-school network” claims from returning to public marketing surfaces while the temporary restriction is active.
- Verify homepage, Destinations, Partnership, Contact, Resources, and direct calculator access at mobile, tablet, and desktop widths in EN/AR/HE.
- Confirm no horizontal overflow, no clipped hero content, correct RTL order, photo-first mobile contact sections, homepage buttons intact, and internal school tools unaffected.

## Out of scope
- No changes to authenticated partner-school knowledge, catalog, onboarding, student records, or backend data.
- No brand redesign, new imagery, or changes to the homepage hero composition beyond the school-related wording audit.
