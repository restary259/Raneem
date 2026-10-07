# Official course start and end dates

## Objective
Replace the approximate intake-month value with an official school start date, then automatically calculate the last scheduled class date from the selected duration in weeks. Show the schedule consistently in the case/student profile and existing spreadsheets without changing pricing or pipeline behavior.

## Implementation
1. Add a shared course-schedule helper that:
   - accepts an ISO start date and whole course weeks;
   - returns the final Friday of the last teaching week for Monday-start language courses (`start + weeks × 7 − 3 days`);
   - uses UTC-safe date arithmetic and returns ISO dates;
   - leaves the end date empty when either input is invalid.
2. Add a reusable official-start-date selector for the profile and team student forms:
   - resolve the selected catalog school through its linked partner-school record;
   - load only that school's recorded `school_start_dates`;
   - display the exact official dates, audience/course note, and year;
   - use a mobile-first single-column layout, expanding to aligned columns on larger screens;
   - clear an incompatible date when the school changes;
   - show a clear unavailable/error state instead of silently inventing a date.
3. Update all current program-detail entry paths (`CaseProfileForm`, `ProfileCompletionForm`, and team-created student flow) to save both `program_start_date` and calculated `program_end_date` in `case_submissions`.
4. Keep course weeks as the duration authority. Recalculate the end date whenever the selected official date or weeks change.
5. Display start date, final class date, and course weeks in the saved profile/case summary. Existing spreadsheet columns already read these two database fields, so verify rather than duplicate their mapping.
6. Add English, Arabic, and Hebrew labels in both locale copies used by the app.

## Existing Jilan case
Safely update only Jilan Bashuti's existing case `DRB-2026-000162` after the application change is reviewed:
- official HORIZONTE beginner start: `2026-10-26`;
- duration: `34` weeks;
- calculated final class date: `2027-06-18`.

This will be a narrowly scoped, non-destructive migration/update and will not change the case stage, assignment, prices, payments, or any other student.

## School-rule boundary
The backend currently records official school start dates but no school holiday/closure calendar. The calculation will therefore use the published start plus consecutive teaching weeks, ending on Friday. It will not invent holiday extensions. If closure dates are added later, the shared helper can incorporate them centrally.

## Validation
- Unit tests for one-week, 34-week, year-boundary, leap-year, missing, and invalid inputs.
- Tests that school changes remove incompatible dates and only linked official dates are selectable.
- Verify Jilan's 26 October 2026 start produces 18 June 2027.
- Verify English/Arabic/Hebrew labels, RTL layout, and narrow mobile widths.
- Verify profile summary and spreadsheet values match the stored dates.
- Run relevant tests, TypeScript check, build, inspect the diff, then open a reviewable PR without merging it.
