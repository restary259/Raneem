# Verify and finish the two schools you added (Alpha Aktiv, GoAcademy!)

## What I checked

I compared the two school files you added through GitHub against what the live database actually contains, and against what the Partner Schools screen reads.

**The main finding: neither school is in the database.** The database has only KAPITO (Münster) and F+U (Heidelberg). The last change actually applied was the catalog-link column from 18 September; the Alpha Aktiv and GoAcademy! files were added to the repository but never run. That is why nothing new shows up on `/team/partner-schools/germany` — this is not a rendering bug.

The content of both files is otherwise well built: they follow the same shape as KAPITO, they refuse to run twice, and every price carries its source document.

## Issues found in the two files

1. **Not applied** — Alpha Aktiv and GoAcademy! exist only as files.
2. **Card order clash** — GoAcademy! and F+U are both set to position 2, so the country list order is arbitrary between them.
3. **GoAcademy! has no start dates at all** — its Start dates tab will be empty, while KAPITO, F+U and Alpha Aktiv all list their beginner dates. Its courses do carry a written start rule, and the doctors/nursing 2026 dates are recorded as text, but the dated list is missing.
4. Things that are correct and should stay: the nightly room rate and the per-course registration fee that Alpha Aktiv adds are already understood by the calculator; the catalog corrections it makes (three missing Heidelberg apartments, and the 27+ double-room rate corrected from 140 to 130) match the brochure; GoAcademy! links its rooms to the existing catalog entries rather than duplicating them; host families stay unlinked and unpriced where the brochure prints nothing.

## Plan

1. Apply both schools to the database, Alpha Aktiv first (it adds the nightly-rate and registration-fee fields GoAcademy! is written against), then GoAcademy!.
2. Fix the card order so the four schools read KAPITO, F+U, GoAcademy!, Alpha Aktiv without a tie.
3. Add GoAcademy!'s 2026 beginner start dates from the uploaded brochure so its Start dates tab is not empty. If the brochure states only "every Monday" for beginners, I will record that as the written rule instead of inventing dates — no dates will be made up.
4. Verify in the browser as a team member: both schools appear in Germany, every tab renders (courses, levels, accommodation, start dates, application, policies, sources), the price calculator returns the brochure figures, Arabic reads right-to-left with no untranslated English, and "View in catalog" opens the exact room.
5. Report anything the brochures do not publish (for example Alpha Aktiv's host-family price and deposit amount) as visibly empty rather than filled with a guess.

## Technical notes

- Apply `supabase/migrations/20260918200000_partner_school_alpha_aktiv_2026.sql` then `20260918210000_add_goacademy_partner_school.sql` through the migration tool, in that order (Alpha adds `school_accommodation_price_tiers.night_price` and `school_courses.registration_fee`).
- `partner_schools.sort_order`: set goacademy-dusseldorf = 3, alpha-aktiv = 4 (kapito 1, fu-academy 2).
- GoAcademy! start dates: insert into `school_start_dates` (school_id, year, start_date, audience='beginner', note_en/ar, source_*) only for dates printed in `goacademy-sprachschule-duesseldorf-german-courses-2026.pdf` / the 2026 price list.
- No frontend changes are expected; `usePartnerSchools` selects `*` and `SchoolCalculator` already reads `night_price` and `registration_fee`.
