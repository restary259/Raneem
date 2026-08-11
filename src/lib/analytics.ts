/**
 * Consent-aware Google Analytics 4 (GA4) integration.
 *
 * The app already ships a cookie-consent gate (`CookieBanner`, persisted under
 * `darb_cookie_consent`). GA4 must not load until the visitor opts in with
 * "Accept all" (`"all"`). This module is the ONLY place that talks to gtag.js:
 *
 *  - `initAnalytics()` injects the gtag.js <script> exactly once and configures
 *    the property with `send_page_view: false` so gtag.js never auto-fires a
 *    page view. Every page view is sent explicitly by `trackPageView()`.
 *  - `trackPageView(path)` fires a `page_view` for the current route. It is
 *    called from `usePageTracking()` on every client-side navigation and
 *    directly when the visitor accepts the banner, so SPA route changes are
 *    tracked exactly once per navigation (no double counts on the initial
 *    load, no lost views on client-side navigation).
 *
 * The Measurement ID is not a secret. It can be overridden per environment via
 * the build-time variable `VITE_GA4_MEASUREMENT_ID`; when unset it falls back
 * to the property the Google tag was provisioned with.
 */

export const COOKIE_CONSENT_KEY = "darb_cookie_consent";

export const GA4_MEASUREMENT_ID =
  (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim() ||
  "G-ZTDY16W6ZL";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let scriptInjected = false;
let initialized = false;

/** Consent value persisted by CookieBanner; `"all"` grants analytics consent. */
export function getCookieConsent(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function isAnalyticsAllowed(): boolean {
  return getCookieConsent() === "all";
}

/**
 * Push a gtag call. Before the gtag.js script finishes loading this falls back
 * to the documented dataLayer push; gtag.js replays the queue on load.
 */
function pushGtag(args: unknown[]): void {
  const win = window as Window;
  if (typeof win.gtag === "function") {
    win.gtag(...args);
    return;
  }
  win.dataLayer.push(args);
}

/**
 * Inject the gtag.js loader once. Safe to call repeatedly; no-op after the
 * first call and never creates a duplicate <script>.
 */
export function injectGtagScript(): void {
  if (scriptInjected) return;
  scriptInjected = true;

  const win = window as Window;
  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag !== "function") {
    win.gtag = (...args: unknown[]) => win.dataLayer.push(args);
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Load + configure GA4 (consent-gated, idempotent). `send_page_view: false`
 * disables gtag.js's automatic page view so every page view is fired exactly
 * once by `trackPageView`, on both the initial load and SPA navigations.
 */
export function initAnalytics(): void {
  if (!isAnalyticsAllowed() || initialized) return;
  initialized = true;

  injectGtagScript();
  pushGtag(["js", new Date()]);
  pushGtag(["config", GA4_MEASUREMENT_ID, { send_page_view: false }]);
}

/** Fire a GA4 `page_view` for the given SPA route (consent-gated, no auto views). */
export function trackPageView(pagePath: string): void {
  if (!isAnalyticsAllowed()) return;
  initAnalytics();
  pushGtag([
    "event",
    "page_view",
    {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}${window.location.search}`,
      page_title: document.title,
    },
  ]);
}

/** Internal: reset module state between unit tests. */
export function __resetAnalyticsForTest(): void {
  scriptInjected = false;
  initialized = false;
}
