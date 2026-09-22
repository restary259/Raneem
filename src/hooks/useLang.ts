import { useTranslation } from "react-i18next";

export type Lang = "en" | "ar" | "he";

// Re-exported so layout gates and helpers all share one RTL definition.
export { isRtlLng } from "../i18n";

/**
 * The active UI language as a narrow union, derived once from the i18n instance.
 * Centralised so components don't each re-derive (and risk diverging on) the
 * `ar` vs `en` vs `he` detection.
 */
export function useLang(): Lang {
  const { i18n } = useTranslation();
  const lng = i18n.language?.toLowerCase() ?? "en";
  if (lng.startsWith("ar")) return "ar";
  if (lng.startsWith("he")) return "he";
  return "en";
}