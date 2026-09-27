# Tamra office: turn on booking, add phone and map, only show the office chooser when there's more than one office

## What you'll see
- Tamra is the first office on the list (office number 001), with phone 0507368283 and your Google Maps link.
- Booking is on for Tamra, so visitors can pick a date and time on the apply page and on /office-visit.
- On the apply page's "book an appointment" step, the "Choose an office" step shows up **only when there are 2 or more active offices**. With only Tamra, it gets picked for you and the calendar opens straight away. A small "Tamra office" line stays visible so people know where they're going.
- A good-looking office card in the booking step (and in the confirmation) shows the address, a call button for 0507368283, and an "Open in Google Maps" button. The same card goes on the contact page wherever the office is listed.

## Steps
1. **Office data**: set Tamra's office code to `001`, put it first in the order, save the phone `0507368283` and the map link `https://maps.app.goo.gl/TdyRtqBiTX9CY8y39`, and turn booking on.
2. **Booking backend**: add the missing "start a booking" action (`create_public_booking_session`), which the page calls first and doesn't exist live yet. Make office lists come back in display order and include phone and map link. If only one office is available, pick it automatically.
3. **Booking step on the apply page** (`PublicOfficeBooking`): hide the office-chooser step and its step label when there's only 1 office. When there's more than one, show selectable office cards. Add the office card with call and map buttons.
4. **Contact page and office card reuse**: use one shared `OfficeCard` component everywhere, so the address, phone and map look the same.
5. **Admin → Offices**: make sure the phone, map link and office code can be edited there. Move the text that's written straight into the page into the translation files for all three languages.
6. **Check it works**: run the booking tests (and fix the 2 that already fail). Then go through the apply flow in the preview up to "book an appointment". With one office: no chooser, the calendar loads, and a booking goes through. With two test offices: the chooser shows. Then remove the test office.

## Technical details
- Migration: `UPDATE offices SET office_code='001', display_order=0, phone='0507368283', map_url=..., booking_enabled=true WHERE slug='tamra'`. Also add a `create_public_booking_session` SECURITY DEFINER function that only the service role can call, based on `20260927162000_public_direct_booking.sql`, with the office parts removed.
- `publicBooking.functions.ts` offices query: `.order('display_order')`, and select `phone, map_url, office_code`.
- The map is a link, not an embedded map. Short `maps.app.goo.gl` links can't be embedded, and this way it costs nothing to run.
- Phone link: `tel:+972507368283`, shown as `050-736-8283`.
