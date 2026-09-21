// Ported from the pre-migration src/App.tsx — everything the old <App />
// component did around <Routes> now lives here around <Outlet />.
import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Outlet } from "@tanstack/react-router";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import BottomNav from "@/components/common/BottomNav";
import { registerServiceWorker } from "@/utils/pwaUtils";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { usePageTracking } from "@/hooks/usePageTracking";
import { DashboardRouteFallback, PublicRouteFallback } from "@/components/shell/RouteFallbacks";

// Non-critical global widgets — deferred off the critical path
const WhatsAppFloatingButton = lazy(() => import("@/components/common/WhatsAppFloatingButton"));
const PWAInstaller = lazy(() => import("@/components/common/PWAInstaller"));
const OfflineIndicator = lazy(() => import("@/components/common/OfflineIndicator"));
const InAppBrowserBanner = lazy(() => import("@/components/common/InAppBrowserBanner"));
const CookieBanner = lazy(() => import("@/components/common/CookieBanner"));

const AppShell = () => {
  useSessionTimeout();
  usePageTracking();

  const navigate = useNavigate();
  const location = useLocation();
  // Only the i18n instance is used here; keeping the default ("common") namespace
  // avoids pulling dashboard.json into the boot path of every public route.
  const { i18n } = useTranslation();

  // Global safety net for unhandled promise rejections
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    const dir = i18n.language === "ar" || i18n.language === "he" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = dir;

    registerServiceWorker();

    // SPA redirect restore (deep link preserved by the 404 fallback)
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath) {
      sessionStorage.removeItem("redirectPath");
      const searchParams = new URLSearchParams(location.search);
      const queryString = searchParams.toString();
      const fullPath = queryString ? `${redirectPath}?${queryString}` : redirectPath;
      navigate(fullPath, { replace: true });
    }
  }, [navigate, location.search, i18n.language]);

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const dir = i18n.language === "ar" ? "rtl" : "ltr";

  // Mount non-critical floating widgets after the browser is idle so they never
  // compete with first paint on mobile. Behaviour/appearance is unchanged.
  const [idleReady, setIdleReady] = React.useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdleReady(true), { timeout: 300 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdleReady(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  // Hide all distractions on the apply page
  const isApplyPage = location.pathname === "/apply";

  // Paths that use DashboardLayout (no bottom nav / chat).
  // Every dashboard role prefix must be listed here, otherwise the public
  // BottomNav renders on top of the dashboard's own MobileBottomNav.
  const isDashboardPath = ["/admin", "/team", "/partner", "/agent", "/student"].some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  return (
    <TooltipProvider>
      <div
        className={`min-h-screen w-full relative ${isDashboardPath || isApplyPage ? "" : "pb-20 md:pb-0"}`}
        dir={dir}
      >
        <Toaster />
        <Sonner />
        {!isApplyPage && !isDashboardPath && (
          <Suspense fallback={null}>
            <OfflineIndicator />
            <InAppBrowserBanner />
          </Suspense>
        )}
        {/* A layout-matched shell paints immediately while the route chunk
            loads, instead of a blank frame that reads as a frozen app. */}
        <Suspense fallback={isDashboardPath ? <DashboardRouteFallback /> : <PublicRouteFallback />}>
          <Outlet />
        </Suspense>
        {!isApplyPage && !isDashboardPath && idleReady && (
          <Suspense fallback={null}>
            <WhatsAppFloatingButton />
          </Suspense>
        )}
        {!isApplyPage && !isDashboardPath && idleReady && (
          <Suspense fallback={null}>
            <PWAInstaller />
            <CookieBanner />
          </Suspense>
        )}
        {!isDashboardPath && !isApplyPage && <BottomNav />}
      </div>
    </TooltipProvider>
  );
};

export default AppShell;
