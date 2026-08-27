# Partner Guide + Ambassador Guide (Arabic + Hebrew)

Two new cold-outreach guides in the exact visual language of the v5 Agent Guide, one for social-media partners and one for in-person office ambassadors. Nothing in the app, database, or locale files changes — these are documents only.

## Absolute rule: no agent layer

Neither guide mentions an agent, recruiter, network, upline, or "who invited you". The reader's relationship is with DARB directly. Support is phrased as "your DARB contact" only where a contact point is genuinely needed. No wording anywhere implies a middle layer or a share taken from their commission.

## Shared content (both guides)

- Cover in the v5 style: navy field, gold sphere glow, gold bar glyph, outlined arc, no logo circle or wordmark.
- Who DARB is and who the students are, in one short section.
- The role in one sentence, then the value: ₪1,000 per enrolled student, paid per student, no cap, no minimum payout.
- The money rules, stated identically in both languages: commission is earned when the student is marked enrolled and paid; 20-day lock period; payout paid within up to 5 days of approval; bank transfer; no minimum withdrawal.
- Start of work: immediately after the first sign-in to the dashboard — no waiting period, no activation step.
- Dashboard walkthrough with the same mock-panel visual as v5, redrawn for this role's sidebar and KPI tiles (students referred, in progress, enrolled, earnings).
- Step flow: get your link / apply access → bring the student → follow their progress → student enrolls → request payout → paid.
- What DARB handles versus what the reader handles, as a two-column card.
- Do / Don't card (honest representation, no fake promises, no sharing student data).
- FAQ, ending with a short closing card.
- No signature block, no "complete before use" page.

## Partner guide — the differences

- Framing: online reach. Audience is followers, group members, DM enquiries, content viewers.
- Primary tool: the personal referral link. Explained visually — copy the link, put it in bio/story/post, every click and application is attributed automatically, nothing to track manually.
- Content guidance: what kinds of posts convert, what claims are not allowed, using DARB material.
- Dashboard mock emphasises link clicks → applications → enrolled.

## Ambassador guide — the differences

- Framing: in-person presence. Audience is walk-ins, office visits, family and school networks, local events.
- Primary tool: the in-dashboard application form — the ambassador can sit with the student and submit the application on the spot, plus the same referral link for people who prefer to apply themselves.
- Guidance: what to collect in a first conversation, how to hand over cleanly, following up.
- Dashboard mock emphasises submitted applications → in progress → enrolled.

## Output

- `darb-documents/DARB-Partner-Guide-AR-HE.pdf` and `.docx`
- `darb-documents/DARB-Ambassador-Guide-AR-HE.pdf` and `.docx`

Word versions match the PDFs the same way v5 did: the rendered cover and the dashboard mock are embedded as high-resolution images, all body text stays real editable Arabic and Hebrew text with RTL direction.

## Technical notes

The v5 generator lived in a scratch directory that has since been cleared, so it is rebuilt: an HTML/CSS template rendered to A4 via headless Chromium (Noto Sans Arabic + Noto Sans Hebrew, navy `#0F1B2D` / gold `#F9B115`), reusing the v5 block kinds (`cover`, `section`, `cards`, `table`, `flow`, `stats`, `mock`, `pbreak`) with a shared stylesheet and two content files, one per role. The docx builder shells `pdftoppm` for the cover image and screenshots the mock element, then writes the body as editable RTL text.

QA: every page of all four files is converted to an image and inspected for Arabic joining, Hebrew rendering, RTL direction, overflow, footer collisions, and cover fidelity, and regenerated until clean.
