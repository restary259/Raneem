import { useTranslation } from "react-i18next";

/**
 * The active UI language as a narrow union, derived once from the i18n instance.
 * Centralised so components don't each re-derive (and risk diverging on) the
 * `ar` vs `en` detection.
 */
export function useLang(): "en" | "ar" {
  const { i18n } = useTranslation();
  return (i18n.language?.startsWith("ar") ? "ar" : "en") as "en" | "ar";
}
