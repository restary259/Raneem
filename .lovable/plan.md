# Agent Guide v4 — v2 cover styling, no signature page, matching Word file

## What changes

**1. Cover page — bring back the v2 design**
The v3 cover is a plain navy page. Restore the richer v2 cover treatment:
- Large soft gold sphere glow in the top-right corner
- Gold vertical bar glyph on the left
- Thin outlined arc in the lower-left
- Same title / subtitle / paragraph / chips / footer block that v3 already has (current commission wording and rules stay)

Removed as requested:
- The gold dot + "DARB درب" lockup at the top of the page (circle and words)
- No other logo or wordmark is reintroduced anywhere

**2. Remove the signing section**
The final "توقيع الوكيل / חתימת הסוכן / توقيع ممثل درب / التاريخ" signature block is deleted from the guide (both languages). This is a guide, not a contract. If that leaves the last page thin, the closing section is merged upward so there is no near-empty page.

**3. Word version matches the PDF**
The .docx currently uses a plain text cover because Word can't draw gradients. Fix: render the finished PDF cover page to a high-resolution image and place it as a full-bleed, full-page picture as page 1 of the Word file, followed by a page break. The rest of the document keeps its current structure but is aligned to the PDF: same section order, same headings, same navy/gold colors, same bilingual two-column arrangement, same page breaks, and the signature block removed there too.

## Output

New versioned files (originals kept):
- `darb-documents/DARB-Agent-Guide-v4-AR-HE.pdf`
- `darb-documents/DARB-Agent-Guide-v4-AR-HE.docx`

## Technical notes

- `/tmp/agentguide/build_pdf.py`: port the v2 cover CSS (radial-gradient sphere, `.bars` glyph, arc) into the v3 stylesheet; delete the `.sign` CSS and the `signature` branch in the block renderer.
- `/tmp/agentguide/content.py`: drop `dict(kind="signature")` from the content list.
- `/tmp/agentguide/build_docx.py`: remove the `signature` branch; add a cover step that shells `pdftoppm -r 200` on page 1 of the freshly built PDF and inserts it with zero page margins on the first section, then restores normal margins for the body section.
- QA: convert both outputs to per-page images and inspect every page for overflow, clipped RTL text, footer collisions, and cover fidelity; iterate until clean.
