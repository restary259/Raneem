# Darb — Phase C (Case Communication) + MAWISTA Insurance Catalog

Two tracks in one pass: finish the overhaul blueprint's communication phase, and turn the insurance record into a real product entry with the MAWISTA Expatcare details you actually sell.

## Where we are

- Phase A (core: services + payments finance summary, admin approve flow) — done
- Phase B (4 dashboard shells: team work queue, admin command center, student next steps, partner overview) — done
- Post-B: case detail rebuilt (3 tabs + stage rail), program/accommodation catalog with tiered pricing — done
- Phase C (communication) — not started, this plan
- Phase D (AI guardrails + final audit) — after this

---

## Track 1 — Phase C: case-linked messaging

Today the only chat in the app is the public AI advisor widget. There is no way for a student to ask their handler a question inside the platform, so everything happens on WhatsApp and never lands on the case record.

What gets built:

- **One thread per case**, with two visibility levels:
  - *Internal* — admin and the assigned team member only (and partner never).
  - *Shared with student* — student sees and can reply.
- **Where it appears**
  - Case detail (team/admin): a fourth tab "المراسلات / Messages", with an internal/shared toggle on the composer.
  - Student dashboard: a "Messages" panel on their case, shared thread only.
  - Admin command center: an unread-messages queue card next to the existing review queues.
- **Notifications**: each new message creates a row in the existing `notifications` table for the counterpart (student ↔ assigned team member, admin cc), so the bell already in the header lights up. No email/WhatsApp in this phase.
- **Timeline**: message activity is logged to `case_events` as a lightweight event (count, not content) so history stays complete without duplicating text.
- **Attachments**: out of scope for this phase — documents keep going through the existing Documents flow, and a message can reference one.

Rules enforced server-side, not in the UI: a student can only read/write shared messages on their own case; a team member only on cases assigned to them; admin everywhere; partners have no access to message content at all.

## Track 2 — MAWISTA insurance as a real catalog product

The uploaded PDF is the Expatcare Premium terms and conditions — it contains the product scope but no price table, so pricing stays admin-entered.

- Extend the insurance record with: provider, product name, coverage scope (worldwide incl. USA/Canada), billing basis (monthly, in advance), min/max term (1–60 months), max insurable age (75), waiting periods (3 months pregnancy, 8 months childbirth/dentures/visual aids), and a public link to the terms document.
- Seed **MAWISTA Expatcare Premium (worldwide incl. USA/Canada)** as an active product; you fill in the monthly premium in the admin screen.
- Admin → Programs → Insurance tab gets these fields plus a "view terms" link.
- Case → Program & Finance shows the selected insurance with monthly premium × months so the ₪ total is honest instead of a flat number, and the student sees the same breakdown with the terms link.
- The T&C PDF is stored as a hosted asset and linked, not embedded in the repo.

Everything is added in Arabic and English, ₪ formatting and en-US digits as usual.

---

## Technical notes

- New table `case_messages` (case_id, author_id, author_role, body, visibility internal|shared, read_at markers) with GRANTs, RLS scoped by role, plus a `case_message_reads` marker table or per-user last-read timestamp for unread counts. Realtime subscription reuses `useRealtimeSubscription`.
- Message send goes through an RPC (`send_case_message`) so author identity comes from `auth.uid()` and visibility rules can't be forged client-side; notification insert happens in the same function.
- New components: `src/components/cases/CaseMessages.tsx`, student-side panel, admin queue card. Service logic in `src/services/CaseMessageService.ts` following the existing service-layer pattern.
- Insurance: migration adds columns to `public.insurances` (`provider`, `billing_period`, `min_months`, `max_months`, `max_age`, `coverage_scope`, `waiting_periods` jsonb, `terms_url`, `description_ar`/`description_en`), keeps existing rows valid with defaults. `case_submissions.insurance_price` becomes the computed monthly × months at selection time — existing rows untouched.
- Tests: unit tests for message visibility resolution and insurance total math; Playwright coverage for team→student message round trip.

## Order

1. Insurance migration + seed + admin fields (fast, unblocks correct case totals)
2. Case finance/program display of insurance months
3. `case_messages` schema + RPC + RLS
4. Team/admin case Messages tab
5. Student messages panel + notifications + admin unread queue
6. Translations, tests, verification pass
