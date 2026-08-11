
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The analytics module keeps module-level state (scriptInjected / initialized)
 * and reads `import.meta.env` at load time, so each test gets a fresh module
 * via `vi.resetModules()` + dynamic import.
 */
describe("analytics (GA4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = "";
    window.dataLayer = [];
    delete window.gtag;
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to the provisioned Measurement ID when the env var is unset", async () => {
    const { GA4_MEASUREMENT_ID } = await import("./analytics");
    expect(GA4_MEASUREMENT_ID).toBe("G-ZTDY16W6ZL");
  });

  it("does not inject the tag until analytics consent is granted", async () => {
    const { initAnalytics } = await import("./analytics");
    initAnalytics();
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
  });

  it("loads the gtag script for the configured property when consent is granted", async () => {
    const { initAnalytics } = await import("./analytics");
    window.localStorage.setItem("darb_cookie_consent", "all");
    initAnalytics();
    const script = document.querySelector('script[src*="googletagmanager.com"]') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ZTDY16W6ZL");
  });

  it("injects the gtag script exactly once", async () => {
    const { initAnalytics } = await import("./analytics");
    window.localStorage.setItem("darb_cookie_consent", "all");
    initAnalytics();
    initAnalytics();
    const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
    expect(scripts.length).toBe(1);
  });

  it("configures GA4 with send_page_view disabled to avoid double counting", async () => {
    const { initAnalytics } = await import("./analytics");
    window.localStorage.setItem("darb_cookie_consent", "all");
    const gtag = vi.fn();
    window.gtag = gtag;
    initAnalytics();
    expect(gtag).toHaveBeenCalledWith("config", "G-ZTDY16W6ZL", { send_page_view: false });
  });

  it("fires exactly one page_view per tracked route", async () => {
    const { trackPageView } = await import("./analytics");
    window.localStorage.setItem("darb_cookie_consent", "all");
    const gtag = vi.fn();
    window.gtag = gtag;
    trackPageView("/");
    trackPageView("/services");
    const pageViews = gtag.mock.calls.filter(
      (call) => call[0] === "event" && call[1] === "page_view"
    );
    expect(pageViews).toHaveLength(2);
    expect(pageViews[0][2]).toEqual(expect.objectContaining({ page_path: "/" }));
    expect(pageViews[1][2]).toEqual(expect.objectContaining({ page_path: "/services" }));
  });

  it("does not send page views without consent", async () => {
    const { trackPageView } = await import("./analytics");
    const gtag = vi.fn();
    window.gtag = gtag;
    trackPageView("/about");
    expect(gtag).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
  });
});
