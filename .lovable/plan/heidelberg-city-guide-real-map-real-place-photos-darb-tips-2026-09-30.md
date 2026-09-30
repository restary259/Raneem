# Heidelberg City Guide: real map, real place photos, DARB tips

## What the student will see
1. **A live interactive map** at the top of the City Guide page, centred on Heidelberg, with a pin for every place in the guide. Tapping a pin highlights its card, and tapping a card moves the map to its pin. The home page keeps its small preview.
2. **Real Google photos on every card.** Each place shows its actual photo from Google Maps. Right now many cards reuse the same Heidelberg photo. F+U school and housing cards keep DARB's own photos. If Google has no photo for a place, the card falls back to the Heidelberg photo.
3. **Google rating and open-now status**, when Google provides them, shown small under the name.
4. **A "DARB tip" under every place**: one or two short practical lines from the team in Arabic, English and Hebrew. For example: "Kaufland is the cheapest big shop near F+U Campus, and prices drop on Saturdays after 6pm." I'll write a first draft of all the tips and mark them for your team to review. They're my suggestions, not verified facts.
5. The "Open in Google Maps" button stays on every card.

## What you need to do
- Approve the **Google Maps connection** when the card appears in chat. Lovable's managed Google Maps key works; you don't need your own.
- Cost: every photo and place lookup is a paid Google call. To keep this cheap:
  - Only signed-in students can trigger lookups.
  - Results are stored and reused for 7 days, so the guide costs about 16 lookups a week, not one per visit.

## Technical details
- Connect the `google_maps` connector. Place lookups and photos go through the gateway on the server; the map itself uses the browser key.
- New table `city_guide_place_cache` (location_id, place_id, photo_name, rating, open_now, lat, lng, fetched_at). GRANT + RLS: authenticated users can read it; only the server can write to it.
- New server function `getCityGuidePlaces` (behind `requireSupabaseAuth`):
  - Checks the cache first. For missing or older-than-7-days rows, it calls Places `searchText` with a limited field list (`id, location, rating, currentOpeningHours.openNow, photos`) and saves the result.
- New server route `/api/city-guide-photo/$locationId`:
  - Streams the Place Photo (`places/v1/{photo}/media?maxWidthPx=800`) through the gateway, with a long cache header.
  - The key never reaches the browser.
- `StudentCityGuide.tsx`:
  - Adds a `CityGuideMap` component that loads Maps JS asynchronously after the page loads (`loading=async`, a callback, the channel ID, `clickableIcons:false`, and a `google.maps.Marker` pin for each place).
  - Cards use the photo route, with the fallback photo if it fails.
  - Adds the rating and open-now line.
  - Adds a tip block under each card.
- `studentCityGuides.ts`: adds `tipEn / tipAr / tipHe` to each location.
- New locale keys in en, ar and he (`cityGuide.darbTip`, `openNow`, `closed`, `rating`), in both locale folders.
- Tests:
  - Every location has a tip in all three languages.
  - Cache freshness logic.
  - A regression guard confirming the page still has no sideways scrolling on phones.
