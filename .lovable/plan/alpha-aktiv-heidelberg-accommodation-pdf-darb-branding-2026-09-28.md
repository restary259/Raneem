# Alpha Aktiv Heidelberg: accommodation PDF (DARB branding)

A 2026 accommodation guide for Alpha Aktiv. It uses the same layout, Arabic text, DARB branding and last page (your website contact details) as the F+U file.

## What we already have
- The DARB catalog has 14 Alpha Aktiv housing options: 6 student residences, 7 apartments near Bismarckplatz, and 1 host family.
- Each option has only one photo stored. None have a gallery.

## Steps
1. **Check the info against alpha-aktiv.de (the school's official website).** Compare every weekly price, price band, night rate, fee and cancellation rule with the school's 2026 pages and price list. Where our data and the website disagree, the website wins in the PDF. I will send you a short list of every difference.
2. **Photos.** Get the housing photos from the languagecourse.net page you sent, then match them to each housing type by name. Keep the one photo we already have if nothing better matches. Photos go into the PDF only. The database is not changed unless you ask.
3. **Build the PDF.** Same style as the F+U guide:
   - cover page
   - one section per housing type with photos, a short description, and weekly prices by stay length
   - fees: arrangement fee €100, deposit, night rate
   - arrival and departure
   - cancellation and visa-refusal rules, with the source named
   - last page: WhatsApp +49 176 23790623, info@darb.agency, www.darb.agency, the Tamra Mall office in Tamra, Sunday–Thursday 10:00–17:00
4. **Check every page** for layout problems and right-to-left text errors, then save the file as `DARB-AlphaAktiv-Heidelberg-Accommodation-2026.pdf`.

## Notes
- The host family option is included only if the website publishes a price and a photo. The school's brochure lists no host-family price.
- Photos from languagecourse.net belong to a third-party site. They are fine for an internal or sales PDF, but it is your call before sharing the file publicly.

## Technical details
- Reuse the existing PDF build script from the F+U guide, pointed at the Alpha Aktiv data. Housing data and price bands come from the catalog and the Alpha Aktiv partner-school tables, then are corrected against the website.
- Photos are downloaded to a temporary folder and put into the PDF. Nothing is written to storage or the database.
