

# Fix Email Delivery for Account Creation

## What is broken

When you create an influencer, team member, or student account, no email is sent. There are 5 issues causing this:

1. **Missing email API key** -- The system needs a Resend API key to send emails, but none is configured. Every email attempt silently fails.
2. **Missing student email template** -- Student accounts request a "student_credentials" email type, but that template does not exist. It falls into a generic default that does not include login credentials.
3. **Broken influencer creation** -- The influencer account creation function uses an invalid authentication method (`getClaims`), which may cause it to fail entirely.
4. **Silent failures** -- All three account creation functions hide email errors. You see "Account created successfully" but never know the email failed.
5. **No feedback to admin UI** -- The admin panel does not warn you when email delivery fails.

## Solution

### Step 1: Add Resend API Key

You will be prompted to securely enter your Resend API key. Get one free at [resend.com](https://resend.com).

**Note:** The current sender address is `onboarding@resend.dev` (Resend test domain). This only delivers to the email address tied to your Resend account. For sending to any address, you will later need to verify your own domain (e.g. `darbstudy.com`) in Resend. But this step gets the system working for testing immediately.

### Step 2: Add student_credentials email template

Add a dedicated case to the email function for student welcome emails that includes:
- Student's email and temporary password
- A "Login to Student Portal" button
- Instructions to upload documents, track progress

### Step 3: Fix influencer function auth

Replace the broken `getClaims()` call with `getUser()` (same pattern used by the other two functions).

### Step 4: Return email_sent flag from all 3 functions

Update `create-influencer`, `create-team-member`, and `create-student-account` to:
- Actually check the email response for errors
- Return `email_sent: true/false` in their response

### Step 5: Show email status warnings in admin UI

Update `InfluencerManagement.tsx` and `ReadyToApplyTable.tsx` to:
- Check the `email_sent` flag
- Show a warning toast if email failed: "Account created, but email failed. Share credentials manually."

---

## Technical Details

| File | Change |
|------|--------|
| Backend secret | Add `RESEND_API_KEY` |
| `supabase/functions/send-branded-email/index.ts` | Add `student_credentials` case with login credentials and portal button |
| `supabase/functions/create-influencer/index.ts` | Fix auth: replace `getClaims()` with `getUser()`. Return `email_sent` flag. |
| `supabase/functions/create-team-member/index.ts` | Return `email_sent` flag based on email response. |
| `supabase/functions/create-student-account/index.ts` | Return `email_sent` flag based on email response. |
| `src/components/admin/InfluencerManagement.tsx` | Show warning toast when `email_sent` is false |
| `src/components/admin/ReadyToApplyTable.tsx` | Show warning toast when `email_sent` is false |

### Domain setup (for later, not blocking)

After testing works with `onboarding@resend.dev`:
1. Verify `darbstudy.com` in Resend dashboard
2. Add SPF and DKIM DNS records
3. Wait for propagation
4. Update `FROM_EMAIL` in `send-branded-email` to `noreply@darbstudy.com`
5. Test delivery to Gmail, Outlook, iCloud

