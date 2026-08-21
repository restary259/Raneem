# DARB Agent Guide — Arabic + Hebrew

## Goal

Generate **only the DARB Agent Guide** as a finished bilingual business document.

Do **not** generate, design, or prepare any other documents.

## Deliverables

Create the **Agent Guide** in both:

- `.docx` — editable
- `.pdf` — print-ready

Save both files permanently in:

`/mnt/documents/darb-documents/`

The document should be ready to download and use immediately.

## Purpose of the Agent Guide

The document should clearly explain the role of a **DARB Agent**, including:

- What a DARB Agent is
- How an Agent represents DARB when recruiting
- How Agents recruit Partners and Ambassadors
- Who Agents are expected to approach
- How recruited Partners/Ambassadors participate in DARB's referral network
- The Agent's responsibilities
- Professional and ethical expectations
- How Agent commissions work
- When commission becomes earned
- How payouts work
- Any applicable holding period or payment timing
- What information must be completed before the document is used

Keep the document focused specifically on the **Agent role**. Do not turn this into a general DARB operations manual or ecosystem guide.

## Language

The document must be **Arabic + Hebrew**.

- Arabic is the primary language.
- Hebrew is the secondary language.
- Both languages must be written correctly in RTL.
- Present the corresponding Arabic and Hebrew content section-by-section so the two versions are easy to compare.
- Use Western digits for numbers, dates, and currency.
- Currency: ₪.

## Confirmed Business Facts

Use these as fixed values:

- Student service fee: **₪4,000**
- Referral discount/reward: **maximum ₪250**
- Commission is earned when the student is **both paid and enrolled**
- Payout is made by **bank transfer** using the member's preferred payment method
- Registration fees are **non-refundable**
- Jurisdiction: **Israel**
- Courts: **Haifa courts**

Do not invent additional business facts.

## Variable Information

If information is not confirmed, leave it blank rather than inventing it.

Examples:

- Agent name
- Commission rate
- Commission amount
- Holding period
- Payment window
- Effective date
- DARB legal entity information
- Names
- Signatures
- Dates

Include a short **"Complete Before Use"** section at the end listing the information that still needs to be filled in.

## Design

Use DARB branding:

- Navy: `#0F1B2D`
- Gold: `#F9B115`
- DARB logo: `public/email/darb-logo.png`

Create a professional business-document appearance with:

- Cover page
- DARB logo
- Document title
- Running header
- Page numbers
- Clear section hierarchy
- Professional tables where useful
- Gold highlight boxes for important figures
- Signature section if appropriate

Keep the design clean and professional. Do not over-design it.

## RTL and Font Requirements

Arabic and Hebrew must render properly.

Use appropriate installed fonts, preferably:

- Noto Sans Arabic
- Noto Sans Hebrew

Ensure:

- Arabic letters are joined correctly
- Hebrew letters render correctly
- No reversed text
- No missing-glyph boxes
- Tables respect RTL
- Headings and paragraphs align correctly
- Numbers and ₪ remain readable

## Quality Assurance

Before finishing:

1. Generate the `.docx`.
2. Convert it to `.pdf`.
3. Render **every page** of the PDF for inspection.
4. Check every page for:
  - Correct Arabic rendering
  - Correct Hebrew rendering
  - Correct RTL direction
  - No clipped text
  - No overlapping elements
  - No broken tables
  - Correct page breaks
  - Correct logo rendering
  - Correct colours
  - Correct page numbers
5. Fix any problems found.
6. Re-render and inspect again until the Agent Guide passes the full check.

## Important Scope Restriction

**ONLY generate the Agent Guide.**

Do not generate:

- Social Media Partner Guide
- Operations Manual
- Ambassador Guide
- Student Service Agreement
- Partner Agreement
- Documents Center
- PDF builder
- Document-generation interface
- Application code
- Database changes
- Configuration changes
- Any unrelated files

The task is simply to produce the finished **DARB Agent Guide in Arabic + Hebrew as DOCX and PDF**.