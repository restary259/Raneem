# Darb — Legal/Compliance Diagnosis (read-only pass)

Scope: verified against the live codebase and database on 8 Aug 2026. No code changed.
Only items relevant to what Darb does today (lead form → team-managed case → offline/admin-marked payment → student portal) are listed.

---

## P0 — before launch

### 1. Privacy notices at point of collection — MISSING
Searched `ApplyPage.tsx`, `ContactPage.tsx`, `CaseProfileForm.tsx`: zero occurrences of consent/privacy/terms text. The only link to `/privacy` and `/terms` is in `Footer.tsx`.
Gap to close: a short notice next to the submit button on each of the three forms (who collects, why, who it is shared with, link to the policy), plus the same on the student profile step where passport data is entered.

### 2. Consent is not recorded anywhere — MISSING (schema stub only)
`profiles.consent_accepted_at` and `profiles.consent_version` exist (migration `20260216001133`) but are referenced **only** in `src/types/database.ts` — no code ever writes them. No marketing-consent field exists at all: a column search for `%consent%|%marketing%|%opt_in%` across the whole public schema returns only those two dead columns.
Gap: a structured consent record (channel: email/WhatsApp/SMS, purpose: service vs marketing, timestamp, source form, policy version), written at apply time and editable by the student.

### 3. Transactional vs marketing messages are not distinguished — MISSING
`email_send_log` stores `template_name` only; `suppressed_emails` is keyed by email address with a free-text `reason`; `email_unsubscribe_tokens` is per-address. An unsubscribe therefore suppresses the address globally — appointment reminders and payment confirmations included.
Gap: a message-category field on the queue/log, category-aware suppression, and unsubscribe links only on marketing sends.

### 4. Privacy Policy / Terms pages — EXIST (real content)
`/privacy` renders 11 sections (controller, collected, purpose, basis, sharing, security, retention, rights, cookies, minors, changes); `/terms` renders 13 including `no-guarantee`, `fees`, `refunds`. Both dated 6 Aug 2026, Arabic + English via `public/locales/*/legal.json`.
Gap: no standalone Cancellation/Refund page (it is a Terms section only), and the "rights" section promises access/correction/deletion that the product does not yet provide (see item 6).

### 5. Accessibility — one glaring, systemic violation
`FieldGroup` in `ApplyPage.tsx:841` renders `<label>` with no `htmlFor` and the `<Input>` has no `id` — every field in the main apply form (and the companion sub-forms) is programmatically unlabeled; placeholders are the only hint. Keyboard nav on the step wizard works (native buttons/inputs). Contrast not measured in this pass.
Gap: associate labels, then a quick pass over the profile and contact forms for the same pattern.

---

## P1 — before accepting payments

### 6. Student data-rights self-service — MISSING
No export/correction/deletion UI in `src/pages/student/*`. Deletion exists only as admin-only edge functions (`purge-account`, `selective-delete`, both verifying `admin` role server-side) plus `anonymize_user` / `deletion_logs` in the database.
Gap: a student-facing "my data" panel (view collected fields, request correction, request deletion) that routes into the existing admin purge path.

### 7. Data inventory — MISSING
Repo docs are `README.md` and `COMMISSION_RULES.md` only. No field-level inventory, no sub-processor list. Third parties in actual use, from code: Lovable Cloud/Supabase (DB, auth, storage), Resend via `send-transactional-email`/`process-email-queue`, Lovable AI Gateway (`ai-chat`), exchange-rate API (`get-exchange-rate`). No payment processor is wired — payments are marked manually by admin (`admin-mark-paid`).

### 8. Commercial disclosure before payment — PARTIAL
`/apply` is a lead form; it shows no price, inclusions/exclusions, cancellation terms, or a statement of who provides each service (Darb vs school vs insurer vs accommodation). Pricing lives only in the internal case finance (`service_fee`, program/accommodation/insurance prices in `case_submissions`). Terms covers fees and refunds generically.
Gap: a pre-payment disclosure surface (what the ₪ fee covers, what is paid to third parties, cancellation/refund terms, provider identity) shown to the student before the enrollment payment is confirmed.

### 9. Outcome-guarantee language — SOFTEN
`public/locales/ar/landing.json:16,19` ("نحن لا نعد بالنجاح فحسب، بل نصنعه معك", "نضمن لك معالجة طلبك بسرعة") and `services.json:4,8` ("ضمان رحلة تعليمية ناجحة"). Terms already contains a `no-guarantee` clause, so the marketing copy contradicts the contract.

### 10. Audit logging of sensitive-document access — PARTIAL
`DocumentsManager.tsx:175` calls `log_user_activity` on **download only**, and only from the student-side manager. Admin and team document views/downloads elsewhere are not logged. `activity_log`, `admin_audit_log`, `auth_failure_log` and `get_document_activity_spikes()` already exist to receive these events.
Gap: log view/download on every document surface, with actor role and case reference.

---

## P2 — before scaling

### 11. Storage — OK
Both buckets (`student-documents`, `chat-attachments`) are **private**. Policies are scoped: students to their own `auth.uid()` folder, chat attachments to thread membership via `can_access_case_thread` / `is_direct_thread_member`, admin full access.
One real gap found: `student-documents` has a team INSERT policy but **no team SELECT policy** — an assigned team member can upload but cannot read back a student document through storage. Functional bug, not a leak.

### 12. RLS cross-role isolation — verified OK, with hardening left
- `cases`: team limited to `assigned_to = auth.uid()`; student to `student_user_id`; admin all. A team member cannot read another team member's cases.
- `documents`: student own, team only for assigned cases, admin all. **No partner policy at all** → partners cannot read passports/IDs.
- `case_messages`: student sees only `visibility = 'shared'`; `direct_messages` gated by thread membership. Partners have no policy on either.
- `profiles`, `rewards`, `payout_requests`: own-row + admin. Bank/IBAN fields are not reachable by partners other than their own row.
Hardening left: many policies are granted to role `public` rather than `authenticated` (`cases` student select, most `documents` policies, `profiles`, `rewards`, `payout_requests`, parts of `case_submissions`). The `auth.uid()` predicates make them safe today, but they widen the surface for any future policy written without a uid check.

### 13. Client writes bypassing checks — none found unguarded
Privileged operations run through SECURITY DEFINER RPCs and edge functions that re-verify role server-side (`purge-account`, `selective-delete`, `admin-mark-paid`, `create-*`, `admin_respond_payout_request`), and stage transitions are enforced by `enforce_case_stage_transition`.

### 14. MFA for admin — MISSING
No TOTP/MFA enrollment anywhere in code or Supabase auth usage. The only step-up is `verify-admin-password` (password re-prompt returning a 2-minute view token before sensitive student data is shown) plus `admin_security_sessions`.

### 15. AI feature data flow — LOW RISK, undocumented
`ai-chat` posts the last 20 chat turns plus a static Arabic knowledge base to `ai.gateway.lovable.dev` (`google/gemini-3-flash-preview`). No documents, passport numbers, or case records are attached — only what the user types. Conversations are retained in `ai_chat_logs`.
Gap: disclose the AI processor in the privacy policy, state the retention of `ai_chat_logs`, and add a "don't paste ID/passport numbers" hint in the chat UI.

---

## Suggested order if you want to proceed

1. P0 items 1–3 and 5 (notices, consent record, message categories, form labels) — all frontend + one migration.
2. P1 items 6–10 (data-rights panel, inventory doc, pre-payment disclosure, copy softening, document-access logging).
3. P2 items 11, 12, 14 (team storage read policy, `public` → `authenticated` policy tightening, admin MFA).

Say the word and I will turn any block into an implementation plan.
