import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Light/dark switch — rendered inside dashboards only. */
export default function ThemeToggle() {
  const { t } = useTranslation("dashboard");
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={isDark ? t("theme.light", "Light mode") : t("theme.dark", "Dark mode")}
      title={isDark ? t("theme.light", "Light mode") : t("theme.dark", "Dark mode")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
