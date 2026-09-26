# Fix the broken date selector (calendar) everywhere

## Root cause (confirmed)

The project uses `react-day-picker` **v9.14**, but the shared calendar component
(`src/components/ui/calendar.tsx`) still passes **v8 style keys** (`table`,
`head_row`, `head_cell`, `row`, `cell`, `day_selected`, `day_today`,
`nav_button_previous`, ...). Version 9 renamed all of these
(`month_grid`, `weekdays`, `weekday`, `week`, `day_button`, `selected`,
`today`, `button_previous`, ...), so every style rule is silently ignored.
The calendar renders unstyled and broken in **both** places it is used:

- The office-visit booking calendar on the **apply page** (`PublicOfficeBooking`)
- The team appointments calendar (`TeamAppointmentsPage`)

## Fix

1. **Rewrite `src/components/ui/calendar.tsx` with the correct v9 class names**
   (the standard shadcn v9 calendar): proper month grid, weekday header row,
   40px day buttons, selected/today/disabled states, working previous/next
   month arrows, and the existing `Chevron` icon override kept.
2. Keep the booking calendar's own props untouched (RTL direction, Arabic
   locale, Western numerals, available-days-only disabling) — they are correct.
3. **Verify visually** in the running app:
   - Apply page → success step → "Book an office visit" calendar renders as a
     clean month grid with only available days clickable.
   - Team appointments calendar renders correctly.
4. Confirm the build passes.

## Notes

- The plain date inputs used elsewhere (visa page, documents, CV builder) are
  native browser fields and are not affected by this bug.
- No database, translation, or behavior changes — presentation fix only.
