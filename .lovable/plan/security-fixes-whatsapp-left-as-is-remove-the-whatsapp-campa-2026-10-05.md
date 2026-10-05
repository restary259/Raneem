# Security fixes (WhatsApp left as is) + remove the WhatsApp Campaigns page

WhatsApp inbox scoping is out of scope for now. Every fix keeps today's behaviour for legitimate users: same pages, same flows, same results. Only abuse paths close.

## 1. Remove the WhatsApp Campaigns page
- Remove the "WhatsApp campaigns" item from the admin menu, and delete the page and its address.
- Old links to `/admin/whatsapp-campaigns` send admins to the admin Messages page instead of a blank screen.
- Campaign data in the database stays untouched.

## 2. Rescheduling a booking can't jump to another office
- When someone reschedules with their booking link, they can only stay in the office they booked with. Moving to another office only works if that office is active and accepting bookings. Today the reschedule step accepts any office.
- Normal reschedules work exactly as before.

## 3. Rate limits that actually hold
- Contact-form emails, the public AI chat and the WhatsApp AI helper currently count requests in temporary server memory, which resets often. Move the counting to the database, using the login-protection table that already exists.
- Limits and messages stay the same.

## 4. Contact form only through the protected path
- Block anonymous direct writes to the contact-submissions table. The website's contact form keeps working through its existing rate-limited path.

## 5. Dashboard sections check sign-in before loading
- The admin and team areas check sign-in and role before loading their page code, instead of loading it first and redirecting afterwards. What users see doesn't change.

## 6. Pending database file (you run it)
- `docs/manual-sql/20261004150000_payment_proofs_and_invited_students.sql` is still needed for student invoice/proof access and Kheir's Students tab. I'll add the new SQL for points 3 and 4 in a separate manual file next to it.

## Checks
- Typecheck plus the related tests (booking, navigation, rate limiting).
- Browser: the admin menu has no Campaigns item and the old link redirects; the contact form submits; a public reschedule still works; admin/team pages still open normally.

## Technical details
- Delete `src/routes/admin.whatsapp-campaigns.tsx` and `src/pages/admin/WhatsAppCampaignsPage.tsx`, and remove the nav entry in `dashboardNavigation.ts` (~line 250). Add a redirect route to `/admin/messages?tab=whatsapp`, following the `admin.whatsapp.tsx` pattern.
- `publicBooking.functions.ts` (~407/416): if `data.officeId` differs from `current.office_id`, validate it with an `is_active` + `booking_enabled` lookup (the same check as `calculateAvailability`); otherwise use `current.office_id`.
- New SQL `docs/manual-sql/20261005120000_security_hardening.sql`: a SECURITY DEFINER `check_rate_limit(p_key text, p_max int, p_window_seconds int)` backed by `login_attempts` (or a small table with grants and RLS). Also `REVOKE INSERT ON public.contact_submissions FROM anon` and drop the anon insert policy. The edge functions call the RPC in place of their in-memory Maps, and the send-email insert uses the service role.
- `admin.tsx` / `team.tsx`: client-only `beforeLoad` that checks the session plus `get_my_role()` and redirects to `/auth` (`ssr: false` for those subtrees). The existing ProtectedRoute and AdminSecurityGate stay.
- Redeploy send-email, ai-chat and whatsapp-ai-assist once the SQL is live.
