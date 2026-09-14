# Personalized cost proposal — جيلان بشوتي (Regensburg, March 2027)

A premium 8-page Arabic RTL consultation PDF (plus a matching Word file), generated as a document deliverable. No changes to the website or app.

## What gets produced

- `DARB-Proposal-JEELAN-BASHOTI-Regensburg-2027.pdf` — 8 A4 pages, Arabic RTL
- A page-faithful `.docx` companion (same visual layout)

## Page structure

1. **Cover** — جيلان بشوتي · مجد الكروم · Regensburg · بداية مارس 2027, DARB logo, title "تكلفة سنة اللغة الألمانية في ريغنسبورغ – ألمانيا"
2. **الدورة** — Intensive German Course, 34 أسبوعاً, 15.03.2027 – 05.11.2027, €6,700 ≈ ₪23,584
3. **مقارنة خيارات السكن** — comparison table sorted cheapest → most expensive, cheapest row visually highlighted (neutral wording, not "best")
4. **تفاصيل خيارات السكن** — the five options as separate cards (floor, room type, dates, accommodation price, summer surcharge €240, total) + the early-booking warning box
5. **رسوم خدمة DARB — ₪4,000** — the 12-item service bundle, plus a separate note: ترجمة وتصديق (₪1,000–₪1,500) not included, student may use DARB's notary or his own
6. **مصاريف شهرية تقريبية — خارج سعر البرنامج** — health insurance €28/mo ≈ ₪99 (≈ €252 ≈ ₪887 for ~9 months), internet €40/mo ≈ ₪141, Deutschlandticket €69/mo ≈ ₪243 — in their own box, never folded into program totals
7. **المعلومات المطلوبة لبدء الملف** — checklist (personal / address / passport) + the accuracy note
8. **الصورة المالية الكاملة** — course + accommodation range + surcharge formula, DARB fee separate, optional notary separate, timeline (14/15 Mar, 15.03–05.11, 06.11), CTA "الخطوة التالية", footer contact block

## Numbers (exactly as supplied, verified)

| Option | EUR total | ILS |
|---|---|---|
| Twin – shared apartment | €10,090 | ≈ ₪35,517 |
| Twin – private bathroom | €10,440 | ≈ ₪36,749 |
| Single – shared apartment | €11,840 | ≈ ₪41,677 |
| Single – private bathroom | €12,190 | ≈ ₪42,909 |
| Studio apartment | €13,940 | ≈ ₪49,069 |

Each total = €6,700 course + accommodation + €240 summer surcharge. The ₪4,000 DARB fee and the optional notary are never added into these. Rate note printed: "الأسعار بالشيكل تقريبية وقد تتغير حسب سعر صرف اليورو وقت الدفع" (€1 ≈ ₪3.52).

## Contact block (from the live site, not invented)

- طمرة مول، طمرة 3081100
- 050-7368283 · darbsocial27@gmail.com · darb.agency

No lawyer/legal number is published publicly on the site, so none will be printed — I'll simply omit it rather than invent or leave a placeholder, unless you want a placeholder line.

## Design & technical notes

- Built with an HTML + CSS template rendered to PDF via headless Chromium (same pipeline as the Partner/Agent guides) — this gives correct Arabic shaping, RTL flow, and print-grade typography.
- Palette: white/off-white background, charcoal text, DARB yellow accent, very restrained black-red-yellow hairline accents. No gradients, illustrations, stock photos, flags, or landmarks.
- Official logo `d0f50c50-…png` used as-is; placed on a pure white area so no visible white box appears against off-white panels.
- Digits stay Western (0-9) with € and ₪ symbols, matching DARB's existing documents and invoices.
- QA before delivery: every page rendered to an image and inspected for Arabic letter joining, RTL order, overlap, clipped prices, correct dates, and correct totals.
