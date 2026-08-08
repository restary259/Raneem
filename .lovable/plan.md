# Partner + Admin — referral link, chat-based payouts, isolation audit

## What I verified before writing this

- `rewards.case_id` **exists** in the database, but `PartnerEarningsPage.tsx` still resolves a reward's case by parsing `admin_notes` ("Partner commission from case <uuid>"). That contradicts COMMISSION_RULES §6 and is the root cause of fragile case references in payout requests.
- `request_payout` (SECURITY DEFINER) already enforces the important money rules server-side: caller ownership of each reward, `status = 'pending'`, the 20-day hold, "already in a non-rejected payout request", and it **recomputes the amount from the rewards** (client `p_amount` is ignored). So a chat-driven request can reuse it safely.
- `payout_requests` has no link to a chat thread or message today (`requestor_id, linked_reward_ids, linked_student_names, amount, status, paid_by, transaction_ref, ...`).
- `direct_messages` already has `kind` and `request_status` columns, but the client type (`chatFormat.ts`) narrows kind to `"text" | "request"` and `DirectMessageService.toChatMessage` hardcodes `kind: "text"`.
- `ReferralLinkCard.tsx` is the single referral surface (the extra `PartnerLinksCard` was already removed) and still has the WhatsApp share button.
- Social previews are static tags in `index.html` only; `SEOHead` writes tags client-side, which link-preview crawlers (WhatsApp, Telegram, iMessage, Discord) do not execute. `vercel.json` rewrites every path to `/`, so `/apply?ref=...` currently previews with the homepage tags.
- Partner data access already goes through `get_partner_pool_cases` and `get_staff_directory`; those need a re-read for isolation rather than a rebuild.

## 1. Referral link (partner dashboard)

- Remove the WhatsApp share button from `ReferralLinkCard`; keep exactly one link plus a **Copy link** button with a clear "Link copied" success state.
- Keep `buildReferralUrl` (`https://darb.agency/apply?ref=<code>`) as the single source of the URL — no second URL anywhere.
- No change to attribution: the code is resolved server-side in `insert_lead_from_apply` / `create-case-from-apply`, which persist `partner_id` / `source_id` on the case and lead. Re-verify with a live submission.

## 2. Link preview

- Ship a dedicated branded preview image (Darb logo, Arabic headline "ابدأ رحلتك للدراسة في ألمانيا") and reference it with an absolute URL.
- Because the app is a client-rendered SPA, JS-injected tags are invisible to crawlers. Options:
  - **A (chosen):** keep the shared static tags in `index.html`, tuned so they read correctly for the Apply/referral link too, plus an Apply-specific canonical/title via `SEOHead` for search engines.
  - **B (only if you want per-route previews):** add a tiny edge function that serves crawler-only HTML for `/apply` with route-specific OG tags. More moving parts; I'll only do this if you ask.
- The preview will contain no ids, no `ref` value in the title/description, no partner or student data.

## 3. Partner isolation audit (backend-first)

For every partner-facing read and write, confirm the filter lives in the database, not the component:
`cases`, `leads`, `rewards`, `payout_requests`, `partner_commission_overrides`, `partner_links`, `partner_clicks`, `direct_threads` / `direct_messages`, storage objects under `chat-attachments`.
Deliverable: a table of policy → verified predicate, plus fixes for anything scoped by frontend filtering only. Run the two-partner probe: sign in as Partner A and attempt to read Partner B's rows directly through the API.

## 4. Partner-specific admin configuration

Audit every admin write that touches money for a partner (commission override, show-all-cases flag, payout actions) and confirm each carries a `partner_id` / row-id predicate and never falls back to `platform_settings`. Test: change Partner A's commission, re-read Partner B's effective rate and eligible amount and assert both are unchanged.

## 5. Chat-based payout flow

Architecture: chat is the interface, `payout_requests` stays the source of truth.

```text
eligible rewards (20d+)  ->  "+ / Request payout" in partner↔Administration chat
   -> preview sheet (amount + case list, generated from DB)
   -> RPC creates payout_requests row AND posts a structured chat message
   -> admin sees a payout-request card in the thread
   -> admin opens it, inspects the real cases
   -> approve / mark paid / reject (reason posted back into the thread)
```

- New RPC `request_payout_via_chat(p_thread_id)`: server selects the caller's own unlocked pending rewards, reuses the existing `request_payout` guards, inserts the `payout_requests` row, then posts a `direct_messages` row with `kind = 'payout_request'` carrying only the request id. The partner never supplies an amount or a reward list.
- New column `payout_requests.thread_id` + `direct_messages.payout_request_id` (or reuse `request_status`) so the card and the record stay linked.
- Admin actions reuse `confirm_payout_batch` / rejection paths so duplicate payment stays impossible (rewards move pending → approved → paid and cannot be re-selected).
- Rejection sets `status = 'rejected'`, keeps the row, posts the reason as a message. Nothing is deleted.
- Partner earnings page keeps the three read-only figures (Available / Pending / Paid) and a single **Request payout in chat** button; the standalone request dialog is removed so there is one workflow.
- Fix the reward→case lookup to use `rewards.case_id` everywhere it currently parses `admin_notes`.

## 6. Chat UI

- Compact composer: `[ + ] [ input ] [ Send ]`, single row, auto-growing input, actions moved into the `+` menu (attach file, request payout for partners, mention). Internal-note toggle and case-mention stay staff-only.
- Partner-facing admin identity renders as **Administration** from one shared display helper, not hardcoded per component; internal names stay hidden from partners.
- Mentions for a partner are limited to people the server already allows them to talk to (admins).
- Attachments: verify bucket policies, 15 MB limit, MIME allow-list, and that only thread participants can read an attachment (probe with a second partner's session).
- Desktop-first layout pass (thread list / conversation proportions, no large empty areas), then a mobile pass for the composer, `+` menu, and copy-link control.

## 7. Notifications

One unread source per thread, driven by the existing read-receipt tables. Admin gets a badge on the payout-request message; partner gets a badge on the admin reply. No second notification path for the same event.

## 8. Verification (no claim without a run)

Playwright + direct SQL, in this order: partner login → one referral link → apply submission → attribution on case and lead → visibility in admin and partner dashboards → payout blocked before day 20 (also via a direct API call, not just a disabled button) → eligible request through chat → admin review of the real cases → mark paid → same rewards refused a second time → Partner B sees none of it. Findings reported as WORKING / FIXED / BACKEND / PAYOUT FLOW / ISOLATION / SIDE-EFFECT / E2E.

## Technical notes

- Migrations needed: `payout_requests.thread_id`, a payout-request link on `direct_messages`, the `request_payout_via_chat` RPC, and grants/policies for both.
- No change to `record_case_commission`, the 20-day rule, or the flat-ILS commission model.
- Existing payout admin screens (`PayoutsManagement`, `PartnerPayoutsPanel`, `PayoutActionModals`) are kept and wired to the same records — the chat card is an additional entry point, not a replacement.
