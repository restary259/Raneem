# Partner Schools — audit findings and repair plan

No redesign. Four schools in scope: KAPITO (Münster), F+U Academy (Heidelberg), GoAcademy! (Düsseldorf), Alpha Aktiv (Heidelberg). Perfekt Deutsch Dortmund is not in the system and stays out of scope.

## What the audit found so far

Checked against the official uploaded brochures and price lists, plus the live database.

### Critical — GoAcademy! prices are calculated the wrong way

The GoAcademy 2026 price list charges a higher rate for the first four weeks and a lower rate afterwards, in the same booking. Our system instead applies one single rate to the whole booking, so the team is quoting too little.

Official rules, printed in the price list:

- Course: weeks 1–4 at €190, weeks 5–24 at €175, and "if you book 25 or more weeks you only pay €165 per week from the beginning".
- Accommodation: weeks 1–4 at the higher rate, further weeks at the middle rate, 24+ weeks at the lowest rate, plus "for bookings of at least 12 weeks the surcharge for the first 4 weeks is waived" and "for bookings of at least 24 weeks the price applies from the first week".

Effect today, examples:

| Booking | Correct total | What our calculator shows | Gap |
|---|---|---|---|
| 12-week course | €2,160 | €2,100 | €60 short |
| 20-week course | €3,560 | €3,500 | €60 short |
| 8 weeks standard shared room | €1,240 | €1,160 | €80 short |

KAPITO, F+U and Alpha Aktiv genuinely do use one flat rate for the whole booking (their own printed examples confirm it), so they must keep working exactly as they do now.

### Verified correct (no change needed)

- KAPITO 2027 course bands (€210 / €190 / €180 / €170 / €160) and the extension bands, the fixed 1–4 week room prices (€290 / €390 / €525 / €660), €165 per week from week 5, apartment from €270, studio from €300, summer supplement 5 Jul – 27 Aug 2027 at €30 per week — all match the official 2027 sheet.
- GoAcademy accommodation rates themselves (€165/145/130, €220/195/180, €185/165/150, €245/225/210, €360/310/270, family €310/270/250 and €390/320/300), placement fee €90, deposit €250, transfer €100 / €150 — all match.
- F+U and Alpha Aktiv week-band structures match their brochures.

### Data gaps and smaller issues

1. GoAcademy has no start dates at all and no verification date on the school record.
2. GoAcademy courses show no registration fee even though its own policy records €60.
3. F+U Academy has no website address stored and only one source document.
4. F+U "Residence A twin" has no price and no rate rows at all.
5. Alpha Aktiv "host family" has no price (the brochure does not print one) — correct to leave blank, but it should say so clearly.
6. KAPITO's 2027 accommodation arranging fee is blank because the 2027 sheet does not reprint it.
7. Security deposits for KAPITO are still unconfirmed.
8. Courses with no published price (evening classes, doctors, nursing, private lessons, exam prep) still appear in the calculator's course list and quote nothing.
9. An accommodation stay of zero weeks currently shows €0, which reads as free housing.

## The fix plan

1. Support first-weeks-surcharge pricing in the shared pricing helper, driven by data (a "charge the first weeks separately" marker plus the week count at which the surcharge is waived), so GoAcademy calculates correctly and the other three schools are untouched.
2. Mark GoAcademy's course and accommodation rates accordingly through a migration, and stamp its €60 registration fee on the courses that publish it.
3. Add GoAcademy's official start-date rule and verification date. Dates that only exist as coloured marks in the brochure stay out — the page keeps saying "not recorded".
4. Fill F+U's website and add the missing source entries; leave the unpriced twin room visibly blank rather than guessing.
5. Calculator behaviour: courses with no published price are clearly marked and produce no total instead of a silent zero; a zero-week stay reads "not applicable" instead of €0.
6. New tests covering each band edge (the week before, at and after every boundary), the surcharge waiver points at 12 and 24 weeks, and the missing-price cases.
7. Full pass over every school tab in English and Arabic, right-to-left layout, and the "view in catalog" links.

## Technical notes

- Pricing stays in `src/lib/partnerSchools.ts`; `quoteCourse` / `quoteAccommodation` gain a progressive branch selected per row, default unchanged.
- Schema change is additive: `surcharge_weeks` and `surcharge_waived_from_weeks` (nullable) on the course and accommodation tier owners; existing rows stay NULL and behave exactly as today.
- All data changes go through migrations. No RLS, layout, navigation or design-system changes.
- Anything the official source does not print stays null and renders "not recorded — verify with the school".
