# DARB Agent Guide — v3 (Arabic + Hebrew)

Scope: the printed guide only. No application code, database, RLS, or locale files are touched.

## What's wrong with the current PDF (verified against the file)

- The cover carries a gold circle + "DARB درب" wordmark lockup at the top — to be removed.
- The commission and payout figures are still blank placeholders: "عمولتك لكل طالب من الشبكة ₪ ___", "عمولتك على إحالة مباشرة ₪ ___", "الحد الأدنى للسحب ₪ ***", and the hold period reads "*** يوم / ___ תקופת המתנה".
- The payout flow row and the FAQ repeat the same blanks, so the document currently states no rules at all on the points that matter most to an agent.
- The source generator that produced this PDF lived in a scratch directory that has since been cleared, so v3 is rebuilt from a fresh, kept generator script.

## Changes

### 1. Branding / header

- Remove the gold circle and the "DARB / درب" lockup from the cover's top area; rebalance the cover so the removal leaves no gap (title block and the decorative arc shift up to fill the space).
- The small running-header mark and the footer "DARB — دليل الوكيل" line on inner pages stay: they are the page furniture, not the target area. Page numbers stay.

### 2. Business rules — fill every blank

Applied everywhere each rule appears (rules table, payout timeline, FAQ, and the summary card):


| Rule                                      | Value                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Lock (holding) period                     | 20 days                                                                                       |
| Payment after approval                    | up to 5 days                                                                                  |
| Commission — network referral             | ₪500                                                                                          |
| Commission — direct referral by the agent | ₪1,000                                                                                        |
| Minimum payout                            | none                                                                                          |
| Start of work                             | immediately after first sign-in to the agent dashboard — no waiting period or activation step |
| Student service fee                       | ₪4,000 (unchanged)                                                                            |
| Referral discount/reward                  | up to ₪250 (unchanged)                                                                        |


Definitions stated once, verbatim in both languages: a direct referral is a student the agent personally refers; a network referral is a student who arrives through a partner or ambassador the agent recruited. No extra eligibility conditions, thresholds, approval gates, or waiting periods are added anywhere.

### 3. Translation pass — Arabic and Hebrew

- Rewrite every string so both languages read as native business copy rather than mirrored translations, with one consistent term per concept (agent / partner / ambassador / student / commission / lock period / payout request / bank transfer).
- Same meaning, numbers and timing in both columns — no drift between the Arabic and Hebrew statement of a rule.
- Western digits and ₪ throughout; no stray English labels, no reversed or unjoined text.

### 4. Layout QA

- Remove the collisions the current file shows around the payout table and the numbered flow row; give every card, table row, separator line, and the footer rule its own clear spacing.
- Enforce consistent RTL alignment across all pages, keep the "Complete Before Use" page limited to what genuinely stays blank (names, signatures, dates, effective date, legal entity), and confirm clean page breaks.

## Delivery

`/mnt/documents/darb-documents/DARB-Agent-Guide-v3-AR-HE.pdf` (the v2 file stays in place). Every page is rendered to an image and inspected — Arabic joining, Hebrew rendering, RTL direction, no clipping or overlap, correct colours, logo and page numbers — and regenerated until the whole document passes.

## Technical notes

Generator: an HTML/CSS template rendered to A4 PDF via headless Chromium (same route as v2, which reproduces the DARB navy `#0F1B2D` / gold `#F9B115` palette and joins Arabic correctly). Fonts: Noto Sans Arabic and Noto Sans Hebrew. The generator script is kept under the project's scratch area so future revisions don't need a rebuild. 8. Editable Word Delivery — Mandatory

The final deliverable **MUST include an editable Microsoft Word** `.docx` **version** of the guide in addition to the PDF.

- Create: `/mnt/documents/darb-documents/DARB-Agent-Guide-v3-AR-HE.docx`
- The `.docx` must contain the **actual Arabic and Hebrew text as editable text**, not screenshots, flattened pages, or images of the PDF.
- Headings, paragraphs, tables, labels, numbers, and other text must remain editable in Microsoft Word.
- Preserve the final PDF's wording, Arabic/Hebrew translations, RTL direction, layout, spacing, tables, and overall visual quality as closely as reasonably possible in the Word version.
- Verify that the `.docx` opens successfully and that the text can actually be selected and edited.
- The final delivery is **not complete unless both files exist**:
  - `DARB-Agent-Guide-v3-AR-HE.pdf`
  - `DARB-Agent-Guide-v3-AR-HE.docx`
- Do not replace the Word requirement with the PDF. **The editable** `.docx` **is a mandatory deliverable.**
- &nbsp;