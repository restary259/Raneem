# DARB Business Documents & Contracts (editable, branded)

Six finished, DARB-branded documents delivered as **editable Word files (.docx)** plus a matching **PDF** of each for instant sending. No app functionality, no document tab, no builder — just the finished files in your downloads.

## What you confirmed

- **Commission amounts are per-person.** Every figure is left as a clearly marked fill-in field (e.g. `₪ ___________`) with a short note, because each agreement differs. No invented numbers anywhere.
- **Commission trigger:** earned when the student is confirmed **paid and enrolled**.
- **Payout:** bank transfer to the member's preferred method (bank account, PayPal, etc.), requested from the dashboard after approval.
- **Student service fee:** ₪4,000.
- **Refunds:** possible, **except registration fees already paid to third parties** (non-refundable).
- **Referral discount:** up to ₪250. **Referral reward:** up to ₪250.
- **Location/law:** Israel, Haifa. Remaining legal details (entity name, registration number, address, notice periods) stay as fill-in fields since each contract is customised.

## Design

Branded to match the DARB emails: orange (`#F97316`) accent on charcoal/white, DARB logo on the cover and in the header, page numbers and confidentiality line in the footer, section hierarchy, highlight boxes, clean tables, signature blocks, and a version/date line. Fully editable in Word / Google Docs afterwards.

## The six documents

1. **DARB Agent Partnership & Operations Guide** — what an Agent is, how they work with DARB, their personal referral link and how attribution works, earning on own referrals vs. on recruited Partners/Ambassadors (Agent → Partner → Student diagram), when commission is earned vs. payable, what happens if a student cancels or doesn't complete payment, dashboard walkthrough (referrals, students, pending/approved/paid commissions, payout requests), Agent responsibilities, DARB responsibilities, rules.
2. **DARB Social Media Partner Program Guide** — joining, referral link, referring students, tracking, earnings and payment, what DARB handles vs. the partner, marketing expectations, what may and may not be promised to students, rules, termination.
3. **DARB Partner Operations Guide** — the plain-language overview of the whole referral model: what DARB is, how students are helped, what happens after a referral, who handles the student, tracking, commission calculation and payability, payment, and escalation if something goes wrong. Suitable as a first document to any prospect.
4. **DARB Ambassador Partnership Program** — aimed at lawyers, notaries, offices and consultants with existing client networks. Full flow diagram (Ambassador → Student → DARB → Successful Case → Commission), referral handover, tracking, commission and payment conditions, cancellation rules, responsibilities on both sides.
5. **DARB Student Service Agreement** — student and case details, DARB's services, fee of ₪4,000 with what is and isn't included (school/university fees, accommodation, insurance, visa and third-party costs), payment structure, refund clause with non-refundable registration fees, referral discount up to ₪250, student responsibilities (accurate information, documents on time, deadlines, laws, school and visa rules), a fair statement that admission and disciplinary decisions belong to the institution, DARB's responsibilities, acknowledgment section, and signature blocks for student and DARB representative.
6. **DARB Partner / Agent / Ambassador Agreement** — the signable counterpart to the guides. Role selector, term and termination, commission schedule table (amounts blank for you to complete), payment terms, confidentiality, conduct and representation limits, independent-contractor status, governing law (Israel, Haifa courts), and signature blocks.

## Every blank you fill in

Each document ends with a short "Fields to complete before sending" checklist so nothing is missed: commission amount, payout timing, entity/registration details, notice period, and the recipient's name/date.

## Technical notes

- Generated with `docx` (Node) for the Word files, converted to PDF via LibreOffice.
- DARB logo taken from the existing brand asset in the project; colours match `--brand`.
- Every page of every output is rendered to an image and visually reviewed for layout, page breaks, table alignment and typography before delivery.
- Output written to `/mnt/documents/darb-documents/` for direct download. No project source files are changed.
