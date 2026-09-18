# Partner Schools — add F+U Academy of Languages (Heidelberg)

Second school on the internal Partner Schools tool, built exactly like KAPITO: same page,
same tabs, same Arabic-first layout. No new UI patterns, no redesign — this is a data
entry job plus two small behaviour additions the F+U price list requires.

Source: the official **Academy of Languages by F+U International — Programme 2026 (English),
valid from 13/10/2025** price brochure. Anything not printed in it stays empty and reads
"not recorded — verify with the school".

## What the team will see

`/team/partner-schools/germany` gains a second school card: **F+U Academy of Languages**,
Heidelberg. Opening it shows the same eight tabs as KAPITO.

**Highlighted course (DARB standard): Intensive course 20 — 20 lessons/week**
09:00–12:15 and 13:00–14:30, from age 16, no upper age limit.
Weekly price by total booking length: 1–6 wks €225 · 7–16 €195 · 17–29 €170 · from 30 €155.
The other published courses (Intensive 20 + module 10, Intensive 30, Super-intensive 30+5,
module course 10, evening courses, combination course, Studienkolleg pathway, ANP preliminary
course) are listed as secondary rows with their own prices.

**Level planner — week ranges.** F+U publishes levels in teaching hours, not weeks:
A1, A2, B1, C1, C2 = 160–210 hours each; B2 = 240–300 hours. At 20 lessons/week the planner
shows a range, e.g. A1→B2 = **44–58 weeks**, and prices both ends using the single weekly
band that applies to each (44 wks × €155 = €6,820 · 58 wks × €155 = €8,990). The card states
plainly that F+U publishes hours and the weeks are derived from 20 lessons/week. The exact
duration is confirmed by the placement test.

**Start dates.** Absolute-beginner German intake 2026: 05/01, 02/02, 02/03, 07/04, 04/05,
01/06, 06/07, 03/08, 07/09, 05/10, 02/11, 07/12. Students with prior German may start any
Monday after placement. Baden-Württemberg public holidays 2026 and the 28/12–01/01 school
holiday are shown, with the school's own rule that missed lessons are made up at the end
of the course.

**Accommodation — everything published.**
Host families, categories A (up to 30 min to school) and B (up to 50 min), single and twin,
half board / breakfast / room only, with the 1–6 week rate, the from-7-week rate and the
extra-day rate.
Residences, categories A, B, B+, C, D, E, single and twin, with all four week bands, plus
the residence list (Turner, Schmidt, Concordia, Franz-Marc, Schmitt, März, F+U Campus),
what each includes and its distance to the school.
Fees exactly as printed: administration fee €130 (€170 from 12 weeks), deposit €200
(€500 from 12 weeks), kitchen utensils €50 + €40 deposit, residence guarantee €300.
Move-in and check-out times for both housing types.

**Application and money facts.** Registration fee €60 for one person (less per head in
groups), family discount 10%, the course guarantee and small-class reductions, two weeks of
individual leave on courses of 12 weeks or more, and the 25% surcharge for lessons outside
regular hours. DARB's own 1–2 month recommendation stays clearly labelled as internal advice,
separate from the school's rules.

**Extras** recorded as facts, not sales copy: airport transfer from Frankfurt (€165 residence,
€190 host family, one way, 25% off per person for two or more), free placement test, free
level tests, certificate of participation, internal exams from €80, recognised exams from €180,
provisional admission €600, study counselling €390, official administration visits €295.

**Catalog link.** The school already exists in the DARB catalog with fourteen Heidelberg
accommodations, but each is stored only at its cheapest long-stay weekly rate (€155, €180,
€210, €225, €240, €245, €305, €370) — the same defect KAPITO had. Short-stay bands are
missing, so the catalog understates a six-week booking. The accommodation tab links across
to the matching catalog entry, and the missing 1–6 / 7–16 / 17–29 week rates get added to
the catalog so the two agree. Host-family options are not in the catalog and are not added
there; they live on the Partner Schools page only.

## Technical notes

No schema changes. F+U is seeded into the existing tables (`partner_schools`,
`school_price_versions` for 2026 marked current, `school_courses` +
`school_course_price_tiers`, `school_accommodations` +
`school_accommodation_price_tiers`, `school_start_dates`, `school_policies`,
`school_notes`, `school_sources`), linked to the existing catalog school
`F+U Academy of Languages`.

Two code additions, both additive and shared:

- Level durations stored as an hour range per level; `levelPlan` / the calculator gain a
  min/max week result. KAPITO stores fixed weeks and keeps producing a single number, so
  its output does not change.
- Accommodation tiers already support a weekly rate; an optional extra-day rate is displayed
  where the school publishes one.

Arabic strings for every new label are added alongside English in both locale files
(parity-guarded). Pricing helper tests are extended with the F+U range cases and the
existing KAPITO cases stay green.

Admin editing screens remain out of scope, as agreed for KAPITO.
