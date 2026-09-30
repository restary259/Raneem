# City Guide cleanup

1. **"View full map" stays in the app** — on the City Guide page, the button no longer opens Google Maps in a new tab; it smoothly scrolls to the in-page map (and resets any selected pin so the whole city is shown).
2. **Remove the city guide from the Next Steps page** — drop the city guide preview block from the student home. Students still reach it via the sidebar "City Guide" link.
3. **Remove the footer sentence** "Place names and directions open in Google Maps…" from the City Guide page (and its translation keys in EN/AR/HE).

## Technical details
- `StudentCityGuide.tsx`: replace the `<a href={mapsSearchUrl(...)} target="_blank">` button with an `onClick` that calls `mapRef.current?.scrollIntoView({behavior:"smooth"})` + `setSelectedId(null)`; wrap `CityGuideMap` in a div with that ref. Delete the `mapsNote` paragraph. Individual place cards keep their Google Maps links for directions.
- `StudentNextStepsPage.tsx`: remove the `StudentCityGuide` import and render (line 195). The preview variant becomes unused but is left in place (tests use it).
- Remove `student.cityGuide.mapsNote` from en/ar/he `dashboard.json` in both locale trees if present; keep locale sync guards green.
