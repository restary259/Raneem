# Referral Attribution — Verification and Fix

## What I checked

Traced the full chain: referral link → apply form → lead → case → commission → partner metrics.

Working today:
- `?ref=` capture and 90-day persistence, and link building for each partner/ambassador.
- Server-side code resolution in `insert_lead_from_apply`: the code is looked up in the database, the client cannot fake a source, and the lead gets `source_id` + `source_attribution_method = 'link'`.
- Commission math itself (`record_case_commission`) pays a flat ₪ amount to whoever is on `cases.partner_id` (fallback `referred_by`), with per-account override winning over the global default.
- Partner and ambassador dashboards read cases by `partner_id` and rewards by user.

## The break

The attribution is lost at the moment a lead becomes a case. When an admin qualifies a lead in the Leads screen, the new case row is created with only name, phone, city and a hardcoded source — the lead's `source_id` is never copied to `partner_id`/`referred_by`, and the real source type is not carried over either.

Confirmed against live data: every existing case has empty `partner_id` and `referred_by`, even though the case was created from a lead.

Consequences: the partner sees zero students and zero earnings, no reward row is created when the student pays, and admin revenue/commission reports attribute everything to the platform.

## Fix

1. Carry attribution through lead qualification: when a case is created from a lead, copy the lead's referral owner into the case and set the case source from the lead's source type. Also stamp the attribution method so reports can tell link referrals from manual entries.
2. Do the same on the "restore existing case" path — if a matching case already exists and has no owner, backfill it from the lead instead of leaving it unattributed.
3. Backfill historical rows: for existing cases created from a referred lead but with no owner, set the owner from the matching lead. Cases whose commission split already ran are left untouched to avoid double payments.
4. Make attribution server-enforced rather than client-set, so a non-admin cannot assign a case to an arbitrary partner (the case financial guard already blocks money columns; the owner columns get the same treatment).
5. Verification pass afterwards: create a lead through a real partner link, qualify it, run it to paid, and confirm one reward row at the correct flat rate, the partner's student count and earnings, and admin platform revenue equal to fee minus commissions.

## Technical notes

- Files: `src/components/admin/LeadsManagement.tsx` (case insert + restore path), `src/pages/team/TeamCasesPage.tsx` (manual creation stays unattributed, by design).
- Database: one migration for the backfill and for a guard on `cases.partner_id` / `cases.referred_by`; no change needed to `record_case_commission`, `insert_lead_from_apply`, or `resolve_referral_code`.
- Match leads to cases by phone number, which is what the current qualification flow already uses.
- Metrics need no change once the columns are populated — the partner pool RPC, earnings page and admin financials all key off `partner_id`.
