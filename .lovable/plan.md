

# Plan: Complete Security Layers for Darb Platform

## Overview
Add comprehensive security hardening across authentication, API endpoints, admin access, contact form, AI chat, document storage, and PWA -- all without changing the existing design.

---

## Phase 1: Authentication Hardening

### 1A. Strong Password Enforcement (Client + Server)
- Update `StudentAuthPage.tsx` to enforce password rules client-side:
  - Minimum 8 characters (Supabase default is 6 -- we add client-side validation for 8+)
  - Must include uppercase, lowercase, number, and symbol
  - Show real-time password strength indicator (weak/medium/strong) using existing Tailwind classes
- Add a visual password requirements checklist below the password field

### 1B. Rate Limiting on Auth
- Create a new edge function `auth-guard` that wraps login attempts
- Track failed login attempts per IP/email in a `login_attempts` table
- Block after 5 failed attempts for 15 minutes
- Return appropriate Arabic error messages

### 1C. Session Security
- Verify `persistSession: true` and `autoRefreshToken: true` are set (already configured in client.ts)
- Add auto-logout on inactivity (30 minutes) via a `useSessionTimeout` hook
- Clear sensitive data from localStorage on logout

---

## Phase 2: Admin Dashboard Security (EXTRA HARDENED)

### 2A. Server-Side Admin Verification
- Remove the client-side `ADMIN_EMAIL` check from `AdminDashboardPage.tsx`
- Use ONLY the `has_role()` database function to verify admin status
- Create an `admin-verify` edge function that checks the `user_roles` table server-side
- All admin data fetches go through this edge function (not direct Supabase client queries)

### 2B. Admin Re-Authentication
- Require password re-entry for sensitive admin actions (deleting data, exporting CSV)
- Add a re-auth modal component that uses `supabase.auth.reauthenticate()`

### 2C. Admin Activity Logging
- Create `admin_audit_log` table (admin_id, action, target_table, target_id, timestamp, ip_address)
- Log all admin actions: view, update status, export data
- Display audit log in a new "Activity Log" tab on the admin dashboard

---

## Phase 3: Contact Form Protection

### 3A. Honeypot Anti-Spam
- Add a hidden honeypot field to the contact form (invisible to humans, filled by bots)
- Server-side: reject submissions where the honeypot field has a value

### 3B. Rate Limiting
- Add rate limiting in the `send-email` edge function
- Max 3 submissions per IP per hour
- Track in a `rate_limits` table or use in-memory Map with TTL

### 3C. Input Sanitization
- Add server-side validation with length limits in the edge function:
  - name: max 100 chars
  - email: max 255 chars, valid format
  - whatsapp: max 20 chars, digits only
  - message: max 2000 chars
- Strip HTML tags from all text inputs
- Add client-side validation to match (already partially done with zod)

---

## Phase 4: AI Chat Security

### 4A. Prompt Injection Protection
- Update the `ai-chat` edge function system prompt to include explicit anti-injection rules
- Sanitize user messages before sending to AI (strip control characters, limit length to 2000 chars)
- Add a content filter that blocks attempts to extract the system prompt

### 4B. AI Usage Limits
- Track AI requests per session/user in localStorage (for anonymous) or database (for authenticated)
- Limit to 30 messages per hour for anonymous users, 100 for authenticated
- Show remaining quota in the chat UI

### 4C. AI Interaction Logging (Admin-Only)
- Create `ai_chat_logs` table (user_id nullable, message_preview first 100 chars, timestamp)
- Log interactions for abuse detection (admin viewable only)
- Add RLS: only admin can SELECT

---

## Phase 5: Document & File Security

### 5A. Upload Safety
- In the document upload flow, validate:
  - File type whitelist: PDF, JPG, PNG, DOCX only
  - Max file size: 10MB
  - Rename files on upload (UUID-based names, no original filenames in storage path)
- Client-side + server-side validation

### 5B. Signed URLs
- Generate signed URLs with 1-hour expiration for document access (already using private bucket)
- Never expose raw storage URLs to the client

---

## Phase 6: Edge Function & API Security

### 6A. Input Validation on All Edge Functions
- Add zod-style validation at the start of every edge function
- Reject requests with unexpected fields
- Return consistent error format

### 6B. CORS Tightening
- Replace `Access-Control-Allow-Origin: '*'` with the actual domain:
  - `https://darb-agency.lovable.app` and preview URL
- Keep `*` only for development

### 6C. Security Headers
- Add a `_headers` file or inject headers via edge functions:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## Phase 7: PWA & Client-Side Security

### 7A. Service Worker Security
- Restrict service worker scope to the app origin
- Never cache auth tokens or sensitive user data
- Clear caches on logout
- Validate cached content integrity

### 7B. Secure Storage
- Audit all localStorage usage: ensure no passwords, tokens, or PII are stored in plain text
- AI chat cache: store only message text, no auth data

---

## Phase 8: Monitoring & Alerts

### 8A. Failed Login Tracking
- The `login_attempts` table from Phase 1B doubles as monitoring
- Admin dashboard tab: "Security" showing failed login patterns

### 8B. Admin Alert System
- When 10+ failed logins occur for any account in 1 hour, flag it in the admin dashboard
- Show security alerts in the admin overview tab

---

## Technical Details

### New Database Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `login_attempts` | id, email, ip_address, success, created_at | Track login attempts for rate limiting |
| `admin_audit_log` | id, admin_id, action, target_table, target_id, details, created_at | Admin activity logging |
| `ai_chat_logs` | id, user_id (nullable), message_preview, tokens_used, created_at | AI usage tracking |

### New Edge Functions

| Function | Purpose |
|----------|---------|
| `auth-guard` | Rate-limited login wrapper |
| `admin-verify` | Server-side admin role verification |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/StudentAuthPage.tsx` | Password strength indicator, strong password rules |
| `src/pages/AdminDashboardPage.tsx` | Remove client-side email check, add re-auth modal, audit log tab, security alerts tab |
| `src/components/landing/Contact.tsx` | Add honeypot field |
| `supabase/functions/send-email/index.ts` | Rate limiting, input sanitization, honeypot check |
| `supabase/functions/ai-chat/index.ts` | Prompt injection protection, input length limits, usage tracking |
| `src/hooks/useAIChat.ts` | Usage quota tracking |
| `src/components/chat/AIChatPopup.tsx` | Usage quota display |
| `public/service-worker.js` | Cache security audit, clear on logout |
| `src/App.tsx` | Add session timeout hook |

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useSessionTimeout.ts` | Auto-logout after 30 min inactivity |
| `src/components/admin/ReAuthModal.tsx` | Re-authentication modal for sensitive actions |
| `src/components/auth/PasswordStrength.tsx` | Password strength indicator component |
| `supabase/functions/auth-guard/index.ts` | Rate-limited auth endpoint |
| `supabase/functions/admin-verify/index.ts` | Server-side admin verification |

### RLS Policies
- `login_attempts`: service role INSERT only, admin SELECT
- `admin_audit_log`: service role INSERT, admin SELECT
- `ai_chat_logs`: service role INSERT, admin SELECT

### What Will NOT Change
- Website design, layout, colors, fonts
- Navigation order and structure
- Existing user-facing flows (just adding security layers underneath)

