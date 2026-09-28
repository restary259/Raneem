# F+U Academy Heidelberg — housing prices PDF (DARB branded, Arabic)

A short, simple PDF like your reference file, but cleaner, with DARB branding and correct prices. Saved as a download: `DARB-FU-Heidelberg-Accommodation-2026.pdf`.

## What's in it (~10 pages)

1. Cover — F+U Academy Heidelberg, housing 2026, DARB logo.
2. What every room includes (bed, wardrobe, desk, chair, free Wi-Fi; shared washing machine and dryer) + how the categories A → E differ.
3–9. One page per housing type, using all the photos stored for it in our system (57 photos across 14 options):
   - Category A — shared flats (Concordia, Franz-Marc, Schmitt, Turnerstraße)
   - Category B — Schmitt Kirchheim, single and double
   - Category B+ — private bathroom, shared kitchen
   - Category C — two-room flats Märzgasse, single and double
   - Category D — one-bedroom flats Bergheim
   - Category E — F+U campus Bergheim and Märzgasse old town, single and double
   Each page: photos, distance to school, what's shared vs private, and a small price table by length of stay (1–6 / 7–16 / 17–29 / 30+ weeks).
10. Fees and cancellation — administration fee (€130, €170 from 12 weeks), deposit (€200, €500 from 12 weeks), kitchen utensils, move-in / check-out times, summer price note, and the school's cancellation and refund rules.
11. DARB contact page (phone, WhatsApp, email, website).

## Accuracy

- Prices come from our stored 2026 F+U price list and are shown in **euros (€)** — the reference file shows "$", which is wrong.
- Cancellation rules, fees and move-in times will be checked against F+U's official website and terms before writing. Anything I can't confirm is marked "confirm with the school", never guessed.
- Host families are not in our photo database, so they're left out unless you want a text-only page.

## Style

White background, DARB gold and navy accents, one clear price table per page, Arabic right-to-left with prices and place names in correct order. Every page is checked as an image before delivery (letter shaping, clipped text, photo placement).

## Technical notes

- Source: `accommodations` rows for school "F+U Academy of Languages" (photos + `price_tiers`) plus partner-school policies.
- Built with a Python script in /tmp (ReportLab + Arabic reshaping), output to /mnt/documents. No app code changes.
