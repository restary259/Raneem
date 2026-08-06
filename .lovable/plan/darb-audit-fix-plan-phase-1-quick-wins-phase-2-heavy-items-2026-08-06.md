# Darb — Audit & Fix Plan (Phase 1 quick wins, Phase 2 heavy items)

Decisions locked in: referral links use `https://darb.agency`, commissions stay flat ₪ only (no percentages), work is split into two phases.

---

## Phase 1 — Quick wins

### 1. Branded referral links
Today `buildReferralUrl()` in `src/lib/referral.ts` uses `window.location.origin`, so links copied from the preview leak the `lovableproject.com` sandbox URL.

- Introduce a single canonical site constant (`https://darb.agency`) and build every referral link from it, never from `window.location.origin`.
- Applies everywhere links are shown: partner/ambassador/student referral cards and the admin team list.
- Note: the domain must be connected in Project settings > Domains for these links to resolve. I'll flag this; I can't connect it for you.

### 2. WhatsApp sharing
`ReferralLinkCard.tsx` opens `wa.me` with the message and URL concatenated. Fix to a clean, short Arabic/English pre-written message ending with the branded link on its own line, so WhatsApp renders one tidy preview.

### 3. `{{n}} students` placeholder
`partner.earnings.studentCount` is defined as `"{{n}} students"` but called with `{ count: ... }`, so the token never interpolates. Fix the call sites in `PartnerEarningsPage.tsx` (and audit every other `{{n}}` / `{{count}}` key for the same mismatch) so it renders `0 طالب` / `15 طلاب` correctly per language.

### 4. Per-partner commission overrides
The tables and UI already exist (`partner_commission_overrides`, `team_member_commission_overrides`, `CommissionSettingsPanel`). Work needed:
- Make sure ambassadors are selectable in the override picker, not only partners.
- The panel is currently hardcoded English ("Partner commission saved ✓", "No team member commissions configured yet") — move all of it to translations.
- Show each account's effective rate (override, else global default) in the admin team list.

### 5. Safety override for "Show All Cases"
Enabling broad case visibility for a partner/ambassador will require an admin re-authentication step (admin password, reusing the existing `verify-admin-password` function and `admin_security_sessions`) plus a typed confirmation. Cancelling leaves the setting untouched. The action is written to the audit log.

### 6. Forced password change on first login
`profiles.must_change_password` already exists and is set for new accounts, but only the student auth path acts on it. Add a global blocking gate: any signed-in user with the flag set is routed to a mandatory "set a new password" screen — strength requirements, confirm field, no dashboard access until it succeeds.

### 7. Translations pass (day names, dates, statuses)
Several places format dates with a hardcoded `'en-US'` locale (team calendar/appointments, money dashboard, payouts panel, student cases). Introduce shared date helpers that follow the active language for weekday/month names while keeping Western digits (0–9) as required. Sweep the dashboards for remaining hardcoded English strings.

### 8. Referral codes explained
Codes like `ambassador-2c84` are the stable public identifier resolved server-side (`resolve_referral_code`) so a spoofed link can never credit the wrong account — that's why they aren't just the person's name. Improvements:
- Generate codes from the person's name (e.g. `sara-ahmad`) with a short suffix only when needed for uniqueness.
- Show code + auto-built link together, one-click copy, in both the admin team list and each partner's dashboard.
- Admin gets a per-partner referral breakdown (leads/cases attributed, conversion, earnings).

---

## Phase 2 — Heavy items

### 9. Schedule Center (مركز الجداول) advanced filters
Add a filter bar above the sheets: month, year, student search, university/school, language school, assigned team member, status, intake semester. Filters are combinable, reflected in the row count, the totals row, and the Excel export.

### 10. Full-page submitted case view
Replace the side panel behind "Open Full File" with a dedicated route (`/admin/cases/:id`) presenting a complete CRM profile: student profile and personal details, contacts, documents and uploaded files, university, language school, accommodation, insurance, payments and balance, visa information, timeline and status history, assigned team members, internal notes. Team members get the same page scoped to their own cases.

### 11. Expense & invoice breakdown
When a team member composes a case (program, school, accommodation, insurance, services), generate a live financial breakdown: application fees, tuition, university fees, accommodation, health insurance, semester contribution, visa costs, service fee, other. Split into monthly / yearly / one-time / grand total, printable and exportable so it can be shown to the student before submission.

### 12. Admin management center
Consolidate team and partner management into one page: activity, permissions, commission rate, performance, password reset, disable account, submitted cases, workload.

### 13. Final audit
Full sweep: broken workflows, missing translations, permission checks, mobile responsiveness, currency/number formatting, database consistency, performance, accessibility, error handling, loading states, form validation, navigation clarity. Ends with typecheck, unit tests and the Playwright E2E suite.

---

## Technical notes

- Referral base URL: one exported constant used by `buildReferralUrl`; no component builds links from `window.location`.
- Forced password change: implemented as a guard around the authenticated routes so it cannot be skipped by deep-linking.
- Safety override: reuses the existing admin security-session mechanism, so approval expires rather than persisting.
- Money stays flat ₪ throughout; no schema change for percentage commissions.
- Dates: shared helpers replacing scattered `toLocaleDateString('en-US')`, language-aware names with Latin digits.
