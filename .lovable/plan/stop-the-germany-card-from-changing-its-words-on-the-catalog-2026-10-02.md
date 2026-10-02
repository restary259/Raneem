# Stop the Germany card from changing its words on the Catalog page

## What's wrong (confirmed in code)
`src/pages/team/TeamCatalogPage.tsx` builds the country cards from two separate loads that finish at different times:
1. The catalog (schools, courses, housing) loads through `useTeamCatalog`. When it finishes, the cards appear with placeholder content: a globe icon, the raw country name stored on the school ("Germany"), and a generic sentence ("Schools, courses and accommodation available in this country.").
2. The country details (flag, Arabic name, real description) load afterwards through `usePartnerCountries`. When they arrive, the same card swaps to the flag, "ألمانيا" and the real description.

The jump between those two states is the flash you see.

## Fix
- Keep showing the existing loading placeholder for the country cards until **both** loads have finished. The card then appears once, with its final flag, name and description.
- If the country details fail to load, still show the cards with the current fallback text, so the page never gets stuck loading.
- No changes to data, wording or layout.

## Technical details
- Read `loading` from `usePartnerCountries()` and treat the country-selection step as loading while `catalogLoading || partnerCountriesLoading`.
- Render the existing loading UI for that step. The schools grid and school detail are unaffected.

## Verification
- Use Playwright on /team/catalog in Arabic and English, with screenshots right after the page loads and again after it settles. The card text must be identical in both.
- Typecheck clean.
