# Link each school to its city and show the matching City Guide to the student

## What exists today
- Every school already has a city saved (F+U and Alpha Aktiv: Heidelberg; KAPITO: Münster; GoAcademy: Düsseldorf; perfekt deutsch: Dortmund).
- Only Heidelberg has a city guide.
- The student's City Guide looks at the student's **home city first**. It only falls back to the school the student picked during first login. The school the team picks on the case is never checked. So a student whose home city is filled in, or whose school was set by the team, can get the wrong guide or "no guide".

## Changes
1. **The school decides the city.** The guide picks its city in this order:
   1. the school chosen on the student's case (by the team)
   2. the school the student picked during first login
   3. the student's home city, only as a last fallback
2. **Updates on its own.** When the team changes the school on the case, the student's guide switches to the new school's city the next time they open their dashboard.
3. **Shows up on the dashboard.** The student overview gets a "Your city: Heidelberg" card linking to the full guide. The City Guide menu item only shows when the school's city has a guide. Students whose school city has no guide yet see a short "coming soon for {city}" note instead of an error.
4. **Each school's city is easy to see.** The partner school page shows the school's city as a clear label, so the school-to-city link can be checked.
5. **Ready for new cities.** Adding a guide for Münster, Düsseldorf or another city later means adding that city's guide content only. Schools in that city start using it automatically.

## Technical details
- `src/components/student/StudentCityGuide.tsx`: replace the residential-first lookup with one resolver `resolveStudentGuideCity()` in `src/lib/studentGuideCity.ts`. It reads the student's own case school through the existing student-scoped case read (`get_my_case` / own `case_submissions.school_id`, checked against RLS before use), then `profiles.language_school_id`, then `residential_city`, and looks up `schools.city`. Failed reads stay errors and are not treated as empty.
- `src/data/studentCityGuides.ts`: switch `getCityGuide` to a registry keyed by normalized city (Heidelberg only for now), so more cities can be added later.
- Student overview card plus a conditional nav entry (desktop sidebar and `MobileBottomNav`), with keys in en/ar/he in both `public/locales` and `src/locales`.
- No database changes. `schools.city` already holds the link, and inactive cities stay hidden, not deleted.
- Update `StudentCityGuide.test.tsx` for the priority order (case school > picked school > home city). Run typecheck and tests, and check in the browser as the test student linked to F+U.
