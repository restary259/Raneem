# Corporate Excel Export Engine + Connector Review

## Part 1 — Professional export engine

Today all exports go through `src/utils/exportUtils.ts` (`exportXLSX`, `exportWorkbook`, `exportPDF`) and produce bold headers plus auto-width columns — nothing else. Six call sites use it: `SpreadsheetHub.tsx`, `SheetTable.tsx`, `PayoutsManagement.tsx`, `MoneyDashboard.tsx`, `LeadsManagement.tsx`, `StudentCasesManagement.tsx`.

### New module: `src/utils/export/`

- `theme.ts` — single source of truth: Darb navy header, light zebra fill, border colors, status tints (green/amber/red/blue/grey), Calibri 11 body / 11 bold header / 16 title, row heights, margins.
- `formats.ts` — reusable number formats: `₪#,##0.00;[Red](₪#,##0.00);"—"`, integer, percent `0.0%`, `dd/MM/yyyy`, `dd/MM/yyyy HH:mm`, plain text.
- `corporateSheet.ts` — the engine. Given a sheet definition it renders:
  - branded header block (company name, report title, subtitle, generated timestamp in Asia/Jerusalem, exported-by name) in merged cells above the table;
  - the data as a real Excel Table (`ws.addTable`) with a banded style so filtering and striping are native;
  - per-column type (`text | number | currency | percent | date | datetime | status`) driving number format and alignment — numeric/date right, text left, status centred;
  - status cells tinted from the theme palette, plus conditional formatting (data bars on currency columns, red text on negative amounts, amber on overdue dates);
  - a bold totals row for any column marked `total: 'sum' | 'count' | 'avg'`, with a top double border;
  - frozen panes below the header row, auto-sized columns (min 10 / max 45, Arabic-aware width factor), print setup: A4, fit-to-width, landscape when >7 columns, repeat header rows on every page, footer with page X of Y and confidentiality line.
- `index.ts` — public API: `exportCorporateWorkbook(report)` where `report = { fileName, title, subtitle?, author?, sheets: SheetDef[] }`, plus a compatibility `exportXLSX`/`exportWorkbook` wrapper so existing call sites keep working while they migrate.

RTL: when the active locale is Arabic the sheet gets `views: [{ rightToLeft: true }]` so Arabic reports open correctly in Excel.

### Migration of call sites

Each of the six call sites moves to the new API and declares column types instead of pushing raw strings:

- `SpreadsheetHub.tsx` — every tab (Students, Payments, Payouts, Commissions, Catalog, Taxes, Performance) becomes a typed sheet; the "export all" workbook becomes one branded multi-sheet report with a cover sheet listing scope, filters and row counts.
- `SheetTable.tsx` — per-sheet export inherits the same engine, carrying the translated enum labels already in place.
- `MoneyDashboard.tsx`, `PayoutsManagement.tsx` — financial reports gain currency formatting, totals rows and negative-value highlighting.
- `LeadsManagement.tsx`, `StudentCasesManagement.tsx` — CRM/case reports gain status tinting, date formatting and filtered tables.

Author = the signed-in user's display name from the auth/profile context; omitted when unavailable.

The PDF path (`exportPDF`) is realigned to the same theme tokens so PDF and Excel look like the same document family.

### Verification

- Unit tests for `formats.ts` and column-type inference.
- A node script generates one sample of each report type, reopens it with ExcelJS, and asserts: table present, freeze pane set, header styled, totals row correct, no `#REF!`/`#VALUE!`.
- Existing Playwright spreadsheet suite extended to click each export and assert a non-empty `.xlsx` download.

## Part 2 — Connector review (verified against this workspace's catalog)

All connectors currently available, by category:

- **CRM / Sales**: HubSpot, Salesforce, Pipedrive, Zoho CRM, Apollo.io, Attention, Ashby (ATS)
- **Communication**: Slack, Microsoft Teams, Telegram, Twilio (SMS/voice), GatewayAPI (SMS/RCS), LinkedIn, X, TikTok, Twitch
- **Email**: Gmail, Microsoft Outlook, Resend, Mailgun, Brevo
- **AI**: built-in Lovable AI, Perplexity, Fireworks AI, Replicate, ElevenLabs, Gemini Enterprise
- **Payments / Billing**: Stripe, Paddle (both seamless), Chargebee, Lightspeed, Shopify, WooCommerce, PrestaShop, Wix
- **Accounting**: Xero, Zoho Books, Wave, Lexware, sevDesk
- **Analytics**: Google Analytics, PostHog, Google Search Console, Semrush, dbt Semantic Layer
- **Databases / Warehouse**: Supabase (Cloud, in use), BigQuery, Snowflake, Databricks, ClickHouse, Redshift, AWS Athena, Microsoft Fabric, Airtable, Algolia
- **Storage / Documents**: Google Drive, Google Docs, Google Sheets, Google Slides, AWS S3, Microsoft OneDrive, Excel, Word, PowerPoint, SharePoint, OneNote, Notion, Contentful, Storyblok, WordPress (x2)
- **Calendar / Scheduling**: Google Calendar, Calendly
- **Forms**: Tally
- **Automation**: Inngest
- **Meetings**: Fireflies, Granola
- **Security**: Aikido, Wiz
- **Other**: Google Maps, Mapbox, Firecrawl, Apify, GitHub, Logo.dev, KLIPY

### Recommended for Darb, by priority

**Critical**
1. **Twilio or GatewayAPI (WhatsApp/SMS)** — Israeli-Arab students and partners live on WhatsApp; appointment reminders and status changes by SMS/WhatsApp cut no-shows and shorten the pipeline more than any other integration. Complexity: medium (templates, opt-out, delivery log). Maintenance: low. Impact: high.
2. **Resend (transactional email)** — the platform already sends visa/status emails via a trigger; a dedicated provider gives deliverability, a domain, and bounce visibility instead of silent failures. Complexity: low. Impact: high.

**High value**
3. **Google Calendar** — two-way sync of team appointments so lawyers work from their own calendar; removes the biggest manual step in the appointment stage. Complexity: medium (per-user OAuth via App User Connectors, not a shared account). Maintenance: medium.
4. **Google Drive** — auto-file each generated corporate report and student document set into a per-case folder; gives the audit/compliance trail lawyers and banks expect. Complexity: medium. Maintenance: low.
5. **Slack or Teams** — internal alerts for SLA breaches, new leads, payout requests and the existing auth-failure spike monitor. Complexity: low. Impact: medium-high on admin productivity.
6. **Stripe or Paddle** — collecting the enrollment/service fee in-app instead of manual "mark as paid" removes the reconciliation gap the money audit surfaced. Complexity: medium-high (refunds, reconciliation with `case_payments`). Impact: high once volume grows.

**Nice to have**
7. **Xero or Zoho Books** — push monthly VAT/tax rollups into real accounting instead of Excel hand-off. Only worth it once transaction volume justifies it.
8. **PostHog** — funnel analytics on the apply flow (which step Israeli-Arab applicants abandon). Low complexity, good SEO/conversion feedback.
9. **Google Sheets** — live mirror of the Spreadsheet Hub for partners who insist on Sheets. Complexity: low; overlaps with the new export engine, so optional.

**Future expansion**
10. Airtable / BigQuery — only if reporting outgrows Postgres.
11. Calendly — redundant with Google Calendar + the in-app scheduler; consider only for public partner booking pages.
12. Aikido or Wiz — continuous security scanning once the platform handles significantly more PII.

### Explicitly not recommended
- **Shopify, WooCommerce, PrestaShop, Lightspeed, Wix, Chargebee** — e-commerce/subscription billing; Darb sells a one-off advisory service.
- **Salesforce, HubSpot, Pipedrive, Zoho CRM, Apollo, Ashby** — the app already *is* the CRM; adding one duplicates the case pipeline and splits the source of truth.
- **Semrush, Firecrawl, Apify, Algolia, Snowflake, Databricks, ClickHouse, Redshift, Athena, Fabric, dbt** — either already covered (SEO tooling) or warehouse-scale infrastructure with no data volume to justify it.
- **ElevenLabs, Replicate, KLIPY, TikTok, Twitch, Logo.dev, Maps/Mapbox, Notion, Contentful, Storyblok, WordPress** — no workflow in this platform consumes them.

### Sequencing note
Part 1 (export engine) is self-contained and ships first. Each connector in Part 2 is a separate approval — connecting one requires your consent in a connect card, so nothing is linked as part of this plan.

## Technical notes
- Engine built on the existing `exceljs` dependency; no new packages.
- Currency defaults to ILS (₪); the format helper accepts EUR for German-facing university reports.
- Locale, translated enum labels and the Jerusalem timezone already used by the Spreadsheet Hub are reused, so exports match what is on screen.
- Column definitions live next to each report, not in the engine, so future exports inherit styling automatically by declaring types only.
