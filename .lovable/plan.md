# Audit today's changes + fix the F+U school page

## What I found so far

- **Why F+U shows "KAPITO"**: the school page is shared by every school, and three pieces of text name KAPITO directly in the page itself: the "Where is the single room?" box, the "Official KAPITO procedure" badge, and the application steps (€200 deposit). They show on every school, including F+U. The F+U data itself is not mixed up. The wording is just written into the page instead of coming from each school's own data.
- **Why the words stack up and down**: in the course card, the "Course start rule" text sits in a narrow column next to Lessons, Schedule and Class size, so long sentences wrap one or two words per line.
- **Today's changes** (17 since midnight): #204 to #212 from GitHub, two security fixes, the logo files, and the "Work in progress" / "Lovable update" saves made at 13:52–13:53.

## Steps

1. **Audit today's changes**
   - Check that each change from GitHub (#204 to #212) is fully present in the current code and that nothing undid it later (this happened once before with the Visa tabs).
   - Check that the database changes made today exist on the live database: the F+U class size 12–15, the removed F+U housing note, and the Google "cancel request" change from #211.
   - Run the code check and the tests.
   - Report each change as applied, partly applied or missing, and restore anything missing.

2. **Check that no information leaks between schools**
   - Search the school pages for any other school name or price written directly into the page.
   - Confirm that each school's courses, prices, start dates, housing, notes, policies and documents load only for that school.
   - Look at the live data for rows linked to the wrong school.

3. **Remove the KAPITO text from shared pages**
   - Show the single-room box and the application steps only when that school's own data has them. KAPITO keeps its text and F+U shows nothing wrong.
   - Change the badge to a neutral "Official school procedure".
   - Update Arabic, English and Hebrew together.

4. **Fix the stacked words**
   - Put the short facts (Lessons, Schedule, Class size) in one row. Give "Course start rule" its own full-width line below them.
   - Check the layout on phone and desktop, in Arabic and English.

5. **Check in the browser**: open the F+U and KAPITO pages and confirm each one shows only its own information.

## Technical details

- Hardcoded strings live in `src/pages/team/TeamPartnerSchoolPage.tsx` (lines 461, 671, 676), under the i18n keys `partnerSchools.singleRoomSetting`, `officialSchoolRule` and `officialApplicationBody`. They will be shown only for the matching school slug, or replaced with per-school notes.
- The course facts grid becomes: facts in `grid-cols-2 sm:grid-cols-3`, start rule in `col-span-full`.
- Locale files are changed in both `public/locales` and `src/locales`.
- If a database change is missing, I'll send you the SQL to run yourself. No production data will be changed.
