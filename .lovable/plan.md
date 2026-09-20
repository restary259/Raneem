# Bring the email system back

## What I found

- The sender domain `support.darb.agency` is verified and email sending is switched on.
- All the email designs still exist in the project: 6 login/password emails and 10 app emails (student, team, partner, ambassador, agent invites, invoice, appointment reminder, new message, account invite, test).
- No email has been recorded as sent in the last 14 days (that is as far back as the history goes).
- The login/password email handler has never once been called — it has no activity at all.

The most likely reason: when the app was rebuilt onto the new framework, the place the platform looks for email designs and for the login-email handler moved. The old location still holds all the designs, but nothing points at it any more, so the Emails section looks empty and login emails no longer run through DARB's branded designs.

This diagnosis is not yet proven end to end, so confirming it is the first step of the work, not an assumption baked into the rest.

## Plan

1. **Confirm the cause.** Trigger one login email and one app email, then read the delivery history and the handler activity to see exactly where each one stops. If the picture differs from the above, I will report it before changing anything.

2. **Reconnect the login and password emails.** Recreate the handler in the location the platform now expects and move the existing six designs across unchanged: sign-up confirmation, password reset, magic link, invitation, email change, re-authentication. Same wording, same DARB branding, same Arabic/English handling. Retire the old handler so there is only one.

3. **Reconnect the app emails and the preview.** Register the ten app designs in the new location so they show up again in the Emails section and can be previewed there. Keep every sending trigger pointed at the same designs so invitations, invoices, payment and appointment reminders, and new-message alerts all keep their current content.

4. **Check every send path still fires.** Walk through each place the app sends mail — invitations (student, team, partner, ambassador, agent), case invoices, appointment reminders, new-message alerts, the weekly digest — and make sure each one reaches the sending service and is recorded in the delivery history.

5. **Verify without spamming anyone.** No test mail to real people. I confirm through the delivery history, the handler activity log, and the preview of each design.

6. **Report.** A short list: which emails are working again, which ones I could not prove are working, and anything that needs a decision from you.

## Technical notes

- Target contract: auth webhook at `src/routes/lovable/email/auth/webhook.ts` using `createAuthEmailHandler`; transactional registry + send helper under `src/lib/email-templates/`; preview surface under `/lovable/email/*`. Scaffolded with the email tooling, then the existing designs ported in.
- Port sources: `supabase/functions/_shared/email-templates/*` (6 auth) and `supabase/functions/_shared/transactional-email-templates/*` (10 app) — designs copied as-is, only the imports change (`npm:` specifiers to package imports, React Email components unchanged).
- Sender config stays `SENDER_DOMAIN = support.darb.agency`, `FROM_DOMAIN = darb.agency`, `SITE_NAME = Darb Study International`.
- The `email_send_log` audit table keeps receiving rows; the `sendAppEmail` wrapper's logging behaviour is preserved.
- Edge functions that send mail keep working during the transition; each is repointed at the new helper only after its template is verified in the new registry. `auth-email-hook` is removed last.
- `src/start.ts` middleware and the root route `beforeLoad` must let `/lovable/*` through untouched, or the preview returns a redirect error.
- Required packages: `@lovable.dev/email-js@0.1.0` (exact), `@lovable.dev/webhooks-js`, `@react-email/components`, `@react-email/render`, plus the `entities` 4.5.0 pin.
- No database, RLS, auth, or WhatsApp changes. No email queue or email tables — sending stays managed.
