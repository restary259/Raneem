import i18n from "@/i18n";

const SUPPORTED = ["ar", "en", "he"] as const;

/**
 * Resolve a `common`-namespace string for the route `head()` functions.
 *
 * Route `head()` runs on the server (SSR) and during client navigation, where
 * `useTranslation` is not available. Reading the eagerly-bundled locale
 * resources through the i18n instance removes the hardcoded Arabic literals
 * that used to be duplicated between `head()` and `SEOHead`, so the two
 * mechanisms cannot drift to different values for the same page.
 *
 * Arabic is the canonical default for this audience; a missing key falls back
 * to Arabic and finally to the key itself.
 */
export function routeText(key: string, ns = "common"): string {
  const active = i18n.language;
  const language =
    typeof active === "string" &&
    (SUPPORTED as readonly string[]).includes(active)
      ? active
      : "ar";
  return (
    (i18n.getResource(language, ns, key) as string | undefined) ??
    (i18n.getResource("ar", ns, key) as string | undefined) ??
    key
  );
}

/**
 * Pick the entry for the active language from per-language dictionaries.
 *
 * `routeText` only reaches eagerly-bundled namespaces. Structured data that
 * needs a non-bundled namespace imports its locale JSON directly, so a route
 * module can hand the whole dictionary here and get the right one for the
 * current language (Arabic during SSR, the chosen one on client navigation).
 */
export function pickLang<T>(dicts: Record<"ar" | "en" | "he", T>): T {
  const active = i18n.language;
  const language = (SUPPORTED as readonly string[]).includes(active)
    ? (active as "ar" | "en" | "he")
    : "ar";
  return dicts[language] ?? dicts.ar;
}

/**
 * Build a JSON-LD `<script type="application/ld+json">` for a route `head()`.
 *
 * The payload is emitted through the router's SSR `HeadContent` renderer, not
 * appended to `document.head` from a client effect. That is the difference
 * between schema a crawler actually receives and schema it never sees — see
 * `AGENTS.md`, "Route head() is the crawler trust boundary". Prefer this over
 * `SEOHead`'s `jsonLd` prop for any structured data that must be
 * machine-readable.
 *
 * `<` is escaped so a locale string containing `</script>` cannot terminate the
 * tag; JSON-LD consumers decode `\u003c` back to `<`.
 */
export function jsonLdScript(payload: unknown): {
  type: "application/ld+json";
  children: string;
} {
  return {
    type: "application/ld+json",
    children: JSON.stringify(payload).replace(/</g, "\\u003c"),
  };
}
