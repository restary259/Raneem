# KAPITO 2027 accuracy and Arabic-first refinement

## Goal
Make the KAPITO page a fast, Arabic-first reference using the official 2027 KAPITO price list, with clearer accommodation, dates, inclusions, and application guidance.

## Verified source decisions
- Use KAPITO’s official **Dates and Prices 2027** PDF as the current source; retain 2026 as historical data.
- Intensive Course rates remain: €210 / €190 / €180 / €170 / €160 per week by the published booking bands.
- Replace the highlighted total with a **42-week Intensive Course quote: €6,720**. Label it as a 42-week course quote, not as KAPITO’s official A1→C1 duration.
- Keep the level calculator evidence-correct: KAPITO’s official 2027 pathway lists A1→C1 as **44 weeks**. The calculator must not silently convert the verified level durations to 42 weeks.
- Add 2027 absolute-beginner dates: 4 Jan, 1 Feb, 1 Mar, 5 Apr, 3 May, 31 May, 5 Jul, 2 Aug, 30 Aug, 27 Sep, 25 Oct, and 22 Nov 2027.
- Replace the current accommodation prices with the official 2027 prices:
  - Single room without meals: €290 / €390 / €525 / €660 for 1–4 weeks, then €165/week.
  - With breakfast: €330 / €450 / €615 / €780, then €195/week.
  - Half-board: €400 / €590 / €825 / €1,060, then €265/week.
  - Apartment from €270/week; KAPITO Studio from €300/week; deposits remain separate and unquoted.
- Show that single rooms may be with a host family, an individual host, or in a shared flat; do not describe them as always host-family rooms.
- Show afternoon learning support correctly as an included benefit: **10 hours of learning support and exam preparation per week** in the official 2027 sheet.
- Do not present “14 days before start” as an application minimum. It is a cancellation deadline, not a registration rule.

## Page and wording changes
- Update the highlighted course panel to emphasize the 42-week total and clearly state what the amount represents.
- Add a visible accommodation note above the room options explaining the host-family / individual-host / shared-flat arrangements.
- Repair the “Included” area so every English inclusion has a proper Arabic equivalent instead of displaying raw English database text.
- Make the non-beginner Monday-start rule a stronger highlighted notice with natural Arabic wording: students with prior German can start on a Monday only after KAPITO confirms their level through placement.
- Show 2027 dates grouped cleanly by Arabic month names with Western numerals, while keeping the beginner/non-beginner distinction explicit.
- Replace the application card with two clearly separated facts:
  1. **Official:** register, pay the €200 deposit or full fee, then KAPITO confirms the place; remaining fees are due one week before course start under the 2027 sheet.
  2. **مكتب درب recommendation:** submit 1–2 months early to improve the chance of securing the preferred accommodation. This is operational advice, not a KAPITO minimum.
- Audit all visible KAPITO labels, notes, copied answers, source lines, and included-item text so Arabic mode contains no unintended English sentences except proper names and CEFR codes.

## Data and calculation work
- Add a new current 2027 price-version record and keep the 2026 version available as history.
- Seed the official 2027 course prices, summer window, accommodation prices, dates, included benefits, payment timing, and source metadata.
- Ensure the page loads dates and records belonging only to the selected current price version/year, preventing mixed 2026/2027 answers.
- Preserve the flat-band calculation rule: one weekly rate applies to the entire booking based on total weeks.
- Add regression coverage for:
  - 42 × €160 = €6,720 featured quote.
  - Official 44-week level path remains 44 weeks in the calculator.
  - Every 2027 booking band and accommodation tier.
  - Arabic inclusion translations and Arabic date formatting.
  - No 14-day registration-minimum claim.

## Validation
- Run focused pricing/date/translation tests and the full translation parity guard.
- Verify the Arabic page visually at desktop and mobile widths, including tab fit, highlighted notices, room expansion, and no mixed-language overflow.
- Compare every displayed 2027 number against the rendered official PDF pages before completion.

## Technical details
- Implement the 2027 source data in a new migration rather than rewriting the applied 2026 migration.
- Localize included benefits through structured bilingual values or a strict translation map; never render raw English arrays in Arabic mode.
- Keep source labels and “مكتب درب recommendation” visually distinct so staff can tell official facts from internal guidance immediately.
