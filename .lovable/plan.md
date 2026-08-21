# DARB Business Documents — Arabic + Hebrew Edition

## What happened to yesterday's work

The six document scripts and the shared branding library were written into the sandbox's scratch directory (`/tmp/darbdoc/`). That directory is wiped between sessions, so the code is gone and `/mnt/documents/` is empty — nothing was ever generated to a permanent location. Nothing is recoverable, so this run rebuilds the generator from the confirmed facts and produces the finished files this time.

Two things changed since yesterday's draft: the documents are now **Arabic + Hebrew** (they were English), and everything gets written to the permanent documents folder before conversion, so a session ending can never lose them again.

## Deliverables

Six documents, each produced as both an editable `.docx` and a print-ready `.pdf`, in `/mnt/documents/darb-documents/`:

| # | Document | Purpose |
|---|---|---|
| 1 | Agent Guide | How agents recruit partners and ambassadors, what they earn, how payouts work |
| 2 | Social Media Partner Guide | Referral link use, attribution rules, commission timing |
| 3 | Operations Manual | Case pipeline stages, responsibilities, service standards |
| 4 | Ambassador Guide | Student-to-student referral programme |
| 5 | Student Service Agreement | Signable contract: fees, scope, what DARB does and does not do |
| 6 | Partner Agreement | Generic signable agreement with a fillable commission schedule |

## Language and layout

Every document is bilingual **Arabic + Hebrew**, both right-to-left:

- Arabic is the primary column, Hebrew the secondary, section by section — so either party can read and sign the same page.
- Page direction is RTL: headings, tables, and signature blocks anchor to the right edge.
- Fonts are embedded from the fonts already on the machine — Noto Sans Arabic for Arabic, Noto Sans Hebrew for Hebrew — so the text shapes correctly and never falls back to boxes.
- Numbers, currency (₪) and dates stay in Western digits in both languages.

## Facts printed as fixed values

These are stated as confirmed and appear as real values:

- Student service fee: ₪4,000
- Referral discount and reward capped at ₪250
- Commission is earned when the student is both paid and enrolled
- Payout by bank transfer to the member's preferred method
- Registration fees are non-refundable
- Jurisdiction: Israel, Haifa courts

## Fields left blank to fill in

Anything that varies per person or per deal stays as a blank line, and every document ends with a "complete before sending" checklist naming its own blanks:

- Commission rates and amounts per member
- Holding period before payout
- Payment windows and notice periods
- Legal entity details on Docs 5 and 6 — registered name, company number, address, signatory (confirmed: leave blank)
- Names, dates, signatures

## Branding

Navy `#0F1B2D` and Gold `#F9B115` from the email brand tokens, with `public/email/darb-logo.png` on the cover and in the running header. Each document gets a cover page, running header with the logo and document title, footer with page numbers, styled section headings, bordered tables, gold highlight boxes for key figures, and signature blocks on the two contracts.

## Quality check before handover

Every page of all six PDFs is rendered to an image and inspected — not just the first page. Specifically checking that Arabic and Hebrew render as joined script rather than boxes or reversed letters, that RTL alignment holds in tables and signature blocks, that no text is clipped or overlapping, that page breaks do not split tables or signature blocks, and that the logo and colours render correctly. Anything broken gets fixed and re-rendered until a full pass is clean. I will report what was checked and what was fixed.

## Technical notes

- Generation with the `docx` npm library via a shared `lib.js` (cover, header/footer, headings, tables, highlight boxes, signature blocks, RTL paragraph defaults), plus one content module per document and a `build.js` orchestrator.
- RTL is set at both the section level (`bidi`) and the paragraph level (`bidirectional`, right alignment) — docx-js does not infer it from the text.
- Font embedding is declared in the document styles and verified in the rendered PDF, since a missing glyph fails silently at the docx layer and only shows up in the render.
- PDF conversion via headless LibreOffice; page rendering for QA via `pdftoppm`. QA images are temporary and are not written to the documents folder.
- Source scripts are written under `/mnt/documents/darb-documents/_source/` alongside the output, so the documents can be regenerated or edited later without rewriting them from scratch.
- No application code, database, or configuration is touched — this is document generation only.
