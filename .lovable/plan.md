# Audit and remove trailing dots from titles

## Verified cause

- The hero and heading components render translated title text exactly as supplied; they do not append punctuation.
- No title-related CSS pseudo-element adds a dot.
- The trailing dots are written directly into localized `title`, `heroTitle`, and `campaign` values.
- The audit found 13 user-visible localized title values ending in a full stop, represented by 21 file entries because English and Arabic core translations also have bundled copies.
- Confirmed examples include the homepage slogan lines in English, Arabic, and Hebrew; the Destinations editorial title; the AI advisor heading; the partnership closing heading; and one Hebrew trust heading.

## Changes

1. Remove only the final full stop from declarative titles and headline fragments across English, Arabic, and Hebrew.
2. Preserve meaningful punctuation inside a title, such as the separator in “Same Dream. Different Destinations”, while removing only its terminal dot.
3. Keep question marks on genuine question headings and FAQ titles; those are grammatically intentional and are not the reported issue.
4. Update both translation sources where duplicated so bundled and asynchronously loaded pages cannot disagree.
5. Add a focused translation test that rejects future public `title`, `heroTitle`, `heading`, `headline`, and `campaign` values ending in a full stop.

## Verification

- Run the translation parity and full unit test suite.
- Check the homepage, Destinations, AI Advisor, and Partnership pages in English, Arabic, and Hebrew where available.
- Confirm titles no longer end with dots while sentence copy and question headings retain correct punctuation.
