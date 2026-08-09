# Darb Email Design System + Deliverability Pass

## Audit findings (verified in code, before any changes)

Only **two** paths actually deliver email; everything else named "email" is in-app notifications only.

**A. Auth emails** — `auth-email-hook` + 6 templates in `supabase/functions/_shared/email-templates/`:
signup, magic-link, recovery, invite, email-change, reauthentication. Arabic/RTL, each with its own
inline style block, logo pulled from a Supabase Storage object (`.../student-documents/n.png`).

**B. App emails** — `send-transactional-email` + registry with 4 templates in
`_shared/transactional-email-templates/`: `new-message`, `email-test`, `student-invite`,
`partner-invite`. Callers: `create-student-from-case` (student-invite),
`approve-partner-recruit` (partner-invite), `notify-new-message` (new-message).
Sender: `support.darb.agency` (verified), From domain `darb.agency`.

**C. Functions that send nothing** (they only insert rows into `notifications`, despite their names):
`send-branded-email`, `send_welcome_email`, `send-custom-notification`, `admin-weekly-digest`,
`send-event-email` (visa status templates exist but the body is only `console.log`-ed),
`send-email` (contact form → writes to `contact_submissions`, no email is sent).

So today there is **no** email for: visa status change, welcome, payment confirmed, appointment
confirmed, case assigned, commission/payout updates, contact-form acknowledgement.

Brand sources of truth found: logo `public/lovable-uploads/d0f50c50-…png` (site header),
colors in `src/index.css` (navy `hsl(222 47.6% 11.2%)`, gold `--brand hsl(41 96% 54%)`, radius 0.5rem),
socials in `src/components/landing/Footer.tsx` (Instagram, TikTok, Facebook),
contact in `src/lib/contactConfig.ts` (WhatsApp, support email/phone).

## What to build

### 1. Shared design-system module
New `supabase/functions/_shared/email-ui/` (importable by both auth and app templates):
`theme.ts` (colors, fonts, spacing, radius, brand constants, social + contact links),
and components `EmailLayout`, `EmailHeader`, `EmailFooter`, `EmailButton`, `EmailCard`,
`EmailInfoRow`, `EmailStatusBadge`, `EmailSocialLinks`.
Table-based, inline styles only, 600px max width, fluid on narrow screens, white `Body`,
RTL-aware (`dir` prop), alt text on every image, status conveyed by label + icon, never colour alone.

### 2. Rewrite all 10 existing templates on the new system
6 auth + 4 app templates, keeping every existing prop name and the registry contract untouched.
Subject lines reviewed for clarity/honesty; descriptive CTAs ("تفعيل الحساب", "فتح لوحة التحكم").
No unsubscribe footer added to auth/security emails.

### 3. Logo hosting
Upload the real site logo to a public `email-assets` storage bucket over HTTPS and point every
template at it (replacing the current ad-hoc `student-documents/n.png` reference). Sized ~140px
wide, optimized, with alt text.

### 4. Plain-text fallback
Hand-written `text` variant per template (not stripped HTML) passed through the existing send path
where the API accepts it; otherwise added as a template field for future use.

### 5. Preview + tests
Extend `preview-transactional-email` coverage and add unit tests that render every template
(auth + app) and assert: logo URL is HTTPS, all links HTTPS and on `darb.agency`, no `Click here`,
required variables render, RTL attribute present.

## Deliverability work (code side)

- **Sender identity**: keep `support.darb.agency` / From `darb.agency` exactly as-is; add a single
  consistent From name "Darb Study International" and a verified `Reply-To`.
  *Open question below — the only support address in code is a Gmail address.*
- **Duplicate protection**: audit each caller for an `idempotencyKey`. `student-invite` and
  `partner-invite` need keys derived from case/application id + template name so retries and
  double-clicks cannot double-send.
- **Dead letters**: 11 emails permanently failed and are sitting in the DLQ. Investigate the recorded
  error in `email_send_log` and report the cause; no blind re-send.
- **Bounce/suppression**: already wired (`suppressed_emails` checked before send) — verify, don't rebuild.
- **Retries**: existing queue does backoff + DLQ after 5 attempts; leave as is.
- **Secrets**: confirm no email credentials reachable from the browser.
- **Tracking**: none to be added.

## Explicitly not changed

Triggers, recipients, timing, provider, queue, auth flow, database logic. The dead functions in (C)
are left in place; I'll list them in the report as candidates for removal or wiring up, but won't
touch behaviour in this pass.

## Final report you'll get

Templates found / redesigned / skipped; SPF, DKIM, DMARC and domain status; sending domain, From,
Reply-To, provider; duplicate/retry/bounce/rate-limit/invalid-address status; and a clean split of
"fixed in code" vs "needs you to configure externally".

## Two decisions I need from you

1. **Reply-To address** — the only support address in the codebase is `darbsocial27@gmail.com`.
   Using a Gmail address as Reply-To on business mail is allowed but weakens trust. Preferred:
   an address on `darb.agency` (e.g. `support@darb.agency`) if that mailbox exists.
2. **Language** — all current templates are Arabic/RTL. Keep Arabic-only, or add English variants
   for staff/admin-facing emails?
