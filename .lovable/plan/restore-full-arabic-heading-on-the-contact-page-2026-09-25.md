# Restore full Arabic heading on the Contact page

## What
The previous change replaced the Arabic heading with just "تواصل". The user wants the full phrase restored: **"تواصل مع فريق درب"** (Contact with the DARB team).

## Change
- `public/locales/ar/contact.json` — `contactHero.advisorTitle`: "تواصل" → "تواصل مع فريق درب"
- `src/locales/ar/contact.json` — same key, same value (the two copies must stay in sync)

## Notes
- English locale unchanged ("Talk with the DARB team").
- No code changes, no new keys — only the value of an existing key.

## Verification
- Build passes; the Contact page hero shows "تواصل مع فريق درب" in Arabic.
