# Master Partner toggle — make it visible where you're looking

## What's actually happening

The toggle was built and works, but it only renders in one place: **Finance → Payouts → Partners directory** (`PartnersDirectory.tsx` rows and the Partner Profile panel). Your screenshot is the **Team** page (`/admin/team`), which lists partners too (Ryan, partner, ambassador) but only shows the Manager switch for `team_member` rows. That page has no Master control at all, so nothing appears.

## Fix

Add the same `MasterPartnerToggle` to the Team page partner rows so the control lives where partners are actually managed.

- In `src/pages/admin/AdminTeamPage.tsx`, load `is_master_partner` alongside the existing profile fields for the listed users.
- For rows with role `social_media_partner`, render `<MasterPartnerToggle variant="chip" ... />` in the same spot the Manager switch occupies for team members (ambassadors excluded — they can't be master partners).
- After a confirmed toggle, update local state optimistically so the row's badge flips immediately.
- Show the amber "Master" badge next to the partner's name once upgraded, matching the directory styling.

No changes to data model, commissions, invite links, or the partner's own dashboard — the flag and its downstream behaviour already exist.

## Technical notes

- Reuse `src/components/admin/MasterPartnerToggle.tsx` as-is; no new props needed.
- The Team page currently selects profiles for the listed `user_roles`; extend that select with `is_master_partner`.
- Translation keys (`admin.payouts.master*`) already exist in both locales.
