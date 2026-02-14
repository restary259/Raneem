# Remove Resend -- Restore Built-in Email System

## Current State

Resend is used in **5 edge functions**:

- `send-branded-email/index.ts` -- Main 620-line Resend email function (credentials, digest, status updates, etc.)
- `send_welcome_email/index.ts` -- Simple Resend welcome email
- `send-email/index.ts` -- Contact form handler with optional Resend notification
- `send-event-email/index.ts` -- Calls `send-branded-email` for status/welcome/referral events
- `admin-weekly-digest/index.ts` -- Calls `send-branded-email` for weekly reports

Account creation functions (`create-influencer`, `create-team-member`, `create-student-account`) call `send-branded-email` to deliver temp passwords.

## What Changes

### 1. Rewrite `send-branded-email` -- Remove Resend, use Supabase built-in SMTP

Replace the entire Resend-based function with one that uses `supabase.auth.admin.generateLink()` to create invite/recovery links and sends them via the built-in auth email system. For credential emails specifically, we will display the temporary password directly in the admin UI (since built-in SMTP cannot send custom content with temp passwords).

**New approach for each email type:**

- `team_credentials` / `student_credentials` -- No longer sent via this function. Temp password shown in admin UI for manual sharing.
- `signup_confirmation` / `password_reset` / `magic_link` -- Handled natively by the built-in auth system (already works without Resend).
- `welcome` / `status_change` / `referral_accepted` / `weekly_digest` -- Converted to in-app notifications only (already created in the notifications table).

### 2. Rewrite `send_welcome_email` -- Remove Resend

Replace with a simple function that creates an in-app notification instead of sending email.

### 3. Clean `send-email` -- Remove Resend block

Remove the optional Resend email notification (lines 124-143). Contact form submissions are already saved to the database, which is sufficient.

### 4. Update `send-event-email` -- In-app notifications only

Remove the call to `send-branded-email`. Keep only the in-app notification insert (already in the function).

### 5. Update `admin-weekly-digest` -- In-app notifications only

Remove the call to `send-branded-email`. Keep only the in-app notification insert (already in the function).

### 6. Update account creation functions -- Show temp password in admin UI

Modify `create-influencer`, `create-team-member`, and `create-student-account` to:

- Remove the `send-branded-email` fetch call entirely
- Return `temp_password` in the response so the admin can see and share it
- Keep the `must_change_password: true` flow

### 7. Update admin UI -- Display temp password after account creation

Modify `InfluencerManagement.tsx` and `ReadyToApplyTable.tsx` to:

- Show the temporary password in a copyable box after account creation
- Add a "Copy Password" button
- Show clear instructions: "Share these credentials with the user manually"

### 8. Strengthen password requirements

Update `PasswordStrength.tsx`:

- Minimum 10 characters (up from 8)
- Require uppercase, lowercase, number (special character optional but recommended)

### 9. Delete `RESEND_API_KEY` secret

No longer needed after removing all Resend references.

---

## Technical Details


| File                                                 | Action                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `supabase/functions/send-branded-email/index.ts`     | Rewrite: remove Resend, become a thin in-app notification creator only |
| `supabase/functions/send_welcome_email/index.ts`     | Rewrite: remove Resend, insert in-app notification                     |
| `supabase/functions/send-email/index.ts`             | Remove Resend import and optional email block (lines 124-143)          |
| `supabase/functions/send-event-email/index.ts`       | Remove `send-branded-email` fetch call, keep in-app notification       |
| `supabase/functions/admin-weekly-digest/index.ts`    | Remove `send-branded-email` fetch call, keep in-app notification       |
| `supabase/functions/create-influencer/index.ts`      | Remove email fetch, return `temp_password` in response                 |
| `supabase/functions/create-team-member/index.ts`     | Remove email fetch, return `temp_password` in response                 |
| `supabase/functions/create-student-account/index.ts` | Remove email fetch, return `temp_password` in response                 |
| `src/components/admin/InfluencerManagement.tsx`      | Show temp password in UI with copy button after creation               |
| `src/components/admin/ReadyToApplyTable.tsx`         | Show temp password in UI with copy button after creation               |
| `src/components/auth/PasswordStrength.tsx`           | Increase minimum to 10 characters                                      |
| `src/pages/StudentAuthPage.tsx`                      | Update password validation minimum to 10                               |
| Backend secret                                       | Remove `RESEND_API_KEY`                                                |


### What continues to work without Resend

- **Password reset emails** -- Built-in auth system handles these natively
- **Email confirmation** -- Built-in auth system handles this natively
- **In-app notifications** -- Already stored in `notifications` table, displayed via `NotificationBell`
- **Forced password change on first login** -- `must_change_password` flag + modal in `StudentAuthPage`

### What changes for the admin

- After creating an account, the admin sees the temp password on screen and copies it to share manually (via WhatsApp, direct message, etc.)
- No more silent email failures -- the admin always has the credentials visible  🔐 SPECIAL SECURITY NOTE — TEAM MEMBERS & INFLUENCERS
  For any account created for:
  - Team members
  - Influencers
  - Admins
  - Staff
  - Partners
  The following rule must apply strictly:
  The moment they log in using:
  - Their email
  - Their temporary password
  They must be **immediately forced** to create a new secure password before accessing the dashboard.
  This must happen:
  - Before dashboard renders
  - Before any protected page loads
  - Before session grants role-based permissions
  There must be:
  - No bypass
  - No skip option
  - No “remind me later”
  - No direct URL access workaround
  ---
  ## 🔒 Enforcement Logic
  System must:
  1. Mark account as `requires_password_reset = true` upon creation.
  2. On login:
    - Check this flag.
  3. If true:
    - Redirect instantly to `/set-new-password`.
  4. Block all other routes until password is successfully updated.
  5. After successful update:
    - Set `requires_password_reset = false`
    - Grant normal dashboard access
    - Preserve session without forcing re-login
  ---
  ## 🛡 Security Standard
  New password must meet strength requirements:
  - Minimum 10–12 characters
  - Uppercase
  - Lowercase
  - Number
  - (Optional: special character)
  No weak passwords allowed.
  ---
  ## 🎯 Purpose
  This ensures:
  - No shared temporary passwords
  - No credential leakage risk
  - No influencer accessing dashboard with insecure password
  - Clean security baseline from first login
  This applies to **all privileged accounts**, not just students.