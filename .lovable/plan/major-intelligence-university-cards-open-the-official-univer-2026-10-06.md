# Major Intelligence: university cards open the official university website

## Goal
In Team → Major Intelligence, every university card opens that university's official website, using the 56 links in the uploaded list (DARB_Intel_Universities_Official_Websites.pdf). Today the cards open a programme page or a programme catalogue, and some of those links are deep and break easily.

## What changes for the team
- **Recommended universities** cards: clicking opens the university's homepage (for example TU Berlin opens https://www.tu.berlin/en).
- **Verified programme routes** cards: same, they open the university homepage for that card's university.
- The small line on each card changes from "Official programme page / catalogue" to "Official university website" (Arabic, English, Hebrew).
- Rankings, order, tuition, TU9 badges and wording stay the same. Only the link and that one label change.

## Link source
- The uploaded list (56 universities) is the only source. Each link becomes `https://` + the address in the list, for example `www.uni-heidelberg.de/en` becomes `https://www.uni-heidelberg.de/en`.
- University of Oldenburg is used in the data but isn't in the list. It keeps its current link (https://uol.de/en/study) until you send the official address.

## Technical details
- New `src/data/intel/universityWebsites.ts`: one map from normalized university name to homepage URL (56 entries copied verbatim from the PDF), plus `getUniversityWebsite(name)`.
- `universityRecommendations.ts`: the `U[...].url` value becomes the homepage URL. Each recommendation gets a new `websiteUrl` field. `programUrl` and source citations stay as they are, so the official evidence links still exist.
- `types.ts`: add optional `websiteUrl` to `UniversityRecommendation` and `ProgramIntel`, filled in `majorIntel.ts` from `universityName`. Cards fall back to `programUrl` only when there's no match.
- `MajorCard.tsx`: both card lists use `websiteUrl ?? programUrl`. The label uses a new key `intel.recommendations.openWebsite` in en/ar/he, in both `public/locales` and `src/locales`, with identical keys.
- Tests (`majorIntel.test.ts`): every university shown in Major Intelligence resolves to a homepage from the list, except Oldenburg; every URL is https; no university gets another university's domain. The opt-in live link check also covers the homepage URLs.
- No database, money or permission changes.

## Checks
- Typecheck, the Major Intelligence tests and the locale parity tests.
- Open /team/majors?major=pharmacy in the browser and confirm the cards' links point to the homepages.
