
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/**
 * Fires a GA4 `page_view` event on every client-side route change (including
 * the initial mount). Consent-gated inside `trackPageView`, so nothing is sent
 * unless the visitor accepted analytics cookies. `send_page_view: false` on
 * config guarantees no automatic page view is added alongside this one.
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
}
