# Multiple Partner Accounts with Unique Referral Links

Goal: allow unlimited partner (and ambassador) accounts, each with their own referral link, and remove the hard-coded "only one partner" rule.

## Current state (verified)

- Referral infrastructure already exists: every profile gets a unique `referral_code` on creation (all 5 existing users have one), the apply page captures `?ref=`, and the code is resolved server-side so attribution can't be faked.
- `ReferralLinkCard` already shows a personal link with copy + WhatsApp share, and it is already on the partner overview and student refer pages.
- The only real limit is in the admin Team page (`src/pages/admin/AdminTeamPage.tsx`): it looks up an existing partner and blocks creating a second one — the create button is disabled and an error banner is shown.
- The admin Team page also only lists/creates `team_member` and `social_media_partner`; the new `ambassador` role is missing from the list, the role dropdown and the role labels.
- The account-creation function accepts legacy role names (`influencer`, `lawyer`) that are not valid roles in the database anymore, and does not accept `ambassador`.

## What will change

### 1. Remove the single-partner limit
In the admin Team page:
- Delete the `existingPartner` lookup, the blocking check in the create handler, the warning banner, and the disabled state on the create button.
- Admins can create as many partner accounts as they want.

### 2. Add ambassadors alongside partners
- Include `ambassador` in the roles fetched for the members list, in the create dropdown, and in the role label map.
- Ambassadors are created through the same flow as partners; they get the partner dashboard and their own referral link automatically.

### 3. Show each account's referral link to the admin
- In the members list, show the referral link (with copy button) for every partner and ambassador row, so an admin can hand the link over directly.
- Reuse the existing link builder so admin and partner see the exact same URL.

### 4. Clean up the account-creation function
- Accept only the real roles: `team_member`, `social_media_partner`, `ambassador`. Drop the legacy `influencer` / `lawyer` names so an invalid role can no longer be written.

### 5. Verify attribution end to end
- Confirm every partner/ambassador profile has a referral code (backfill any missing ones as part of the check).
- Manual pass: create two partner accounts, open each link, submit an application, confirm each application is credited to the correct partner and that the commission lands on that partner only.

## Technical notes

- Files: `src/pages/admin/AdminTeamPage.tsx`, `supabase/functions/create-team-member/index.ts`, plus translation keys in the dashboard locale files for the ambassador role label and referral-link column. Remove the now-unused `admin.team.partnerExistsError` key.
- No schema change is required: `profiles.referral_code` is unique and auto-assigned by trigger, and `resolve_referral_code` already accepts partners, ambassadors and students.
- Commission remains flat shekels: per-account override first, otherwise the role default from platform settings.
