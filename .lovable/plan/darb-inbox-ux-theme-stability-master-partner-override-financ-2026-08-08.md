# Darb — Inbox UX, Theme Stability, Master Partner Override & Finance Audit

## 1. Applications Inbox (`/admin/inbox`) layout rebuild

Current state: the page header holds three filter buttons (All / Partnership / Contact) that filter `contact_submissions` by `form_source`, while a *second* search + Export toolbar lives inside `ContactsManager` further down the page, under the master-partner recruits block. That is why the tabs feel duplicated and the search bar looks stranded in the middle of the page.

Rebuild as one coherent page:

```text
┌──────────────────────────────────────────────────────────┐
│ [icon] Applications Inbox            (new count badge)   │
│        Partnership and contact form submissions          │
├──────────────────────────────────────────────────────────┤
│ [ Search name / email / phone ]        [ Export CSV ]    │  ← sticky toolbar, top
│ ( All 12 ) ( Partnership 5 ) ( Contact 7 ) ( Recruits 2 )│  ← real tabs w/ counts
├──────────────────────────────────────────────────────────┤
│  tab content: submission cards / recruit cards           │
└──────────────────────────────────────────────────────────┘
```

- Move search + Export out of `ContactsManager` and into the page toolbar; `ContactsManager` becomes a pure list that receives already-filtered rows. One search box, one Export button, both above the list.
- Replace the three ad-hoc buttons with a real `Tabs` bar including live counts, and add the master-partner recruits block as a fourth tab instead of an always-visible panel above everything. Empty tabs show a proper empty state, not "No submissions yet" under an unrelated block.
- Search covers name, email and phone; Export exports what is currently filtered (not the full list, which is the current behaviour).
- Card polish: remove the hardcoded `border-amber-300 bg-amber-50/30` "new" styling (invisible/ugly in dark mode) in favour of semantic tokens; tighten spacing, align status/actions to the row end, keep RTL-safe (`ms/me`, `start/end`).

## 2. Dark mode: stop it breaking, extend it, restyle the accent

Root cause found: `DashboardLayout` manually mirrors the theme onto `<html>` with `root.classList.toggle("dark", ...)` **and a cleanup that removes `dark` on unmount**, while `next-themes` (`attribute="class"`) also owns that same class. When the layout remounts (role switch, route change between dashboard shells, HMR), the cleanup strips `dark` and next-themes does not re-apply it because its state never changed — the app is left in light mode with the toggle still saying "dark". That is the intermittent breakage.

Fix:
- Remove the manual class toggling from `DashboardLayout` entirely and let `next-themes` be the single owner of the `dark` class.
- Keep the public/marketing site light-only by scoping the theme, not by mutating the class: force light on non-dashboard routes via a small route-aware wrapper that sets `forcedTheme="light"` for public routes, so dashboards keep the persisted `darb-theme` value across navigation and reloads.
- Toggle availability: `ThemeToggle` already renders in the shared `DashboardLayout` header, which admin, team, student and partner (via `PartnerDashboardLayout`) all use. Verify it is visible and working in each of the four shells (admin, team, partner/ambassador, student), including mobile, and fix any header that hides it at small widths.
- Sweep dashboard components for hardcoded light-only colours (`bg-amber-50`, `bg-white`, `text-slate-*`, `from-slate-900`, etc.) and replace with semantic tokens so nothing goes unreadable when dark flips on.

Accent colour change: in dark mode the dashboards currently use gold (`--primary: 41 96% 58%`) for buttons, active nav and badges. Replace the dashboard accent with a Lovable-style neutral — near-white primary on charcoal (`--primary: 0 0% 96%` / `--primary-foreground: 240 6% 10%`), with subtle neutral hover and focus rings. Gold stays as `--brand` for the public marketing site and logo only, so brand identity is preserved. Light-mode dashboards keep their existing dark-on-light primary; the yellow accents inside dashboard chrome get swapped to neutral for consistency.

## 3. Master Partner: direct override instead of negotiated offers

Today a master partner opens `RateOfferDialog` → `master_send_rate_offer` → the recruited partner sees `RateOfferInbox` and must accept before the split changes. You sign the split in-office, so the acceptance round-trip is pure friction.

New behaviour:
- Master partner sets the recruited partner's per-case amount directly (`Set rate` instead of `Negotiate rate`), effective immediately, within the same pool guardrails: `0 ≤ partner_amount ≤ pool`, master keeps the difference, Darb's total per-case cost is unchanged.
- New RPC `master_set_partner_rate` writes the effective split straight to the partner's rate record, records who changed it, the old and new value, and an optional note, and appends an audit-log row. Server-side it still verifies the caller is the master partner of that specific partner.
- The confirmation dialog states the change is immediate and per the signed agreement, and shows the before/after split.
- The recruited partner no longer receives an approval request; instead their earnings page shows the current agreed rate plus a change history (date, old → new). `RateOfferInbox` is removed from the partner dashboard.
- Existing pending offers are auto-resolved (superseded) so nobody is left with a stale request. The `partner_rate_offers` table is kept as the history log rather than dropped.
- `COMMISSION_RULES.md` gets a short note that the pool split is set by the master partner per signed contract; the stackable ₪200 override layer is unchanged.

## 4. Finance math audit across dashboards

A read-only reconciliation pass before any numbers change, covering: case fee → partner payout → team commission → master override → Darb margin, and how each surface totals them (admin financials, spreadsheet hub, partner earnings, master network page, case finance tab, payout requests).

Checks:
- Every surface derives from the same commission source rather than re-deriving totals client-side; flag any place that recomputes.
- Direct-partner and master-recruited cases both reconcile: partner + team + master override + Darb margin equals the case fee, with no double-counting of the override.
- Payout requests, approved payouts and pending balances agree with commission rows, and the 20-day hold is applied consistently.
- Currency and locale formatting is ₪ with `en-US` digits everywhere.

Findings are reported back with exact figures per case; any discrepancy is fixed in the same pass, with the numbers re-verified against the database afterwards.

## Technical notes

- Files: `src/pages/admin/AdminInboxPage.tsx`, `src/components/admin/ContactsManager.tsx`, `src/components/admin/RecruitApplicationsPanel.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/main.tsx`, `src/index.css`, `src/components/partner/RateOfferDialog.tsx`, `src/components/partner/RateOfferInbox.tsx`, `src/pages/partner/PartnerNetworkPage.tsx`, `src/components/admin/PartnerProfilePanel.tsx`, finance pages under `src/pages/admin/` and `src/pages/partner/`.
- Database: one migration adding `master_set_partner_rate` (SECURITY DEFINER, master-ownership check), superseding pending offers, and keeping `partner_rate_offers` as history.
- All new strings go through `t()` with Arabic and English entries; no inline RTL ternaries.
- Verification: existing Vitest suite plus new tests for the direct-override RPC path and a theme-persistence test; Playwright screenshots of the inbox and each dashboard in light and dark.
