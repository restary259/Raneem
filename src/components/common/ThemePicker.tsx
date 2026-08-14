import { Check, Moon, Palette, Sun, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ThemeKey = "light" | "dark" | "aurora";

const THEMES: {
  key: ThemeKey;
  icon: typeof Sun;
  labelKey: string;
  labelFallback: string;
  descKey: string;
  descFallback: string;
  /** Miniature preview swatch — literal colours are intentional here: the
   *  swatch must show a theme that is NOT the currently active one. */
  swatch: { bg: string; surface: string; accent: string; line: string };
}[] = [
  {
    key: "light",
    icon: Sun,
    labelKey: "theme.light",
    labelFallback: "Light",
    descKey: "theme.lightDesc",
    descFallback: "Bright and neutral",
    swatch: { bg: "#ffffff", surface: "#f1f5f9", accent: "#1e293b", line: "#cbd5e1" },
  },
  {
    key: "dark",
    icon: Moon,
    labelKey: "theme.dark",
    labelFallback: "Dark",
    descKey: "theme.darkDesc",
    descFallback: "Low-glare charcoal",
    swatch: { bg: "#121214", surface: "#1c1c20", accent: "#f5f5f5", line: "#2c2c32" },
  },
  {
    key: "aurora",
    icon: Sparkles,
    labelKey: "theme.aurora",
    labelFallback: "Aurora",
    descKey: "theme.auroraDesc",
    descFallback: "Deep indigo with teal accents",
    swatch: { bg: "#0f121f", surface: "#181c2c", accent: "#3fd9c9", line: "#2a3048" },
  },
];

/**
 * Theme selector for the dashboards. `next-themes` (via ThemeScope) remains the
 * only owner of the class on <html>; this component just calls `setTheme`.
 */
export default function ThemePicker() {
  const { t } = useTranslation("dashboard");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const active = (theme ?? resolvedTheme ?? "light") as ThemeKey;
  const ActiveIcon = THEMES.find((x) => x.key === active)?.icon ?? Palette;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
          aria-label={t("theme.choose", "Choose theme")}
          title={t("theme.choose", "Choose theme")}
        >
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-2 pb-2 pt-1 text-xs font-medium text-muted-foreground">
          {t("theme.choose", "Choose theme")}
        </p>
        <div className="space-y-1">
          {THEMES.map((option) => {
            const selected = active === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setTheme(option.key)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-2 text-start transition-colors",
                  selected
                    ? "border-primary/40 bg-accent"
                    : "border-transparent hover:bg-accent/60",
                )}
              >
                <span
                  aria-hidden
                  className="flex h-9 w-12 shrink-0 flex-col justify-between overflow-hidden rounded border border-border/60 p-1"
                  style={{ background: option.swatch.bg }}
                >
                  <span
                    className="h-1.5 w-6 rounded-full"
                    style={{ background: option.swatch.accent }}
                  />
                  <span
                    className="h-3 w-full rounded-sm"
                    style={{ background: option.swatch.surface, borderTop: `1px solid ${option.swatch.line}` }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {t(option.labelKey, option.labelFallback)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(option.descKey, option.descFallback)}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
