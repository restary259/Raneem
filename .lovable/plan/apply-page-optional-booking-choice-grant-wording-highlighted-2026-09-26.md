# Apply page: optional booking choice, grant wording, highlighted programs button

Three small changes to the application page (`/apply`), all in existing files. No new pages, no backend changes.

## 1. Booking step becomes a free choice, not a forced step

Today, after submitting, the student lands on the office-appointment booking screen with only a small "skip for now" link (`ApplyForm.tsx`, `phase === "booking"`).

Change it to a clear two-choice screen:

- **Option A — WhatsApp consultation for now**: a card with the WhatsApp icon. Choosing it skips booking and goes straight to the success screen. Copy (ar): "استشارة عبر واتساب الآن" with a short line that the team will message them on WhatsApp.
- **Option B — Book an early office appointment**: a card with a calendar icon. Choosing it opens the existing booking calendar (`PublicOfficeBooking`) exactly as it works today.

Both cards are equal, DARB-branded, large and tappable on phone. The tiny "skip" link is removed — the WhatsApp card replaces it. Booking stays optional; nothing is forced.

## 2. Companion wording: "extra value" becomes "grant" (منحة)

The companion step currently says (ar): "تتقدّم مع صديق أو فرد من العائلة؟ يمكنكم الحصول على قيمة إضافية تصل إلى 500 ₪ عند التقديم معًا."

New wording:

- Arabic: "تتقدّم مع صديق أو فرد من العائلة؟ يمكنكم الحصول على منحة تصل إلى 500 ₪ عند التقديم معًا."
- English: "...you can receive a grant of up to ₪500 when you apply together."
- Hebrew: updated to match ("מענק").

Key: `groupValue` in `landing.json` — updated in all four files (`src/locales` and `public/locales`, ar/en/he) so the parity guard stays green.

## 3. Highlight the "Browse all programs" button

On the success screen, `apply.browsePrograms` is currently a quiet outlined link (`ApplyForm.tsx` line 315). Make it the primary-looking action: solid brand background, brand-foreground text, same pill shape, with a hover lift. The deep-link variant (preferred major) keeps the same highlighted style.

## Files touched

- `src/components/apply/ApplyForm.tsx` — booking choice screen, browse-programs button style
- `src/locales/{ar,en,he}/landing.json` + `public/locales/{ar,en,he}/landing.json` — `groupValue` wording, new choice-screen keys (ar/en/he)

## Verification

- `npm run build` clean; `npx vitest run` green (i18n parity guard included)
- Browser check on phone (390px) and desktop: submit a test application, see the two-choice screen, pick WhatsApp (goes to success), pick booking (calendar opens), confirm the grant wording and the highlighted programs button in Arabic and English
