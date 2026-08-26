/**
 * Repeatable mobile scroll + performance harness.
 *
 * Measures the authenticated dashboards against a PRODUCTION build under
 * mobile emulation (390x844, DPR 3, touch), 4x CPU throttling and Slow-4G.
 * Per route it records paint/load timings, long tasks, layout shift, DOM size,
 * JS transferred, and per-frame scroll timings for both a slow full-height
 * scroll and a fast fling. No waitForTimeout-based timing: every number comes
 * from PerformanceObserver / performance entries.
 *
 * Usage:
 *   npm run build
 *   npx vite preview --port 4173 --host 127.0.0.1 &
 *   node e2e/mobile-perf-audit.mjs > perf.json
 *
 * Auth: reads the injected Supabase session from the environment
 * (LOVABLE_BROWSER_SUPABASE_* ). Without it, only public routes are measured.
 */
import { chromium } from "playwright";

const BASE = process.env.PERF_BASE_URL || "http://127.0.0.1:4173";
const ROUTES = (process.env.PERF_ROUTES || [
  "/admin",
  "/admin/pipeline",
  "/admin/students",
  "/admin/financials",
  "/admin/members",
  "/admin/commission",
].join(",")).split(",");

const collect = `async () => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
  const res = performance.getEntriesByType('resource');
  const js = res.filter(r => r.name.endsWith('.js'));
  const lt = window.__longTasks || [];
  return {
    fcp: paint['first-contentful-paint'] ?? null,
    lcp: window.__lcp ? Math.round(window.__lcp) : null,
    cls: window.__cls ? Math.round(window.__cls * 1000) / 1000 : 0,
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    longTasks: lt.length,
    blockingMs: Math.round(lt.reduce((s, d) => s + Math.max(0, d - 50), 0)),
    jsTransferKB: Math.round(js.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
    requests: res.length,
    domNodes: document.getElementsByTagName('*').length,
  };
}`;

/** Scrolls the real scroll container (dashboard uses an inner <main>). */
const scrollTest = `async (mode) => {
  const main = document.querySelector('main');
  const el = main && main.scrollHeight > main.clientHeight ? main : document.scrollingElement;
  const max = el.scrollHeight - el.clientHeight;
  if (max < 200) return { skipped: true, scrollable: max };
  const frames = []; let last = performance.now(); let raf;
  const tick = (t) => { frames.push(t - last); last = t; raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const step = mode === 'fling' ? 240 : 60;
  const wait = mode === 'fling' ? 8 : 16;
  for (let y = 0; y <= max; y += step) { el.scrollTop = y; await new Promise(r => setTimeout(r, wait)); }
  cancelAnimationFrame(raf);
  el.scrollTop = 0;
  const f = frames.slice(2).sort((a, b) => a - b);
  const q = (p) => (f.length ? Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 10) / 10 : 0);
  return {
    scrollable: max,
    frames: f.length,
    median: q(0.5),
    p95: q(0.95),
    max: f.length ? Math.round(f[f.length - 1]) : 0,
    dropped: f.filter((x) => x > 24).length,
    janky: f.filter((x) => x > 50).length,
  };
}`;

const observers = `
  window.__longTasks = []; window.__cls = 0; window.__lcp = 0;
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { const e = l.getEntries().pop(); if (e) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
`;

async function main() {
  const browser = await chromium.launch(headless_opts());
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(observers);

  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  // Restore the injected session before hitting any authenticated route.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (key && session) {
    await page.evaluate(([k, s]) => localStorage.setItem(k, s), [key, session]);
  }

  const out = {};
  for (const route of ROUTES) {
    const started = Date.now();
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    const load = await page.evaluate(collect);
    const slow = await page.evaluate(scrollTest, "slow");
    const fling = await page.evaluate(scrollTest, "fling");
    out[route] = { url: route, wallMs: Date.now() - started, ...load, scrollSlow: slow, scrollFling: fling };
  }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}

function headless_opts() {
  return { headless: true };
}

main();
