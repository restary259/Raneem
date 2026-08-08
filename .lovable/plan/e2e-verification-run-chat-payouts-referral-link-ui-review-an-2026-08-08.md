# E2E Verification Run — Chat Payouts, Referral Link & UI Review

Goal: run a real end-to-end walkthrough of everything changed in the last round, capture screenshots at every surface, review them for colors/spacing/layout issues, and leave one live payout request pending in your admin dashboard for you to approve manually.

## What the run covers

1. Partner login → Overview, Students, Earnings, Messages.
2. Referral link card: single "Copy Link" button, copy works, no WhatsApp share.
3. Seed a demo case attributed to the partner, move it through the pipeline to paid with `paid_at` backdated past the 20-day hold so earnings become eligible.
4. Partner opens the Admin thread → `+` menu → Request Payout → review dialog → submit.
5. Confirm the structured payout card renders in chat for both sides, with server-computed eligible vs locked amounts in ₪.
6. Stop there — the request is left in `pending` so you approve it yourself from the admin dashboard.
7. Admin login → verify the request appears in the admin thread with approve / mark paid / reject actions visible (no clicks).
8. Data isolation spot-checks: partner cannot see other partners' cases or admin routes; admin identity shows as "Administration" on the partner side.

## Screenshots

Captured at 1280px desktop and 390px mobile for: Partner Overview, Students, Earnings, Messages (thread list + open thread), the payout dialog, the payout card in chat, and the admin inbox view. Reviewed for contrast, token usage (no hardcoded colors), spacing, RTL alignment, and overflow.

## Reporting

A single report listing: what passed, any layout/color defects found with the file responsible, and any functional bug with a proposed fix. No fixes applied in this run unless you say go — if I find a blocking crash mid-flow I'll stop and report it rather than patch silently.

## Technical notes

- Playwright against `http://localhost:8080`, scripts under `/tmp/browser/darb/`.
- Partner session via existing test partner account; admin session via injected Supabase session env vars.
- Demo data written through the same RPCs the app uses (`insert_lead_from_apply` / `create-case-from-apply`, admin mark-paid) so triggers and commission logic run for real; the `paid_at` backdate is a direct SQL update on the seeded case only.
- Seeded records are tagged with a `DEMO-E2E` marker in the case reference/name so they're easy to identify and purge afterwards.
