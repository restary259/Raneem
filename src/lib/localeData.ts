/**
 * Which side of the bilingual domain data to read for a given UI language.
 *
 * Majors, university intelligence and partner-school facts are authored in
 * Arabic + English only (there is no Hebrew copy). Arabic is therefore the ONLY
 * language that reads the Arabic side; every other language — Hebrew included —
 * reads English, matching the app-wide `fallbackLng: { he: ['en'] }`.
 *
 * Selecting with `lang === 'en' ? EN : AR` inverts this: Hebrew is neither
 * `'en'` nor `'ar'`, so it silently lands in the Arabic branch and renders
 * Arabic prose to Hebrew readers. Use this predicate instead of a binary
 * English-vs-otherwise check.
 */
export function isArabicUi(lang: string | undefined): boolean {
  return Boolean(lang?.startsWith("ar"));
}
