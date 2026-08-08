# Darb — MAWISTA pricing, staff chat surface, and Phase D

## 1. Fix the €0 insurance price

The MAWISTA product exists in the catalog but its price is 0, because the terms PDF you uploaded contains no rates. Insurance is also billed monthly, so a single number is not enough.

What to build:
- Add **age-banded monthly rates** to insurance products (same idea as the program price tiers, but the band is the student's age): each row is `from age`, `to age` (empty = open ended), `monthly price`.
- Admin catalog gets a small rate editor on the insurance dialog, next to the existing product fields; the base `price` becomes the fallback used when no band matches.
- The rates are left **empty for you to fill in** — no invented numbers. Until a rate is entered, the case page shows "price not set yet" instead of €0.
- Case Program & Finance shows: matched band → `€rate/month × N months = €total`, and names the band used.
- The case financial summary uses that computed total instead of a hardcoded stored value when the stored value is 0.

## 2. Chat between admin and team (visible surface)

The chat exists today only inside a case (Messages tab), so it is easy to miss. Add a real inbox:
- New **Messages** page for admin (`/admin/messages`) and team (`/team/messages`) listing every case thread the user may see: case name + reference, last message preview, time, unread badge, newest first.
- Selecting a thread opens the conversation in the same page (two-pane on desktop, stacked on mobile), reusing the existing message component, with the internal-note / visible-to-student toggle for staff.
- **Unread badge in the dashboard sidebar/header** next to Messages, refreshed live.
- Internal notes (admin ↔ team only) stay clearly marked and are never visible to the student.

## 3. Phase D — AI advisor guardrails + final QA

- AI advisor inside dashboards gets guardrails: it answers only from the app's own context (case stage, tasks, catalog, FAQ), never invents prices, fees or legal/visa promises, refuses to reveal other students' data, and always ends with "confirm with your advisor" for legal/visa topics.
- Rate limiting and logging per user so the advisor cannot be abused.
- Final QA pass: full case lifecycle run-through, translation sweep on every new string (Arabic + English), role-access spot checks (student cannot read internal notes, partner cannot read case chat), typecheck and unit tests green.

## Technical notes

- DB: add `age_price_tiers jsonb not null default '[]'` to `public.insurances` (rows `{from, to, price}`); no other schema change. Admin-only writes stay as they are.
- New `src/components/admin/InsuranceRatesEditor.tsx` reusing the `PriceTiersEditor` pattern; `src/lib/insurancePricing.ts` with `resolveMonthlyRate(insurance, age)` + `monthsBetween` (unit tested).
- `CaseProgramTab` and `CaseFinance` consume the resolver; student age comes from `profiles.date_of_birth`, falling back to the base price when unknown.
- New `src/pages/messages/CaseMessagesInboxPage.tsx` mounted under both admin and team layouts; list query goes through a new `listMyCaseThreads()` in `CaseMessageService` (latest message + unread count per case, RLS unchanged).
- Unread badge via a `useUnreadMessages()` hook subscribed to `case_messages` realtime.
- Phase D guardrails live in the existing `ai-chat` edge function (system prompt + allowlisted context + per-user rate limit), no new tables.
- All new strings added to `public/locales/ar|en/dashboard.json`; the i18n key test must stay green.
