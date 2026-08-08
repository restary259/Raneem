# DARB — Audit findings + hardening plan (control, communication, AI)

## What the audit actually found (verified in code/DB this turn)

1. **The Admin inbox entries exist but render as raw keys.** `DashboardLayout.tsx` already registers `nav.inbox` (`/admin/inbox`) and `nav.messages` (`/admin/messages`) with icons, and both routes are registered in `App.tsx`. However `public/locales/ar/dashboard.json` and `.../en/dashboard.json` have **no `nav.inbox` and no `nav.messages` keys**, so the sidebar prints the literal strings `nav.inbox` / `nav.messages`. That is why the feature looks missing/broken. No new inbox is needed.
2. **Messaging is case-linked only.** `case_messages` + `case_message_reads` exist with RLS (admin read-all, assigned team, student sees `shared` only). There is **no direct Admin↔Team conversation**, no participant model, and **no attachments** in chat.
3. **Team-to-Team is currently blocked only as a side effect** (a team member can read messages only on cases assigned to them). There is no explicit participant/authorization model to allow admin-approved exceptions.
4. **Storage**: one bucket `student-documents`, `public = false`. Good baseline; chat attachments have no bucket/policies yet.
5. **AI (`ai-chat`)**: runs server-side with `LOVABLE_API_KEY` (no key in frontend), has prompt-injection filters, and logs into `ai_chat_logs`. But: `verify_jwt = false` and anonymous use is allowed; rate limiting is an **in-memory Map** (resets on cold start, not shared across instances = bypassable); and all course/university/price facts come from a **hardcoded `KNOWLEDGE_BASE` string**, not from the `programs` / `schools` / `accommodations` / `insurances` tables. So the AI can state stale or invented prices with no verified/guidance distinction.

## Plan

### Phase 1 — Make the Admin inbox real (small, immediate)
- Add `nav.inbox`, `nav.messages` labels (AR/EN) plus group headings already used.
- Distinguish the two clearly: **"طلبات واردة / Applications"** (`/admin/inbox`) vs **"المراسلات / Messages"** (`/admin/messages`).
- Keep the existing unread badge; verify it shows on collapsed sidebar and in the mobile sidebar (icon-only + badge dot).
- Empty state on the messages inbox instead of a blank list; loading skeleton; readable error with retry.

### Phase 2 — One conversation model (refactor, not a second system)
Generalize the existing messaging instead of adding a parallel chat:
- New `conversations` (id, kind: `case` | `direct`, case_id nullable → `cases`, created_by, title, timestamps) and `conversation_participants` (conversation_id, user_id, role_at_join, added_by).
- Migrate `case_messages` to reference `conversation_id`, backfilling one `case` conversation per existing case thread; keep `case_message_reads` semantics per conversation. Old columns dropped after backfill.
- Authorization rules enforced in RLS + a `can_access_conversation(uuid)` security-definer function:
  - Admin: all conversations.
  - Team: case conversations for cases assigned to them; direct conversations **only where an admin is a participant** → team↔team denied server-side by default; an admin adding both members to a conversation is the explicit exception path.
  - Student: only `shared` messages on their own case conversation.
  - Partner: no access to internal conversations.
- Sending is only via the existing `send_case_message`-style RPC (renamed/extended), which stamps author and validates participation server-side.

### Phase 3 — Attachments (private)
- New private bucket `chat-attachments`, path convention `conversation_id/message_id/filename`.
- Storage policies reuse `can_access_conversation()` for read/insert; delete limited to author or admin.
- Frontend uses signed URLs only (no public URLs), reusing `uploadRules.ts` limits (15MB, MIME allowlist).
- `message_attachments` rows for filename/size/type so the UI can render without listing the bucket.

### Phase 4 — Chat UI, reusing existing components
- Extend `CaseMessagesInboxPage.tsx` into a two-pane desktop inbox: thread list (search, unread, filter case/direct) + thread view, with a "New conversation" dialog for admins that picks a team member (from `get_staff_directory`) and optionally links a case.
- `CaseMessages.tsx` stays the single chat renderer; it gains attachment upload/preview. The case detail Messages tab keeps using it via the case conversation.
- Full AR/EN keys, RTL-correct alignment, loading/empty/error states.

### Phase 5 — AI: verified data + real limits
- Ground the assistant in the database: an edge-side fetch of active `schools`, `programs` (with `price_tiers`), `accommodations`, `insurances` injected as a **VERIFIED DATA** block; strip hardcoded prices/schools from `KNOWLEDGE_BASE` (keep only generic, non-numeric guidance).
- Prompt + UI contract: answers label **معلومة موثقة / Verified** (from DB, with `updated_at`) vs **إرشاد عام / Guidance**; explicit "not verified — contact DARB" when data is absent. No guarantees of admission/visa.
- Add `source` / `verified_at` columns where missing on catalog tables so "last verified" can be shown; only verified rows enter the verified block.
- Replace the in-memory rate limiter with a DB-backed counter (extend `ai_chat_logs` with a rejection reason + count query per user/IP per window) so limits survive cold starts and multiple instances.
- Require auth for the dashboard/student AI surfaces; keep the public landing chat anonymous but with a much lower window and no catalog pricing.

### Phase 6 — Authorization + legacy sweep, then E2E
- Re-run the linter/security scan; review every policy touching conversations, attachments, financials, partner data.
- Backend-level checks (direct PostgREST calls, not UI) for: team A → team B conversation, partner A → partner B rows, student A → student B case/documents/financials.
- Sensitive admin actions (role change, commission change, deletions) continue through the existing `AdminPasswordConfirm` gate; audit rows via the existing `admin_audit_log` / `activity_log` — no new audit system.
- Delete anything the refactor replaces (old message service paths, unused components/routes found during the sweep) rather than leaving both.
- Run the existing Vitest + Playwright suites and add specs for the inbox flow and the authorization denials.

## Technical notes
- No new permission system: gating continues via `has_role` / `get_my_permissions`.
- No new case system: conversations reference `cases`, they do not copy case data.
- All new tables get GRANTs + RLS in the same migration; policies target `authenticated` only.
- Each phase ends with typecheck + tests; Phase 2 is the only migration-heavy step and will be split into backfill-safe migrations.

## Scope note
Phases 1 and 5's data-grounding are the highest-value items; Phases 2–3 are a real refactor of messaging and carry migration risk on existing threads. If you'd rather ship the visible fix first, I can do Phase 1 alone and then continue.
