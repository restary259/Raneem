# Partner Page — Referral, Attribution, Messaging & UX Fix

Verified findings first, then the fix list, then the end-to-end test run.

## What the audit already confirmed (read-only checks)

- **Two competing referral links.** The partner overview renders both the personal referral link card (`profiles.referral_code`, e.g. `partner-2094`) and a second card that creates and lists unlimited named links in `partner_links` (4 rows exist today). A partner genuinely cannot tell which link to use.
- **Partner cannot start a conversation with Admin.** The staff-directory function only returns rows when the caller is an admin or a team member. A partner gets an empty list, so "New conversation" shows nobody.
- **The messaging rule is looser than intended.** Thread creation allows a partner to open a thread with any team member flagged as a manager, not admin-only.
- **Public case creation accepts a client-supplied partner.** The apply endpoint is public; when no referral code is present it will still accept a `partner_id` in the request body and attach the case to that partner as long as that user has a partner role. Anyone can post a case attributed to any partner, which feeds commissions.
- **Apply writes the applicant twice.** It creates a case through the edge function and separately inserts a lead row through the apply RPC — two records, two attribution paths, for one applicant.
- **Partner attribution on cases is resolved server-side from the code** (good) and the partner dashboard reads cases only through a dedicated function; partners have no direct read policy on `cases` (good).
- **Pool mode can show non-own cases.** When the platform setting for showing all cases is on, a partner sees agency cases they did not refer. This is a deliberate setting, not a bug, but it must be off for the isolation test to mean anything.
- Apply already verifies the code on load and shows a valid/broken referral state; the broken token is discarded rather than misattributed.

## Fixes

### 1. One referral link, one source of truth
- Remove the multi-link card from the partner overview; the personal referral code becomes the single link for every partner and ambassador.
- Keep existing `partner_links` rows readable for historical attribution (old links keep working on apply) but stop offering creation of new ones in the partner UI.
- Polish the remaining card: clear label, the full URL, copy button with confirmation, WhatsApp share, click/application count for that link, no internal IDs shown.

### 2. Partner → Admin conversations
- Extend the staff directory so a partner or ambassador receives **admins only** — nothing else.
- Tighten thread creation so a partner/ambassador may only open a thread with an admin (manager fallback removed for these roles).
- No change to admin route protection or roles.

### 3. Close the attribution hole on public case creation
- Reject any `partner_id` supplied in the body of an unauthenticated apply request. Attribution comes only from a server-resolved referral code; admin/team-created cases keep supplying it, authenticated and role-checked.

### 4. Stop the double write on Apply
- Apply submits once. The case is the record of truth; the lead row is created from the same server call rather than by a second client RPC, so a referred applicant can never end up with a lead-only or case-only record.

### 5. Apply page referral banner
- Refine the existing "referred by" state into a calm, branded line — partner display name only, not editable, no code or ID — that reads correctly in Arabic RTL and English LTR, desktop and mobile.

### 6. Partner dashboard UX pass
- One screen that answers: how many students I referred, which are active, what stage, my link, my commission. Consistent cards, real empty/loading/error states, RTL-safe truncation for long names and URLs, 44px touch targets, no duplicated stat between overview/students/earnings.

## Verification run (executed, not assumed)

1. Sign in as the partner test account; confirm role, dashboard load, refresh persistence, logout/login.
2. Direct-URL attempts on admin and team routes → blocked by route guard and by the database (a partner query against admin-only data returns nothing).
3. Confirm exactly one referral link renders; copy it.
4. Clean browser session → open the link → confirm the "referred by" line → complete a realistic demo application → submit.
5. Query the database directly: one case, correct name/phone/source, `partner_id` = the partner, attribution method `link`, correct pipeline stage, no duplicate case or lead.
6. Sign in as admin: case visible with the partner relationship shown; move it a stage; confirm attribution survives.
7. Back on the partner dashboard: the same case appears, stage reflects the admin change, KPIs recomputed from the database.
8. Edge cases: refresh mid-apply, navigate away and back, reopen the link in a new session, apply with no code, apply with a fabricated code, apply with a second partner's code — each must attribute to exactly the legitimate owner or to nobody.
9. Isolation: a second partner account queries the first partner's cases, rewards and links through the API — all empty.
10. Mobile viewport pass of the partner dashboard and the apply flow in both languages.

## Technical notes

- Frontend: `src/pages/partner/PartnerOverviewPage.tsx`, `src/components/partner/PartnerLinksCard.tsx` (removed from partner surface), `src/components/dashboard/ReferralLinkCard.tsx`, `src/pages/ApplyPage.tsx`, partner students/earnings pages, dashboard locale files.
- Backend: `supabase/functions/create-case-from-apply/index.ts` (drop body-supplied partner for anonymous callers, create the lead row in the same call); migrations for `get_staff_directory` (partner → admins only) and `start_direct_thread` (partner → admin only).
- No new tables, no schema change to `cases`; `partner_id` / `referred_by` / `source_attribution_method` / `partner_link_id` stay the attribution fields.
