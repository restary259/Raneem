# Darb — Payouts, Chat, Profile & Finance Cleanup

## Findings (what I verified in code/DB)

### 1. Duplicate "Request Payout" (confirmed cause)
The backend is already safe: `request_payout_via_chat()` takes an advisory lock, rejects a second request while one is `pending`, and only picks rewards not already linked to a non-rejected request. `get_my_payout_preview()` returns `has_open_request` and excludes already-requested rewards.

The bug is purely in `src/pages/partner/PartnerEarningsPage.tsx`. It computes:
`canRequestPayout = pending rewards older than 20 days > 0` — reading the `rewards` table directly and never checking `payout_requests`. Rewards stay `status = 'pending'` until an admin approves, so after a request is sent the ₪1000 still shows as "Ready for Payout" and the button stays enabled. Clicking it just navigates to chat, where the RPC then throws "You already have a payout request awaiting review".

Fix: drive the page off `get_my_payout_preview()` (the same source the dialog uses) instead of raw rewards, and hide/disable the button when `has_open_request` is true, showing an "Awaiting review" state instead.

### 2. Chat "+" menu spacing (confirmed)
`MessageComposer.tsx` renders `<DropdownMenuItem><Paperclip className="h-4 w-4" />{label}</DropdownMenuItem>` with no gap utility — icon and label touch. Needs `gap-2` (RTL-safe) on each item.

### 3. Admin chat: case link + delete (gap)
`PayoutRequestCard` shows the review dialog but has no link to the case. Direct/case messages support soft delete at DB level (`deleted_at` is filtered on read) but there is no delete action in the UI and no admin RPC to soft-delete a message or clear a thread.

### 4. Profile form clearing (diagnosis partly unconfirmed)
`CaseProfileForm` keeps one `values` object; a failed validation only sets `errors` and returns — it does not reset state. So the "everything clears" report is most likely a **remount**: `values` is initialised once from `readStudentProfile(caseData, submission)`, and the parent refetches the case (`onRefresh`, realtime) — any re-render that swaps the stage branch or unmounts the form drops in-progress edits, and the 1200 ms debounced autosave may not have flushed yet. Birthday/email are the visible victims because they are the fields most likely to be mid-edit.

I will not commit to that as the sole cause — step 1 of the work is to reproduce it in the browser with instrumentation and confirm whether it is a remount, a refetch overwriting state, or `readStudentProfile` returning blanks (canonical column `null` beating a filled `extra_data` copy). The fix then makes the form resilient regardless: lift the draft into a stable store keyed by case id, flush autosave on blur/unmount, and never re-seed non-empty fields from a refetch.

### 5–8, 11. Payouts / finance duplication (confirmed)
- `AdminFinancialsPage` has two tabs, **Agent payouts** (`PayoutsManagement`, reads `payout_requests`) and **Partner payouts** (`PartnerPayoutsPanel`, reads `rewards` and creates its own batches). Two UIs over two halves of the same data — this is the duplication in items 7 and 11, and it is why numbers disagree.
- `PayoutsManagement` writes `payout_requests.status` **directly via the client**, bypassing `admin_respond_payout_request()`, so rewards are not moved in step with the request.
- The state machine already exists: `pending → approved → paid | rejected`, with `confirm_payout_batch()` doing the money-moved step. Item 8 only needs the UI renamed and re-routed: chat review → **Approve** → row appears in an **Approved / To pay** tab → **Mark transferred** there.
- Per-case finance (`CaseFinance`) currently mounts `CaseServices` and `CasePayments` with `canManage`, exposing Add service / Record payment. Item 5 is a presentation change: pass `canManage={false}` from the case view and render a read-only expense summary.

### 9. Visa fields
`visa_fields` / `visa_field_values` are keyed by `student_user_id` and edited on `StudentVisaPage` (student) and `AdminStudentsPage` (admin). Moving them to the team-filled student profile is a placement change, not a schema change.

### 10. Chat email
`notify-new-message` exists and works, but it is only invoked from the client (`CaseMessages`, `DirectMessages`). Payout requests are created **inside a DB function** that posts the message server-side, so no email is ever sent for them. Also, for direct threads recipients come from participants — fine — but there is no explicit admin fan-out for payout events.

### Conflicts with COMMISSION_RULES.md / referral work
None of the above changes commission maths, `record_case_commission`, or referral attribution. The only touch point: merging the payout tabs must keep `requestor_role` (partner vs ambassador vs student) visible, since rates differ (₪500 partner / ₪300 ambassador defaults) — the merged view distinguishes by role, it does not merge the roles themselves.

## Implementation plan

### Phase 1 — Partner-first payout architecture (items 1, 7, 8, 11)

Revised per founder direction: the admin surface is **partner-first**, not request-list-first.

1. **Partner earnings page (partner side)** reads `get_my_payout_preview()`; button states: `Request payout ₪X` / `Awaiting review` (disabled) / `Locked — N days`. KPI cards split into Locked, Awaiting review, Approved (to be paid), Paid.
2. **RPCs**: keep `list_payout_requests()` (already shipped) as the request feed, and add `list_partner_directory()` — one row per partner with name, email, phone, city, referral code, students referred, total earned, paid, locked, available and open-request count/amount.
3. **Partners directory** (`PartnersDirectory.tsx`) replaces the flat payout table inside Admin → Financials → Payouts: searchable by name/email/city, sortable/filterable by status (has open request / has balance / settled), with a "Pending requests (N)" quick filter and a badge on the tab so admin never has to open a profile to find work.
4. **Partner profile** (`PartnerProfilePanel.tsx`) opens from the directory: partner info, lifetime earned / paid / locked / available, referred students, payout history, and **that partner's payout requests reviewed in context** (Approve / Reject / Mark transferred).
5. **Ambassadors excluded** from the directory and the partner payout surface (`requestor_role = 'social_media_partner'` only). Ambassadors and students can still raise payout requests via chat, so their requests land in a secondary **"Other requests"** list on the same page rather than being silently unpayable. Commission rules and rates untouched.
6. `PartnerPayoutsPanel.tsx` is deleted — its reward-batch UI is replaced by the profile view.
7. All admin actions route through `admin_respond_payout_request()` — no direct client writes to `payout_requests`.
8. Rename the chat review action **Mark paid → Approve**; the "money moved" confirmation lives in the profile/Approved state as **Mark transferred**.
9. Students directory (`AdminStudentsPage`) keeps its own list but gains the same search/filter shell language so the two directories read consistently.

### Phase 2 — Chat (items 2, 3, 10)
7. `gap-2` on every `+`-menu item.
8. `PayoutRequestCard`: "Open case" link per linked case (`/admin/cases/:id`).
9. New `delete_chat_message(p_message_id)` and `clear_case_thread(p_case_id)` RPCs (admin only, soft delete via `deleted_at`, audit-logged) + UI: per-message delete in the admin view and "Delete all" on a case thread, both behind a confirm dialog.
10. Email on payout request: invoke `notify-new-message` (or a dedicated payout template) after `requestPayoutViaChat` resolves, fanned out to admins.

### Phase 3 — Student profile (items 4, 9)
11. Reproduce the clearing bug in the browser, then fix: stable draft state per case id, flush autosave on blur and unmount, refetch never overwrites a non-empty local field, per-field error display.
12. Birthday: keep the three-part picker but validate on compose only; email: validate on blur, show inline error, never block other fields.
13. Move visa fields into the team-facing student profile (read-only for the student on their dashboard).

### Phase 4 — Case finance + handoff (items 5, 6)
14. `CaseFinance` in the case view becomes read-only: expenses/charges list, total, paid, remaining. Add service / Record payment removed from this surface (service generation stays automatic via `CaseCostingService`).
15. Pipeline handoff: team's last action is **Submit to admin** after payment is confirmed; admin owns enrollment. Enforce with the existing stage-transition trigger and make the wording explicit in both dashboards.

## Technical notes
- New migrations: `list_payout_requests`, `delete_chat_message`, `clear_case_thread` (all `SECURITY DEFINER`, admin-gated, audit-logged).
- Deleted files: `src/components/admin/PartnerPayoutsPanel.tsx`.
- No changes to `rewards` amounts, `record_case_commission`, or referral attribution.
