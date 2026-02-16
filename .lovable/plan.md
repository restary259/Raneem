

# Fix: Redeploy Edge Functions for Temp Password Display

## Problem

The screenshot shows "Login credentials have been sent to the member's email address" -- this is the OLD deployed version of the edge function. The source code has already been updated correctly to return `temp_password`, but the edge functions were never redeployed after the last changes.

## What's Already Correct (No Code Changes Needed)

All three edge functions already have the right code:
- `create-team-member/index.ts` -- returns `temp_password` in response (line 145)
- `create-influencer/index.ts` -- returns `temp_password` in response (line 135)
- `create-student-account/index.ts` -- returns `temp_password` in response (line 151)

The UI components are also correct:
- `InfluencerManagement.tsx` -- stores `result.temp_password`, shows it with Copy button (lines 62, 136-155)
- `ReadyToApplyTable.tsx` -- stores `result.temp_password`, shows it with Copy button (lines 185, 374-393)

Commission flow is also connected: the `commission_amount` is sent from `InfluencerManagement.tsx` (line 58) and stored on the profile by `create-team-member` (line 122).

## Action Required

**Redeploy all three edge functions** so the deployed versions match the source code:

1. `create-team-member`
2. `create-influencer`
3. `create-student-account`

## Post-Deploy Testing

After redeploying, test all three account creation flows:

1. **Team Member** -- Create via admin panel, verify temp password is shown with copy button
2. **Agent (Influencer)** -- Create via admin panel, verify temp password is shown with copy button
3. **Student** -- Create via ReadyToApply table, verify temp password is shown with copy button
4. **Commission** -- Set commission amount when creating, verify it is stored on the profile
5. **First Login** -- Log in with the temp password, verify the forced password change modal appears

