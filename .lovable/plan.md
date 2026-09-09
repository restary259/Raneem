# Agent Guide v6 — wording corrections, no personalization

Fix the general Agent Guide the same way the personalized partner guide was fixed, keep it generic (no name anywhere), and remove the ₪250 student discount/reward.

## Remove the ₪250 discount

It appears twice in the current file and both go:

- Page 2 stat tile "حتى ₪250 — خصم/مكافأة الإحالة للطالب / הנחת הפניה לסטודנט". The tile is deleted and the remaining ₪4,000 service-fee tile is centred so the row does not look half-empty.
- Page 6 links table, the last row "خصم للطالب / הנחה לסטודנט — ₪250". The whole row is dropped; the table keeps who-uses-it, what-it-creates, when-you-earn, and your-commission.

No other mention of a student discount is added anywhere.

## Wording corrections (same nine as the partner guide)

1. **One commission trigger, stated identically everywhere.** Every place a commission is mentioned uses the same sentence: earned only for a student who arrives through the link, registers, and pays. Today the cover, the table and the commissions page each phrase it slightly differently.
2. **Waiting period wording.** "20-day waiting period" phrased plainly in both languages instead of the current "حجز/המתנה" shorthand, and stated the same way on the cover, the money page and the FAQ.
3. **Hebrew grammar pass.** Full read-through of every Hebrew line; fix agreement, prepositions and the second-person forms so it reads as native business copy, with one fixed term per concept (סוכן / שותף / שגריר / סטודנט / עמלה / תקופת המתנה / בקשת משיכה / העברה בנקאית).
4. **Attribution stated unambiguously.** Recruiting link versus referral link: what each one attributes, and that attribution happens automatically at application time — nothing to track manually.
5. **Dashboard mock labelled.** The numbers in the dashboard panel (9 / 37 / 12, the named rows) get a small caption saying the figures are illustrative.
6. **Support scope.** Say clearly what DARB handles (student files, school, payment, city registration and the immigration office in Germany) and what the agent handles (recruiting, introducing, staying in touch). No visa-service claim.
7. **Closing line.** Replace the flat "that's it" style ending with "والباقي علينا / והשאר עלינו".
8. **Disclaimer kept.** The footer "مستند توضيحي — ليس عقدًا / מסמך הסבר — אינו חוזה" stays on every page.
9. **Audience precision.** Students are described as Arab 48 students going to Germany for language study or university, not "students" generically.

Unchanged: ₪1,000 direct referral, ₪500 network referral, ₪4,000 service fee, payment within up to 5 days of approval, no minimum payout, work starts at first sign-in, and the whole 11-page structure, navy/gold design, cover treatment and dashboard mock.

## Output

New files, originals untouched:

- `darb-documents/DARB-Agent-Guide-v6-AR-HE.pdf`
- `darb-documents/DARB-Agent-Guide-v6-AR-HE.docx`

## Technical notes

The v5 generator was in a scratch directory that has since been cleared, so it is rebuilt from the v5 PDF's own content and layout using the same route as the partner guide: an HTML/CSS template (Noto Sans Arabic + Noto Sans Hebrew, navy `#0F1B2D` / gold `#F9B115`) rendered to A4 through headless Chromium, then a page-faithful Word file built from the rendered pages. Every page of both files is rendered to an image and inspected — Arabic joining, Hebrew rendering, RTL direction, no clipping, overlap or blank pages — and regenerated until clean. No application code, database or locale files are touched.
