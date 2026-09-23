# Normalize the Arabic DARB name everywhere

## Goal
Use **درب** as the only Arabic rendering of the brand across the public website, every dashboard, invoices, PDFs, emails, notifications, and saved Arabic content. Keep Latin `DARB` only where it is an identifier or intentionally part of a bilingual/legal name.

## Verified audit findings
- The current invoice page and PDF labels now use **درب**, but they need regression coverage because this was a confirmed error surface.
- The Arabic dashboard dictionary still contains six visible Latin `DARB` references in finance, invitations, and agent-network copy.
- The shared Arabic dictionary and its source mirror still show `Darb`/`DARB` in the navigation brand, login subtitle, and About title.
- The Arabic homepage eyebrow and Resources CTA still use Latin branding.
- The database contains one saved GoAcademy recommendation with **مكتب دارب**; a forward-only corrective migration is already present in the repository, while the historical seed remains unchanged for migration integrity.
- Invoice and transactional email templates otherwise use the correct Arabic spelling **درب**. Latin case references such as `DARB-1042`, the domain `darb.agency`, and English-language text are not spelling errors and remain unchanged.
- Search false positives such as **إداري**, **الدراسة**, and **الفضائية** are ordinary Arabic words and must not be altered.

## Changes
1. **Public Arabic copy**
   - Replace visible `Darb`/`DARB` brand labels with **درب** in the Arabic navigation, login, About title, homepage eyebrow, and Resources CTA.
   - Update both runtime public dictionaries and their mirrored source dictionaries where both exist.
   - Preserve the legal bilingual introduction `درب (Darb)` and all email/domain addresses.

2. **Dashboard Arabic copy**
   - Normalize the remaining Latin `DARB` references in Finance, invoice creation, agent approval, and invitation messages to **درب**.
   - Leave internal translation keys and code identifiers containing `Darb` unchanged; only displayed values change.

3. **Invoices, PDFs, and emails**
   - Confirm all Arabic invoice screen, PDF, subject, body, CTA, and fallback-link wording uses **درب**.
   - Keep the duplicated email preview and deployed-template trees synchronized if any correction is required.
   - Do not alter English email branding or case/invoice reference prefixes.

4. **Saved backend content**
   - Keep the historical GoAcademy seed migration immutable.
   - Retain and apply the targeted corrective migration that changes the saved phrase from **مكتب دارب** to **مكتب درب**.
   - Re-query saved Arabic notifications, school notes, messages, and event text after migration; do not change unrelated URLs containing `darb.agency`.

5. **Permanent safeguard**
   - Add a focused automated audit that fails when user-facing Arabic source values contain known wrong spellings such as **دارب**, **داري**, **دآرب**, or Arabic-locale values use Latin `DARB/Darb` outside an explicit allowlist for legal bilingual naming, URLs, reference codes, and internal keys.
   - Cover public dictionaries, dashboard dictionaries, invoice/PDF labels, and both email-template trees.

## Verification
- Search the full repository and saved Arabic database content for wrong variants, reviewing matches contextually to avoid false positives.
- Validate all edited locale JSON and run Arabic i18n parity plus the new brand-spelling test.
- Check the Arabic public navigation/login/About/homepage, representative admin/team/partner/student dashboard screens, a public invoice, an invoice PDF, and email previews.
- Verify phone, tablet, and desktop layouts remain intact; this is a wording-only change.
- Confirm the preview build is clean.
