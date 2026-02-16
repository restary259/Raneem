

# Revert to Temp Password Display + Fix Commission Flow

## Problem
The recovery email system (via `/auth/v1/recover` and Lovable Cloud email hook) is not delivering emails to Gmail accounts. The user wants to revert to showing temporary passwords directly to the admin, with forced password change on first login.

## Solution

### 1. Edge Functions: Return `temp_password` in response

**Files:** `create-influencer/index.ts`, `create-team-member/index.ts`, `create-student-account/index.ts`

- Remove the `/auth/v1/recover` call (lines 130-148 in each function)
- Add `temp_password` back to the JSON response so the admin can see and share it
- Keep `must_change_password: true` on the profile (already there)
- Commission is already passed correctly in `create-team-member` (line 122) -- no change needed there

### 2. InfluencerManagement.tsx: Show temp password with copy button

- After successful creation, store the returned `temp_password` in `createdPassword` state
- Show the password in the success card with a Copy button so admin can share it manually
- Re-add the `copyPassword` function behavior (already exists but currently shows "sent")

### 3. ReadyToApplyTable.tsx: Show temp password for student accounts

- After successful student account creation, store the returned `temp_password` in `createdTempPassword` state
- Show it with a Copy button in the success card instead of the "sent via email" message

### 4. Force Password Change on First Login (already working)

The `StudentAuthPage.tsx` already has the `must_change_password` check (lines 41-46) and the forced password change modal (lines 317-333). No changes needed here.

### 5. Commission Verification

The `create-team-member` edge function already accepts `commission_amount` from the request body (line 59 in the current code) and stores it on the profile (line 122). The `InfluencerManagement.tsx` already sends it (line 58). This flow is correct and connected.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/create-influencer/index.ts` | Remove recovery email call, return `temp_password` in response |
| `supabase/functions/create-team-member/index.ts` | Remove recovery email call, return `temp_password` in response |
| `supabase/functions/create-student-account/index.ts` | Remove recovery email call, return `temp_password` in response |
| `src/components/admin/InfluencerManagement.tsx` | Store and display temp password with copy button |
| `src/components/admin/ReadyToApplyTable.tsx` | Store and display temp password with copy button |

## Security Note

The temp password is only shown once to the admin in the creation dialog. The `must_change_password` flag ensures the user must set a new password on first login. The password is never stored in the database in plaintext -- it only exists in the auth system.

