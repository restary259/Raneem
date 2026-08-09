# Darb — Personal Data Inventory

Last reviewed: 2026-08-09
Controller: Darb Study International ("Darb")
Privacy contact: darbsocial27@gmail.com

This document lists every category of personal data the platform collects, why it is
collected, where it is stored, how long it is kept, and which third parties receive it.
It is the internal companion to the public Privacy Policy (`/privacy`) and the
Accessibility Statement (`/accessibility`).

---

## 1. Data categories

| # | Category | Fields | Purpose / legal basis | Stored in | Retention |
|---|----------|--------|-----------------------|-----------|-----------|
| 1 | Lead / applicant contact data | Full name, phone, email, city, referral code, form answers | Respond to an application request; performance of a (pre-)contract | `leads`, `case_submissions`, `contact_submissions` | 3 years from last activity, then purged |
| 2 | Student identity data | Full name (AR/EN), date of birth, passport number, nationality, address | Prepare university and visa applications; contractual necessity | `profiles`, `cases` | Duration of engagement + 3 years |
| 3 | Academic data | Certificates, grades/Bagrut results, desired field of study, language level, target universities | Assess eligibility and submit applications; contractual necessity | `cases`, `case_submissions`, `documents` | Duration of engagement + 3 years |
| 4 | Uploaded documents | Passport scan, diplomas, transcripts, proof of funds, insurance confirmations, visa documents | Submit official applications on the student's behalf; contractual necessity | Storage bucket `student-documents` (private) + `documents` metadata | Auto-purged by `purge_expired_documents` per retention policy (3 years) |
| 5 | Case / workflow data | Pipeline stage, appointments, internal notes, visa status, checklist state | Deliver and manage the service; contractual necessity | `cases`, `appointments`, `case_events`, `student_checklist`, `visa_applications` | Duration of engagement + 3 years |
| 6 | Financial data (service fees) | Service fee amounts, payment records, commission splits, payout requests, IBAN (partners only) | Billing, partner payouts, statutory bookkeeping; legal obligation | `case_payments`, `payments`, `commission_transactions`, `payout_requests`, `profiles.iban` | 7 years (Israeli bookkeeping requirements) |
| 7 | Account & authentication data | Email, hashed password, role, MFA factors, session records, login attempts | Provide secure accounts; contractual necessity + legitimate interest in security | Supabase Auth, `user_roles`, `active_sessions`, `login_attempts`, `auth_failure_log` | Account lifetime; security logs 12 months |
| 8 | Communications | In-platform messages, chat attachments, email send logs, notifications | Support and case coordination; contractual necessity | `case_messages`, `direct_messages`, `chat-attachments` bucket, `email_send_log`, `notifications` | Duration of engagement + 3 years |
| 9 | Consent records | Consent type, policy version, timestamp, IP, user agent | Evidence of consent; legal obligation | `consent_records` | 7 years |
| 10 | Activity & audit logs | Actor, action, entity, document view/download events, admin actions | Security, accountability, abuse detection; legitimate interest | `activity_log`, `admin_audit_log`, `deletion_logs` | 24 months |
| 11 | Partner data | Partner profile, referral/recruit codes, network links, negotiated rates, payout details | Operate the partner programme; contractual necessity | `profiles`, `partner_links`, `partner_recruit_applications`, `partner_rate_offers` | Duration of partnership + 7 years for financial records |
| 12 | Marketing consent & unsubscribes | Marketing opt-in flag, unsubscribe tokens, suppression list | Send marketing only with consent; consent | `consent_records`, `email_unsubscribe_tokens`, `suppressed_emails` | Until withdrawn + 3 years proof |
| 13 | Technical data | IP address, user agent, device/PWA push subscription | Security, delivery of notifications; legitimate interest | `push_subscriptions`, logs | 12 months |

Special-category data: Darb does **not** intentionally collect health, biometric,
religious or political data. Health-insurance documents may incidentally contain
health-related identifiers; they are stored in the private documents bucket under the
same access rules as all other documents.

Minors: applicants are expected to be 17+. If a minor's data is submitted, a
parent/guardian consent is required before the case proceeds.

---

## 2. Who can access what (internal)

| Role | Access |
|------|--------|
| Student | Own profile, own case (via `get_my_case`, financial fields excluded), own documents, own messages |
| Team member | Cases assigned to them, those students' documents and messages, appointments |
| Partner (agent) | Their referred students' non-PII pipeline status and their own commission data — no student email/address |
| Master Partner | Their network's partner list and override commissions — no student PII |
| Admin | All data, subject to audit logging |

Enforced by Postgres RLS, `has_role()`/`has_permission()` security-definer functions,
and storage bucket policies. Admin and team document views/downloads are recorded via
`log_document_access()` into `activity_log`.

---

## 3. Third-party recipients (processors and independent controllers)

| Recipient | Role | Data shared | Location | Basis |
|-----------|------|-------------|----------|-------|
| Supabase (database, auth, storage, edge functions) | Processor | All platform data | EU region | DPA |
| Resend | Processor | Name, email address, email content | EU/US | DPA, SCCs |
| Lovable (hosting / build platform) | Processor | Application hosting, no direct DB access | EU/US | DPA |
| Lovable AI Gateway (AI advisor) | Processor | Chat prompts the user types; no document contents | EU/US | DPA |
| German universities / uni-assist | Independent controller | Application file: identity, academic records, documents | Germany | Contractual necessity, student-initiated |
| German embassy / consulate & foreigners authority | Independent controller | Visa file: identity, financial proof, documents | Germany / Israel | Legal requirement of the visa procedure |
| Health insurance providers | Independent controller | Identity, date of birth, study details | Germany | Student's own contract |
| Accommodation providers | Independent controller | Identity, contact details | Germany | Student's own contract |
| Certified translators / notaries | Processor | Documents submitted for translation or certification | Israel / Germany | Contractual necessity |

Darb does not sell personal data and does not use it for automated decision-making
with legal effect. Eligibility scoring is advisory only; a human reviews every case.

---

## 4. Data subject rights

Students can exercise rights self-service from the student dashboard at
`/student/my-data`:

- **Access** — view the category summary and download a JSON export of their profile,
  case and document list.
- **Correction** — submit a correction request (editable profile fields can also be
  changed directly).
- **Deletion / objection** — submit a request; handled by admin via the Data requests
  tab in the Applications Inbox, using the `purge-account` / `selective-delete`
  functions. Financial and legal records are retained where the law requires.

Requests are logged in `data_requests` and answered within 30 days.
Direct channel: darbsocial27@gmail.com.

---

## 5. Security measures

- Row Level Security on every public table; policies scoped to `authenticated`.
- Private storage buckets; all downloads via short-lived signed URLs.
- Role separation in a dedicated `user_roles` table (never on the profile).
- Admin TOTP multi-factor authentication.
- Authorization-failure monitoring (`auth_failure_log`) with an admin alert panel.
- Audit trails for admin actions, document access and deletions.
- Retention automation: `purge_expired_documents` and account purge functions.

---

## 6. Review

This inventory must be reviewed whenever a new table storing personal data is added,
a new third-party processor is introduced, or retention rules change.
