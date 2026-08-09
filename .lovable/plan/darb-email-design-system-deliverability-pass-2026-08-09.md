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

DARB EMAIL DESIGN SYSTEM — REDESIGN EXISTING EMAILS ONLY + DELIVERABILITY SAFEGUARDS

I want you to redesign the existing email system that is already built in this project.

This is NOT a request to rebuild the email infrastructure.

The existing email sending system is already working, and email delivery speed is important. Do not make architectural changes that could slow down email delivery or introduce new delays.

The priority is:

1. Keep the existing email infrastructure and speed exactly as it is.

2. Redesign the emails professionally using the existing Darb website branding.

3. Use the existing built-in email provider and verified [darb.agency](http://darb.agency) sending domain.

4. Never use [darbsocial27@gmail.com](mailto:darbsocial27@gmail.com) as the From/sender address.

5. Improve deliverability without changing the working sending architecture.

⸻

CRITICAL: DO NOT BREAK THE EXISTING EMAIL SYSTEM

Before changing anything, understand how the current email system works.

The current verified sending configuration is:

* Sending domain: [darb.agency](http://darb.agency)

* Existing verified sender: [support.darb.agency](http://support.darb.agency)

* Existing email provider: KEEP THE CURRENT PROVIDER

* Existing queue: KEEP

* Existing retry/backoff system: KEEP

* Existing DLQ: KEEP

* Existing suppression system: KEEP

* Existing authentication email flow: KEEP

* Existing triggers: KEEP

* Existing recipient logic: KEEP

* Existing database logic: KEEP

DO NOT:

* Switch email providers

* Introduce a new email provider

* Replace the existing queue

* Replace the existing retry system

* Replace the existing authentication email system

* Add a new external email service

* Add unnecessary middleware between the application and email provider

* Add synchronous operations that delay sending

* Add tracking systems

* Add unnecessary API calls during email generation

* Change existing email timing

* Change existing triggers

* Change existing recipients

* Change existing database behavior

* Change Supabase authentication behavior

* Move email generation to the frontend

* Put email credentials in frontend code

PERFORMANCE IS A HARD REQUIREMENT

The current email system is already delivering emails quickly.

Do not sacrifice that speed for visual redesign.

The redesigned templates should be lightweight and should not introduce unnecessary:

* Database queries

* Network requests

* API calls

* Image processing during send

* External services

* Tracking calls

* Rendering delays

Email generation should remain as fast as, or faster than, the current implementation.

If a proposed change could make sending slower, DO NOT implement it without first finding a way to achieve the same result without affecting delivery speed.

⸻

1. REDESIGN WHAT ALREADY EXISTS

Do NOT invent an entirely new email architecture.

Take the email templates that already exist and redesign their presentation.

Current verified email paths:

AUTH EMAILS

auth-email-hook

Existing templates:

* signup

* magic-link

* recovery

* invite

* email-change

* reauthentication

Location:

supabase/functions/_shared/email-templates/

These already support Arabic/RTL.

Preserve their existing functionality and variables.

⸻

APPLICATION EMAILS

send-transactional-email

Existing templates:

* new-message

* email-test

* student-invite

* partner-invite

Location:

_shared/transactional-email-templates/

Existing callers:

* create-student-from-case

* approve-partner-recruit

* notify-new-message

Preserve these exact contracts.

⸻

2. USE THE EXISTING DARB WEBSITE BRANDING

Do NOT invent a new visual identity.

Use the existing website as the source of truth.

Use:

Logo

Existing website logo:

public/lovable-uploads/d0f50c50-…png

Use the real Darb website logo.

Do not create a different logo.

Do not use a random icon.

Do not replace the brand with a generic email-company logo.

⸻

Brand colors

Use the existing colors from:

src/index.css

Current brand values include:

* Navy: hsl(222 47.6% 11.2%)

* Gold: --brand hsl(41 96% 54%)

* Existing radius: 0.5rem

Use these as the visual foundation.

Do not randomly introduce unrelated colors.

⸻

Social media

Use the existing social links and icons from:

src/components/landing/Footer.tsx

Existing social platforms include:

* Instagram

* TikTok

* Facebook

Use the actual configured links.

Do not invent URLs.

Do not use emoji as social icons.

Do not add social accounts that don’t exist.

⸻

Contact information

Use the existing contact configuration from:

src/lib/contactConfig.ts

Do not invent phone numbers, WhatsApp numbers, email addresses, or social links.

⸻

3. EMAIL DESIGN

Create a professional Darb email design while preserving the existing content and functionality.

The design should feel:

* Professional

* Trustworthy

* Modern

* Premium

* Clean

* International

* Appropriate for an education/relocation company

* Consistent with the Darb website

Avoid:

* Generic SaaS templates

* Excessive gradients

* Huge graphics

* Excessive decoration

* Spammy marketing aesthetics

* Too many colors

* Excessive emojis

* Huge headings

* Excessive whitespace

* Image-only emails

⸻

4. SHARED EMAIL COMPONENTS

Create reusable email UI components ONLY where this does not interfere with the existing email architecture.

Suggested module:

supabase/functions/_shared/email-ui/

Possible components:

* theme.ts

* EmailLayout

* EmailHeader

* EmailFooter

* EmailButton

* EmailCard

* EmailInfoRow

* EmailStatusBadge

* EmailSocialLinks

The components must produce email-client-compatible HTML.

Use:

* Table-based layout where appropriate

* Inline styles

* Maximum width around 600px

* Fluid mobile layout

* White body/background

* RTL support

* Proper spacing

* Accessible text

* Alt text for images

Do not introduce a heavy runtime dependency just for email rendering.

Keep the implementation lightweight.

⸻

5. HEADER

Every appropriate email should have a consistent Darb header.

Use the actual Darb logo.

Example structure:

DARB LOGO

Darb Study International

The logo should be approximately 140px wide or an appropriate responsive size.

Do not make it excessively large.

⸻

6. BODY

Use a clean content hierarchy.

Example:

[Logo]

[Email title]

Hello {{first_name}},

[Existing email message]

[Relevant information card]

[Primary CTA]

[Supporting information]

Best regards,

Darb Study International

Do NOT rewrite the business logic contained in the emails.

Preserve the meaning and dynamic data.

Improve wording only where necessary for professionalism and clarity.

⸻

7. BUTTONS

Create a consistent professional CTA style.

Examples:

* تفعيل الحساب

* فتح لوحة التحكم

* إكمال الطلب

* عرض الحالة

* متابعة الطلب

* تأكيد الموعد

* إعادة تعيين كلمة المرور

Do not use generic:

“Click here”

Buttons must be:

* Mobile friendly

* Easy to tap

* Accessible

* Clearly labeled

* Visually consistent with the website

⸻

8. RTL / ARABIC

The existing templates are Arabic/RTL.

Preserve Arabic/RTL behavior.

Every Arabic email should correctly use:

dir="rtl"

Make sure:

* Text alignment is correct

* Cards work correctly

* Buttons render correctly

* Numbers remain readable

* Dates remain readable

* Icons don’t appear in the wrong direction

* Layout doesn’t break on mobile

Do not remove Arabic support.

Do not change existing language behavior unless explicitly requested.

⸻

9. LOGO HOSTING

The current templates reference:

student-documents/n.png

Replace this ad-hoc logo reference with a proper email-safe HTTPS logo asset only if doing so does not slow down or destabilize email sending.

If a public email-assets storage location is already available, use it.

If creating one requires infrastructure changes that could affect the existing sending system, STOP and report it instead of making risky changes.

The logo must:

* Load over HTTPS

* Be publicly accessible to email clients

* Have alt text

* Be optimized

* Not require authentication

* Not require a database lookup during every email send

Prefer a stable static asset.

⸻

10. PLAIN-TEXT VERSION

Where the existing email infrastructure supports multipart email:

Add a proper plain-text version.

Do not simply strip HTML.

The plain-text version should contain:

* Sender

* Main message

* Important information

* CTA URL

* Relevant contact information

If adding plain-text support would require changing the existing sending architecture or slow down sending, do not rebuild the architecture.

Use the existing provider’s supported mechanism.

⸻

11. DELIVERABILITY

Improve deliverability without changing the working infrastructure.

SENDER

The From address must remain on the verified [darb.agency](http://darb.agency) domain.

NEVER use:

[darbsocial27@gmail.com](mailto:darbsocial27@gmail.com)

as the From address.

Do not use Gmail as the business sender.

The sender should use the existing verified Darb sending identity.

Use a consistent From name:

Darb Study International

If the current provider supports a verified Reply-To address on [darb.agency](http://darb.agency), use that.

If [support@darb.agency](mailto:support@darb.agency) does not actually exist or is not verified, DO NOT invent it.

Do not use [darbsocial27@gmail.com](mailto:darbsocial27@gmail.com) as Reply-To simply because it currently exists in the code.

Instead:

1. Check whether a legitimate Darb-domain support/reply address already exists.

2. If one exists, use it.

3. If one does not exist, report that an external mailbox/address needs to be configured.

4. Do not break the existing sending configuration while waiting for that change.

⸻

12. SPF / DKIM / DMARC

Audit the current [darb.agency](http://darb.agency) email authentication.

Check:

* SPF

* DKIM

* DMARC

Do NOT blindly modify DNS.

Do NOT create duplicate SPF records.

Do NOT replace existing DNS records without verification.

If external DNS changes are required, report:

* What is missing

* What needs to be changed

* Why it is needed

* What should be configured

Do not pretend that code changes can configure DNS if Lovable does not have access to the DNS provider.

⸻

13. DUPLICATE EMAIL PROTECTION

Audit existing email callers for duplicate-send risks.

Do not rebuild the queue.

Do not replace the existing retry system.

Where safe, ensure important email events have idempotency protection.

Especially review:

* student-invite

* partner-invite

Potential idempotency keys can be based on:

case/application ID + template name + event

But only implement this if it is compatible with the existing architecture.

The goal is:

One event → one intended email

A React rerender, double click, retry, or repeated request must not accidentally send multiple identical emails.

⸻

14. EXISTING RETRIES — DO NOT CHANGE

The existing system already has:

* Retry/backoff

* DLQ

* Up to 5 attempts

KEEP THIS EXACT SYSTEM.

Do not replace it.

Do not add another retry mechanism on top of it.

Do not increase retries.

Do not add aggressive immediate retries.

Do not introduce duplicate retry layers.

The existing delivery performance must remain unchanged.

⸻

15. BOUNCE / SUPPRESSION

The existing system already checks:

suppressed_emails

Verify that this works correctly.

Do NOT rebuild it.

Do not remove it.

Do not bypass it.

Hard-bounced or suppressed addresses should not repeatedly receive emails.

⸻

16. DEAD LETTER QUEUE

There are currently 11 permanently failed emails in the DLQ.

Do NOT blindly resend them.

Inspect the recorded error in:

email_send_log

Determine the cause.

Report:

* Number of failed emails

* Error types

* Whether the failures are temporary or permanent

* Whether any action is required

Do not automatically replay the DLQ during this redesign.

⸻

17. EMAIL CONTENT ANTI-SPAM GUARDRAILS

Keep emails natural and professional.

Avoid:

* Fake urgency

* Misleading subjects

* Excessive capitalization

* Excessive exclamation marks

* Excessive emojis

* Spammy sales language

* URL shorteners

* Suspicious redirects

* Hidden text

* Invisible keywords

* Fake headers

* Image-only emails

* Excessive links

Do not use tricks designed to bypass spam filters.

Use legitimate deliverability practices instead.

⸻

18. EMAIL LINKS

All email links should:

* Use HTTPS

* Point to legitimate Darb domains

* Work correctly

* Avoid unnecessary redirects

* Avoid URL shorteners

Do not invent links.

Do not replace existing working URLs unless there is a clear reason.

⸻

19. EMAIL IMAGES

Keep images lightweight.

Do not load images from random external services.

Do not add unnecessary images.

The Darb logo should be the primary branding asset.

Emails must remain useful even if images are blocked.

⸻

20. DO NOT ADD TRACKING

Do not introduce:

* Tracking pixels

* Marketing trackers

* Third-party analytics

* Link shorteners

* Unnecessary external requests

Keep transactional emails lightweight and fast.

⸻

21. SECURITY

Verify:

* Email provider credentials remain server-side

* Supabase service keys remain server-side

* No email secrets exist in frontend code

* Users cannot manipulate recipients

* Unauthorized users cannot trigger privileged emails

* Email content cannot be abused to send arbitrary messages

* Existing authentication protections remain intact

Do not change authentication logic unnecessarily.

⸻

22. EXISTING EMAILS ONLY

For this pass, redesign the emails that actually exist.

Do not automatically build new email triggers for:

* Visa status

* Welcome

* Payment confirmed

* Appointment confirmed

* Case assigned

* Commission/payout

* Contact-form acknowledgement

unless I explicitly ask for those workflows.

The audit may mention that these are currently missing, but do not change application behavior by creating new email triggers in this redesign.

⸻

23. FINAL PERFORMANCE REQUIREMENT

Before finishing, compare the new implementation against the existing one.

The redesign must NOT:

* Increase email send latency unnecessarily

* Add synchronous external requests

* Add database queries per email unnecessarily

* Add new API calls per email unnecessarily

* Replace the provider

* Replace the queue

* Replace retries

* Replace authentication hooks

* Slow down email generation

The current fast delivery behavior is a requirement.

Visual redesign must not come at the cost of delivery speed or reliability.

⸻

24. TEST EVERYTHING

Render and test every existing template:

Auth

* signup

* magic-link

* recovery

* invite

* email-change

* reauthentication

Transactional

* new-message

* email-test

* student-invite

* partner-invite

Verify:

* Logo loads

* Logo URL is HTTPS

* Links are HTTPS

* Links point to legitimate Darb domains

* No “Click here”

* Existing variables render

* Arabic/RTL works

* Mobile layout works

* Desktop layout works

* Buttons work

* Social links work

* Contact information is correct

* No broken images

* No broken links

* No accidental Gmail sender

* From domain remains [darb.agency](http://darb.agency)

* Existing provider remains unchanged

⸻

25. FINAL E2E EMAIL TEST

Perform an actual end-to-end test through the existing email system.

Confirm:

1. Application triggers the email.

2. Existing queue processes it.

3. Existing provider sends it.

4. Email arrives.

5. Delivery speed remains comparable to the current system.

6. From address is the verified [darb.agency](http://darb.agency) sender.

7. Sender name is “Darb Study International”.

8. [darbsocial27@gmail.com](mailto:darbsocial27@gmail.com) is NOT used as the From address.

9. Reply-To is legitimate and verified.

10. Email renders correctly.

11. Logo loads.

12. CTA works.

13. Arabic RTL works.

14. No duplicate email is generated.

15. Retry behavior remains unchanged.

16. Suppression behavior remains unchanged.

Do not merely test template rendering. Test the actual existing sending pipeline.

⸻

26. FINAL REPORT

At the end, provide a concise report with:

DESIGN

* Templates found

* Templates redesigned

* Templates skipped

* Shared components created

* Brand assets used

SENDING

* Existing provider

* Sending domain

* From address

* From name

* Reply-To

* Confirmation that [darbsocial27@gmail.com](mailto:darbsocial27@gmail.com) is NOT the From address

PERFORMANCE

* Existing email flow preserved: YES/NO

* Existing queue preserved: YES/NO

* Existing retry system preserved: YES/NO

* Existing DLQ preserved: YES/NO

* Existing suppression preserved: YES/NO

* Any new synchronous work added: YES/NO

* Any potential impact on send speed: clearly explain

DELIVERABILITY

* SPF: status

* DKIM: status

* DMARC: status

* Bounce handling: status

* Suppression: status

* Duplicate protection: status

* Retry protection: status

SECURITY

* Secrets exposed: YES/NO

* Frontend email credentials: YES/NO

* Unauthorized email triggering risk: YES/NO

EXTERNAL ACTIONS REQUIRED

Clearly separate anything I need to configure outside Lovable, such as:

* DNS

* SPF

* DKIM

* DMARC

* Mailbox / Reply-To address

Do not claim these are completed unless they were actually verified.

⸻

FINAL RULE

DO NOT REBUILD WHAT ALREADY WORKS.

The existing email system is already sending quickly.

I want you to make the emails look significantly more professional and branded, while keeping the existing:

provider + sending domain + queue + triggers + timing + retries + suppression + authentication + performance.

The redesign must be a presentation and deliverability improvement, not an infrastructure replacement.