import React from "react";
import { ThemeProvider } from "next-themes";
import { useLocation } from "react-router-dom";

const DASHBOARD_PREFIXES = ["/admin", "/team", "/partner", "/student"];

/**
 * Theme ownership lives here and nowhere else: `next-themes` is the single
 * owner of the `dark` class on <html>. Public/marketing routes are forced to
 * light, while dashboards keep the persisted `darb-theme` preference across
 * navigation, remounts and reloads.
 */
export default function ThemeScope({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isDashboard = DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="darb-theme"
      themes={["light", "dark", "aurora"]}
      forcedTheme={isDashboard ? undefined : "light"}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
