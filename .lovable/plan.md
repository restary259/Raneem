# Merge city header and map into one card

On the City Guide page, the "Your city — Heidelberg" photo card and the map below it become a single card:

- Top: the city photo strip with the name, short description (kept compact).
- Directly underneath, inside the same card and with no gap: the interactive map with the pins.
- The "Open map" button is no longer needed (the map is right there), so it is removed on the City Guide page. The preview variant (not currently shown anywhere) keeps its "View all" button.

## Technical details
- `StudentCityGuide.tsx`: for `variant === "full"`, render `CityGuideMap` inside the existing hero `Card` after the hero block (top border only, no rounded corners/extra border on the map wrapper); remove the separate map block and the `mapRef`/scroll button for the full variant. Shrink hero min-height slightly (~160px) on the full page.
- `CityGuideMap.tsx`: allow a `className` prop so the map can drop its own border/radius when embedded.
