# Remove "Israel" from the office address + load verified German contacts

## 1. Office address ("مكتبنا الرئيسي")

The visible address text (`officeLocations.address`) is already "طمرة مول، طمرة 3081100" / "Tamra Mall, Tamra 3081100" — no country word. The word "Israel" only remains in the embedded map query in `src/components/landing/Map.tsx` (`"Tamra Mall, Tamra, 3081100, Israel"`). That gets changed to a country-free query (`Tamra Mall, Tamra 3081100`), and the map is re-checked so it still centres on the right place.

## 2. Verified contacts loaded into Important Contacts

The 14 rows from your audited table are inserted into the existing `important_contacts` table used by the admin Settings > Important Contacts tab and the student Contacts page:

- Germany-wide emergency: Police 110, Fire & Ambulance 112, Medical on-call 116117, Government services 115 (phone only, no email, no address)
- Language schools: Alpha Aktiv, F+U Academy, GoAcademy, KAPITO
- City services: Heidelberg Bürgeramt + Immigration, Düsseldorf Bürgerbüro + Immigration, Münster Bürgerbüro Mitte + Immigration

Each row gets Arabic and English name and role, phone, address, official website, and email only where email is an appropriate channel. Düsseldorf Immigration is stored **without** an email button (online service only) and Düsseldorf Bürgerbüro is stored as "multiple locations — appointment required" instead of a single street address, exactly as you flagged.

## 3. Schema additions

`important_contacts` today has: name_ar/en, role_ar/en, phone, email, link, category, display_order, is_active. It is missing everything else you asked for, so a migration adds:

- `address_ar`, `address_en` (text)
- `city` (text, e.g. Heidelberg / Düsseldorf / Münster / Germany-wide)
- `source_url` (text — the official page each detail was taken from)
- `last_verified_at` (timestamptz — set to today for these rows)
- `country` (text, default 'DE')

New categories used: `emergency`, `language_school`, `city_office`, `immigration` (added alongside the existing support/team/embassy/other).

## 4. Contact card buttons become channel-aware

Both the admin list and the student Contacts page currently render Call / Email / Visit whenever the field exists. They will render, per contact:

- 📞 Call — when phone exists
- 🌐 Official website / online service — when link exists
- ✉️ Email — only when an email is stored (so authorities that don't accept email simply have none)
- 📍 Directions — Google Maps link built from the stored address, when an address exists

Cards also show the city, the address, and a small "verified on <date>" line linking to `source_url`.

## 5. Admin form

The Settings > Important Contacts create form gains inputs for address (AR/EN), city, official source URL, and a "mark verified today" action, plus the new categories in the dropdown. Existing edit/toggle/delete behaviour stays.

## 6. Verification

- Read every inserted row back from the database and compare field-by-field with your approved table.
- Open the student Contacts page and the admin Settings tab in a browser at mobile and desktop widths, confirm grouping by category, RTL layout, ASCII digits in phone numbers, and that Düsseldorf Immigration shows no email button.
- Confirm the office map still resolves without the country word.

## Technical notes

- Migration: `ALTER TABLE public.important_contacts ADD COLUMN ...` (nullable, no data loss) + a data insert of the 14 rows with `source_url` and `last_verified_at = now()`.
- Files: `src/components/landing/Map.tsx`, `src/pages/student/StudentContactsPage.tsx`, `src/pages/admin/AdminSettingsPage.tsx`, `public/locales/{ar,en}/dashboard.json`.
- Phone numbers stored in international form (`+49 …`) except the four short emergency codes; `tel:` links strip spaces.
- No public-site content changes beyond the map query.
