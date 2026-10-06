# Hide the Refer page from student accounts (temporary)

Reversible — nothing deleted; referral data, rewards and admin referral tools untouched.

## Changes
1. `src/components/layout/dashboardNavigation.ts` — remove the two `nav.refer` entries (lines ~123, ~132) from student nav (sidebar + mobile).
2. `src/components/student/StudentOverviewSection.tsx` — remove the "Refer a friend" quick link (line ~82).
3. `src/components/student/ReferralRegistrationFlow.tsx` — remove/replace the `/student/refer` link (line ~407) with a link to `/student` dashboard.
4. `src/routes/student.refer.tsx` — add `beforeLoad` redirect to `/student`, so bookmarked/direct visits land on the dashboard. Page component file kept for easy re-enable.

## Not changed
- Locale keys (`nav.refer`) kept so re-enabling is a one-line revert.
- Referral backend, admin `/admin/referrals`, commission hub.

## Verify
Typecheck; nav tests; open `/student/refer` as a student → redirected to `/student`; no Refer item in sidebar/mobile nav.
