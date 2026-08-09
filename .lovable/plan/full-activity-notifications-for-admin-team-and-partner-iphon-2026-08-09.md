# Full activity notifications for Admin, Team and Partner (iPhone + Android)

Today the app only pushes notifications for five things: chat messages, payout status, student profile edits, referral accepted, and visa status. Everything else that happens in a case — created, assigned, appointment booked, submitted to a school, payment received, enrolled, document requested, student account activated — is written to the case timeline but nobody gets a notification.

This plan turns the existing case timeline into the single source of notifications, so every meaningful change reaches the right people on iPhone and Android through the push system that is already working.

## What each role will be notified about

Case events (all delivered to phone + bell):

| Event | Admin | Assigned team member | Partner who referred | Student |
| --- | --- | --- | --- | --- |
| New case created | yes | — | yes | — |
| Case assigned to a team member | yes | yes | — | — |
| Appointment scheduled / rescheduled | yes | yes | — | yes |
| Appointment result recorded | yes | yes | — | — |
| Student profile completed / updated | yes | yes | — | — |
| Service or cost added to a case | yes | yes | — | — |
| Payment received | yes | yes | yes | yes |
| Case submitted to the school | yes | yes | yes | yes |
| Enrollment paid / enrolled | yes | yes | yes | yes |
| Document requested | — | yes | — | yes |
| Document uploaded by student | yes | yes | — | — |
| Stage advanced (any other pipeline move) | yes | yes | — | yes |
| Case status changed | yes | yes | — | — |

Account events:

| Event | Who is notified |
| --- | --- |
| Student activates their account and signs in the first time | Admin + assigned team member |
| Student signs in again later | Admin only, at most one notification per student per day |
| New partner recruit application submitted | Admin + the master partner who recruited them |
| New partnership / contact form submission | Admin |

Notes on the choices above:
- Partners deliberately get only the milestones that affect their earnings (new case, payment, submitted, enrolled). They never receive student personal details in the notification text.
- Repeat sign-ins are collapsed to once per student per day so phones are not spammed.
- Internal-only timeline entries stay internal: students never receive them.
- Every notification still respects the recipient's existing per-topic switches and quiet hours in Notification settings, and thread mutes for chat.

## How notifications will look

Each notification carries Arabic and English text and a deep link, so tapping it on iPhone or Android opens the exact page:

- Case events → the case page for admin/team, the student's own dashboard section for students, the partner's students list for partners.
- Appointments → appointments page.
- Payments/enrollment → financials for admin, earnings for partner, dashboard for student.
- Documents → documents page.
- Sign-in and recruit events → the team/network page.

Push payloads keep containing only a short title, a short body and the link — no passport numbers, no emails, no financial breakdowns.

## Technical section

**1. One fan-out trigger on `case_events`**

Add `public.notify_case_event()` as an `AFTER INSERT` trigger on `case_events`. For each row it:
- loads the case (`assigned_to`, `partner_id`, `referred_by`, `student_user_id`, `case_reference`, `full_name`);
- resolves the recipient set for `event_type` from a mapping table baked into the function, matching the matrix above;
- skips the actor (nobody is notified about their own action) and skips students when `is_internal = true`;
- inserts one `notifications` row per recipient with `source` set so the existing `notification_category_for_source()` mapping assigns the right category, plus `title_ar/title_en/body_ar/body_en`, `case_id` and a role-aware `link`.

Admin recipients come from `user_roles` where `role = 'admin'`. Existing `enqueue_push_for_notification` + `push_queue_wake` triggers then fan out to every active device subscription, so no push-side changes are needed and iPhone/Android behave identically.

New `source` values to add to `notification_category_for_source()`: `case_created`, `case_assigned`, `case_submitted`, `enrollment`, `document_uploaded`, `student_signin`, `recruit_application`, `partnership_submission`.

**2. Sign-in notifications**

Add an `AFTER INSERT` trigger on `active_sessions` (written by the `auth-guard` edge function) that:
- fires only when the signing-in user has the `student` role;
- checks whether an earlier `active_sessions` row exists for that user — first ever session emits "activated their account and signed in" to admin + assigned team member;
- otherwise emits "signed in" to admins only, suppressed when a `student_signin` notification for the same user already exists in the last 24 hours.

**3. Recruit and form submissions**

- `AFTER INSERT` trigger on `partner_recruit_applications` → notify admins and the recruiting master partner.
- `AFTER INSERT` trigger on `contact_submissions` → notify admins, linking to the admin inbox.

**4. Preference safety**

`push-dispatch` already blocks delivery when `push_enabled` is off or the matching `cat_*` column is false; the categories are correct after the trigger added earlier today. No UI change is required, but the notification-settings screen keeps its existing switches as the opt-out for every new event type.

**5. Volume control**

Because admins receive nearly everything, the fan-out function collapses `status_changed` and `stage_advanced` into a single notification when both are logged for the same case within one minute, and skips `message_sent` (chat already has its own notification path).

**6. Verification**

- Unit-level: SQL checks that inserting each `event_type` produces exactly the expected recipient rows and no rows for the actor.
- Live: run one case end to end (create → assign → appointment → submit → payment → enroll) and confirm the bell and the phone receive each step, with correct deep links on both iPhone and Android.
