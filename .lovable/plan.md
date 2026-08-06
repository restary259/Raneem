# Spreadsheet Hub — one place to track everything

Turn the existing single-table admin spreadsheet page into a multi-tab **Spreadsheet Hub**: live tables pulled straight from the database, each one filterable, sortable, and downloadable as Excel. Nothing is typed twice — every row is generated from what already happens in the app (a case is paid, a payout is confirmed, a student is enrolled), so the sheets are always current.

## Tabs

| Tab | What each row is | Key columns |
|---|---|---|
| Students | One enrolled/active student | Name, phone, city, status, team member, partner, school, program, accommodation, insurance, intake, start/end dates, prices, total |
| Payments | One service-fee payment | Date paid, student, service fee, program/accommodation/insurance price, total paid, remaining balance, confirmed by |
| Payouts | One payout to a team member or partner | Date requested, date paid, person, role, linked students, amount, status, method, transaction ref |
| Commissions | One reward line | Created date, person, role, source case/student, amount, status (pending / in request / paid), 20-day unlock date |
| Schools & Programs | One program, accommodation or insurance offering | Name, school, city, type, duration, price, currency, active, number of students placed |
| Taxes (Israel) | One month | Month, gross service fees collected, VAT portion, net before VAT, commissions paid out, net margin, number of transactions |
| Team performance | One team member | Cases assigned, contacted, enrolled, conversion %, commissions earned, commissions paid |

## Who sees what

- **Admin** — all seven tabs, no filtering.
- **Team member** — a trimmed hub with three tabs: My Students, My Commissions, My Performance. Only rows tied to their own `assigned_to`. No platform revenue, no other people's payouts, no partner data.
- **Partners** — unchanged; they keep their current dashboard.

Access is enforced server-side (database rules + a dedicated read function), not by hiding columns in the browser.

## Taxes tab — what it will show

You're based in Israel, so the sheet is built around what an Israeli bookkeeper normally asks for, with the VAT rate stored as a setting you can change (default 18%):

- **Month** (calendar month, Asia/Jerusalem).
- **Gross collected** — total service fees marked paid that month.
- **VAT component** — gross × rate ÷ (1 + rate), i.e. the VAT already sitting inside the price.
- **Net before VAT** — gross minus the VAT component.
- **Commissions paid** — team + partner payouts confirmed that month (your deductible expense side).
- **Net margin** — net before VAT minus commissions paid.
- **Transactions count** — how many students paid that month.
- Yearly total row at the bottom, plus a "download for accountant" Excel export with one sheet per month.

This is a bookkeeping *view*, not tax advice — it gives your accountant the numbers in a shape they can work with. If they later want invoice numbers or a specific Israeli report format (e.g. PCN874-style), that's a follow-up once they tell us the exact fields.

## Excel export

Every tab has a Download button producing a real `.xlsx` (using the export helper already in the project — headers bolded, columns auto-sized, totals row at the bottom, Arabic-safe). There's also a "Download full workbook" button on the admin hub that puts all seven tabs into one Excel file.

## Behaviour

- Live data on every load, plus a refresh button and real-time updates for payments/payouts.
- Date-range filter, status filter, search box, and column picker per tab (the column picker already exists on the current page).
- Numbers and dates formatted with ASCII digits, currency in ILS.
- Fully bilingual (Arabic RTL / English) through the existing translation files.

## Technical notes

- New route `/admin/spreadsheet` becomes a tabbed shell; the current `AdminSpreadsheetPage.tsx` becomes the Students tab.
- One reusable `<SheetTable>` component: takes columns, rows, filters, and an export config — every tab is a thin config on top of it.
- Data sources: `cases` + `case_submissions` (students, payments), `rewards` (commissions), `payout_requests` + `transaction_log` (payouts), `programs`/`schools`/`accommodations`/`insurances` (catalog), aggregation over `case_submissions.enrollment_paid_at` (taxes).
- Taxes aggregation runs as a `SECURITY DEFINER` database function returning monthly rollups, admin-only, so no raw financial rows leak to the client.
- Team-member hub reuses the same components with a server-side scoped read path; no new broad read permissions on `cases` or `rewards`.
- One migration: a `vat_rate` setting on `platform_settings` and the monthly tax rollup function (with grants + admin-only check).
- No CSV anywhere — Excel only.

## Out of scope for this pass

- Two-way editing (the sheets are read-only mirrors; edits still happen in the normal screens).
- Syncing to Google Sheets or an external Excel file.
- Invoice generation / receipt numbering.
