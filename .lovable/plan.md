# DARB Agent Guide v2 — Visual Pitch Deck (Arabic + Hebrew, RTL)

Rebuild the Agent Guide as a **sales-oriented, highly visual bilingual brochure** used for cold outreach — not a contract. Same brand (Navy `#0F1B2D`, Gold `#F9B115`, DARB logo), same confirmed facts, but the format changes from a text document to a designed, diagram-led PDF.

## Format change

Move from DOCX-first to a **design-first PDF** (vector-drawn pages) so real diagrams, cards, and infographics are possible. A companion editable DOCX is dropped unless you still want it — a pitch PDF is the deliverable.

Page size: A4 portrait, full RTL layout (content flows right-to-left, headings right-aligned, tables mirrored, arrows pointing right-to-left).

## Page plan (10–12 pages)

1. **Cover** — logo, big Arabic title with Hebrew subtitle, one-line hook ("اربح من شبكتك" / "הרווח מהרשת שלך"), gold accent geometry.
2. **What is DARB / the opportunity** — 3 icon cards: what DARB does, who the students are, why agents earn.
3. **What is an Agent** — single diagram: Agent at the top, arrows down to Partners and Ambassadors, then to Students. Short bilingual captions on each node.
4. **How the money flows** — flow infographic: Student pays ₪4,000 → enrolled → commission unlocked → payout by bank transfer. Gold callout boxes for ₪4,000 and the ₪250 referral cap.
5. **Your recruiting link** — visual mock of a link card (`/join/AG-XXXX`), 3-step numbered strip: share link → person signs up → they appear in your network automatically.
6. **Referral links explained** — side-by-side comparison: recruiting link (brings partners) vs referral link (brings students). Two-column visual with icons, no dense text.
7. **Your dashboard** — annotated wireframe mock of the agent dashboard: network list, students count, earnings, payout request. Numbered callouts (1..5) with bilingual labels pointing at each region.
8. **How tracking works** — timeline strip: link clicked → application submitted → case attributed to you → status moves through pipeline → paid & enrolled → commission recorded. Shows the agent always sees the stage.
9. **When you get paid** — payout journey graphic: earned → holding period (blank field) → request payout → bank transfer. Blank fields stay blank.
10. **FAQ** — 6–8 short bilingual Q&A cards in a 2-column grid (Do I need a license? What if the student cancels? Do I earn on my own referrals? Is the discount from my commission? etc.), answered only from confirmed facts.
11. **Get started** — 4-step call to action + contact block.

Every page: running header with logo, footer with page number, both languages present (Arabic primary right block, Hebrew secondary in a lighter grey/gold-chipped block).

## Content rules (unchanged)

- Confirmed facts only: ₪4,000 student fee, discount/reward capped ₪250, commission earned when the student is **paid and enrolled**, payout by bank transfer to preferred method, registration fees non-refundable, Israel / Haifa courts.
- Anything variable (commission amount, holding period, payment window, effective date, legal entity) stays a visible blank line — no invented numbers.
- Non-contractual: no signature block, no clauses. A single small footer note that terms are set in the separate agreement.
- Western digits, ₪ currency.

## Technical approach

- Generate with Python `reportlab` (vector shapes, exact control), registering **Noto Sans Arabic** and **Noto Sans Hebrew** TTFs.
- RTL correctness: shape Arabic/Hebrew with `arabic_reshaper` + `python-bidi` before drawing (reportlab does not shape natively). Verify joined letterforms and no reversed strings on every page.
- Reusable drawing helpers: card, arrow, node, numbered callout, timeline strip, KPI tile, gold highlight box, bilingual text block.
- Dashboard/diagram visuals are drawn as vector mockups (not screenshots), so they stay crisp and on-brand.

## QA

Render every page to an image and inspect for: Arabic joining, Hebrew direction, no reversed text, no missing-glyph boxes, no clipping or overlap, mirrored tables/arrows, correct logo and colours, page numbers. Fix and re-render until clean.

Output to `/mnt/documents/darb-documents/DARB-Agent-Guide-AR-HE-v2.pdf` (the current v1 files are kept).
