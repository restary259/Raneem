# Partner Schools — internal knowledge tool (KAPITO first)

An internal, team-only reference page. A team member on a phone call opens it, finds the
school, and gets the exact answer — course, price, accommodation, start dates, totals — in
seconds. Desktop-first, dense, no decoration.

## What gets built

**Navigation**

- New sidebar item **Partner Schools** (team + admin only; partners, ambassadors, agents and
  students never see it).
- `/team/partner-schools` → country list (Germany only for now, built so Austria, Netherlands
  and others drop in without redesign).
- `/team/partner-schools/germany` → school list. KAPITO Sprachschule, Münster, with badges
  "Partner School" and "20 lessons/week — DARB Standard".
- `/team/partner-schools/germany/kapito` → the school sheet.

**The KAPITO sheet**

Header: school name, city, partner status, "Prices shown: 2026", last verified date, links to
the source PDFs and to kapito.com.

A quick-answer strip directly under it: DARB Standard course (20 lessons/week), Mon–Fri
09:00–12:30, max 12 students, starts every Monday, beginners on fixed dates only, Münster.
The 24-lesson Intensive Plus course is present but visually secondary.

Sticky sub-navigation: Overview · Courses & Prices · Level Calculator · Accommodation ·
Start Dates · Application · Policies · Documents.

A search box at the top answers structured questions ("how much is 8 weeks", "minimum age for
the studio", "what is included") from the stored records only. Every answer shows its source
and verification date. When a fact is not recorded, it says
**Not recorded — verify with the school** instead of guessing.

**Level calculator**

Pick starting level and target level; it uses KAPITO's own published level durations
(A1 8, A2 8, B1 8, B2 12, C1 8 weeks) and prices the total using the **official band rule** you
chose: the whole booking sits in one weekly band. A1 → B2 = 36 weeks → 36 × €160 = **€5,760**.
A1 → C1 = 44 weeks → 44 × €160 = €7,040. It works for any valid combination, shows the week
breakdown per level and the band applied, and has a **Copy answer** button producing clean
text a team member can paste into a chat.

**Accommodation and totals**

Official 2026 accommodation options with their real week-by-week prices (1/2/3/4 weeks fixed,
then the weekly rate from week 5), the €150 arrangement fee, minimum ages, and the summer
supplement (€30/week, 06.07–28.08.2026) applied automatically when the stay overlaps it.

Deposits: the price sheet and brochure only say "security deposit" without an amount, so the
page will state **security deposit required — amount to confirm with the school** rather than
printing €400/€600. Nothing unverified gets shown as fact.

Totals panel: course + accommodation + arrangement fee + summer supplement, giving one clear
**estimated payable cost**. Deposits are excluded and shown separately as an upfront-cash line
once an amount is confirmed.

**Start dates**

Picking A1 shows only the twelve official 2026 absolute-beginner start dates
(5.1, 2.2, 2.3, 7.4, 4.5, 1.6, 6.7, 3.8, 31.8, 28.9, 26.10, 23.11). Picking A2 or above shows
"every Monday". Winter closure 19.12.2026–03.01.2027 and the 2026 public holidays are flagged.

**When to apply**

A school-specific operational block (application lead time, accommodation lead time, beginner
restrictions, high-demand periods, availability notes, internal DARB notes), each with its own
"Updated" date. No invented generic advice — fields left blank read as not recorded. Price
available and availability confirmed are kept as two separate statements.

**Catalog link and correction**

A visible "Open DARB Catalog →" link, and from KAPITO Accommodation straight into the catalog
entry. The catalog is not replaced.

Confirmed defect to fix: the catalog stores only KAPITO's from-week-5 room rates (€110 / €135 /
€195), so it quotes one week at €110 when the official price is €140. The correct 1/2/3/4-week
prices will be added for all three room types so the catalog and the new page agree.

## Data

Verified against the uploaded KAPITO 2026 Dates & Prices sheet and the KAPITO brochure:

- Course bands 1–4 wk €210, 5–8 €190, 9–16 €180, 17–23 €170, 24+ €160 (already correct in the
  catalog); Intensive Plus 250/230/210/200/190.
- Level durations A1 8, A2 8, B1 8, B2 12, C1 8 weeks (brochure).
- Rooms: no meals 140/240/330/440 then €110/wk; breakfast 185/295/405/540 then €135/wk;
  half-board 245/415/585/780 then €195/wk; apartment from €200/wk (min age 23); studio from
  €225/wk (min age 18); arrangement fee €150; course minimum age 16.
- Included in course price, registration/deposit sequence (€200 reserves the place, balance
  before departure) and cancellation terms as printed.

## Technical notes

New tables: `partner_countries`, `partner_schools`, `school_price_versions`, `school_courses`,
`school_course_price_tiers`, `school_level_durations`, `school_accommodations`,
`school_accommodation_price_tiers`, `school_start_dates`, `school_policies`, `school_notes`,
`school_sources`. Every fact row carries source name, URL/document, source year, last verified
date and notes; pricing rows hang off a price version so 2027 can be added later without
touching 2026 and the two never mix on screen.

RLS: read restricted to `admin` and `team_member` via `has_role`; write admin-only. No existing
policy, permission or catalog behaviour is changed. Page data comes from the database, not
hardcoded JSX, so a second school is a data entry job.

Admin editing screens are the agreed next step, not part of this build; seeded KAPITO 2026 data
lands with the migration.

Uploaded photo archives are not used in this build — this is a reference sheet, not a gallery.
