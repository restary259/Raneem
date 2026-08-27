# Restore DARB branding to authentication emails

## What I verified (facts, not assumptions)

- **App emails (invoices, invitations, appointment reminders, new-message alerts) are fine.** All 10 templates in `_shared/transactional-email-templates/` still import the DARB design system (`_shared/email-ui/`) — navy layout, gold accents, blue logo, Arabic copy. Confirmed by file scan.
- **Payloads were preserved during the email update.** Compared every converted call site (account invitations, agent recruit, agent-created accounts, student-from-case, partner approval, new-message, appointment reminders) against the pre-update code: template names and template data fields are identical, so no invite email lost its name/link/case reference.
- **The audit log still works.** `email_send_log` and `suppressed_emails` accept exactly the values the new code writes (`sent` / `suppressed` / `failed` / `bounced` / `complained`, and `bounce` / `complaint` / `unsubscribe`); the required `category` column has a default, so no write will be rejected.
- **No leftover old sending paths.** No code references the removed queue or the removed send function. The remaining `send-email`, `send-branded-email`, `send-event-email`, `send_welcome_email`, `send-custom-notification` functions only write in-app notifications / contact-form rows — they are not email senders.
- **The one real regression: the 6 authentication emails lost their branding.** `signup`, `invite`, `magic-link`, `recovery`, `email-change`, `reauthentication` were overwritten with generic English boilerplate and no longer import the DARB design system. Their subject lines are also generic English ("Confirm your email", "Reset your password"), where DARB previously used Arabic subjects.

## Fix

1. Restore the six auth email templates to their DARB-branded, Arabic versions (the exact pre-update content: navy layout + logo header, Arabic body copy, gold CTA button, fallback link, info cards for email/verification code). The scaffolded hook's prop names stay unchanged, so nothing else needs adjusting.
2. Restore the Arabic subject lines in the auth email hook:
   - signup: تأكيد بريدك الإلكتروني — درب
   - invite: دعوة للانضمام إلى منصة درب
   - magiclink: رابط الدخول إلى حسابك — درب
   - recovery: إعادة تعيين كلمة المرور — درب
   - email_change: تأكيد بريدك الإلكتروني الجديد — درب
   - reauthentication: رمز التحقق الخاص بك — درب
3. Redeploy the auth email function so the branded versions are live.
4. Render each of the six templates through the built-in preview endpoint and check visually (logo loads, RTL correct, button and fallback link present) — not just "it compiles".
5. Run `npm run build` and the test suite as the final gate.

## One leftover to flag (no action now)

A scheduled background job named `email-queue-safety-sweep` still points at the removed queue processor. It is harmless (the old sending path is gone) but will log a failure every 5 minutes after the update goes live. Recommend removing it right after you publish; I have not touched scheduling, since the update process owns that cutover.
