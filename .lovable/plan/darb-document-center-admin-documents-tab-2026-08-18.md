# DARB Document Center — Admin Documents Tab

A professional, versioned document library inside the Admin Dashboard: create → edit → preview → generate branded PDF → store → download, with archiving and version history. First seeded document: **DARB Agent Operations Guide** in Arabic and Hebrew.

## Confirmed decisions

- **Editor**: structured block editor (typed blocks, no new dependency, full control of PDF layout).
- **PDF engine**: extend the existing jsPDF + jspdf-autotable pipeline, reusing the vendored Noto Naskh Arabic / Noto Sans Hebrew faces already proven on invoices.
- **Scope**: full system plus the Agent Operations Guide in one build.
- **Languages for the first guide**: Arabic and Hebrew (English/German remain possible later — the schema is language-keyed from day one).

## Business-rule conflict to flag (no logic will be changed)

The prompt states Agent direct referral = **25% of the DARB service fee** and Partner/Ambassador = **25%**. The live commission engine uses **flat ILS amounts** configured in the Commission Hub (agent recruitment amount, partner/ambassador pool amount, agent self-referral amount), not percentages.

Handling: documents will render the **live configured amounts** pulled from the Commission Hub, and the Document Center will show an Admin-only banner on the Agent guide reading "Business rule conflict — percentages in source brief vs. flat amounts in the system. Confirm before publishing." No commission code, RPC, or rate is touched.

## What gets built

### 1. Data model (one migration)

- `documents_library` — id, slug, title, subtitle, category, doc_kind (`guide` | `contract` | `form`), language, status (`draft` | `published` | `archived`), current_version, effective_date, description, created_by, updated_by, timestamps.
- `document_versions` — id, document_id, version (e.g. 1.0), content (jsonb block array), change_note, pdf_path, published_at, created_by. Published versions are immutable; editing a published doc creates a new version row.
- Private storage bucket `darb-documents` for generated PDFs, admin-read via signed URLs.
- RLS + GRANTs: admin-only full access; `service_role` full. No anon/authenticated exposure.

### 2. Block content model

Blocks: `cover`, `heading` (numbered), `paragraph`, `list`, `table`, `callout` (info / warning / legal-review), `flow` (visual step diagram for the referral/lock flow), `signature`, `pagebreak`, `disclaimer`. Each block carries per-language text, so Arabic and Hebrew live side by side and RTL is a property of the block, never a guess.

### 3. Variables

`{{recipient_name}}`, `{{agent_name}}`, `{{student_name}}`, `{{date}}`, `{{version}}`, `{{effective_date}}`, plus commission/fee variables resolved live from the Commission Hub RPC at preview/generate time — no hardcoded money in templates. Unresolved variables render as a visible amber placeholder in preview and block PDF generation.

### 4. Admin Documents tab

Route `/admin/documents`, sidebar entry under the settings group.

- Header "DARB Documents" with the stated subtitle.
- Category tabs: All / Contracts / Partners / Students / Agents / Ambassadors / Operations / Archived.
- Search + filters (kind, language, status).
- Rows show name, description, category, kind badge, language, version, status, last updated, created by, with Preview / Edit / Generate PDF / Download / Archive / Restore actions.
- Version history drawer per document.
- Guides and contracts are visually distinct (badge + differing cover/footer treatment) so a guide never reads as a binding contract.

### 5. Editor and preview

Two-pane: block list with add/reorder/duplicate/delete on the left, live A4-proportioned branded preview on the right. Preview mirrors the PDF renderer's spacing rules so what you see is what prints. Mobile falls back to an Edit/Preview toggle.

### 6. PDF renderer

New `src/utils/documentPdf.ts` built on jsPDF:

- Branded cover page (DARB logo, title, subtitle, category, kind, version, effective date).
- Running header (document title + version) and footer (contact info + "Page X of Y").
- Numbered section hierarchy, autoTable tables with brand styling, callout boxes, signature blocks with ruled lines.
- Measure-before-draw pagination so headings never orphan and text never clips or overflows.
- Per-block script detection selecting the Arabic or Hebrew face; RTL blocks are right-aligned with mirrored margins and RTL table column order.
- Generated PDF uploaded to `darb-documents`, path stored on the version row; downloads use signed URLs.

### 7. Seeded Agent Operations Guide

Authored as block content in Arabic and Hebrew, version 1.0, kind `guide`, covering: what DARB is, what an Agent is, Admin-only onboarding, independent-contractor status (no employment claims), responsibilities and prohibited misrepresentations, own-referral commission, network structure diagrams (Agent → Student; Agent → Partner/Ambassador → Student), network commission, Admin approval of recruits and the no-recruiting-Agents rule, earning milestone using the app's own enrolled/paid terminology, the 20-day lock flow, cancellation principle, dashboard visibility, commission transparency, payouts by bank transfer with no invented threshold, and notifications.

Every clause with legal or unresolved business exposure (cancellation/refund treatment, termination, jurisdiction, liability) is rendered as a **LEGAL REVIEW REQUIRED** callout instead of invented language.

### 8. QA before delivery

Generate the Arabic and Hebrew PDFs, render every page to an image, and inspect for clipped text, broken tables, orphaned headings, blank pages, wrong RTL alignment, and pagination errors; fix and re-render until clean. Also exercise create/edit/version/archive/restore and variable resolution.

## Out of scope

No changes to commission logic, rates, existing dashboards, the student `documents` table, or any unrelated route.
