#!/usr/bin/env python3
"""Repeatable mobile scroll + performance harness (production build).

Measures routes under mobile emulation (390x844, DPR 3, touch) with 4x CPU
throttling and Slow-4G, recording paint/load timings, long tasks, layout shift,
DOM size, JS transferred, and per-frame scroll timings for a slow full-height
scroll and a fast fling. Every number comes from PerformanceObserver /
performance entries — no sleep-based timing.

Usage:
    npm run build
    npx vite preview --port 4173 --host 127.0.0.1 &
    python3 e2e/mobile_perf_audit.py --routes /admin,/admin/students > perf.json

Auth: restores the injected Supabase session from LOVABLE_BROWSER_SUPABASE_*
env vars before visiting authenticated routes. Tokens are never printed.
"""
import argparse, asyncio, json, os, time
from playwright.async_api import async_playwright

DEFAULT_ROUTES = "/admin,/admin/pipeline,/admin/students,/admin/financials,/admin/members,/admin/commission"

OBSERVERS = """
window.__longTasks = []; window.__cls = 0; window.__lcp = 0;
try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__longTasks.push(e.duration))).observe({type:'longtask', buffered:true}); } catch (e) {}
try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({type:'layout-shift', buffered:true}); } catch (e) {}
try { new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) window.__lcp = e.startTime; }).observe({type:'largest-contentful-paint', buffered:true}); } catch (e) {}
"""

COLLECT = """() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
  const res = performance.getEntriesByType('resource');
  const js = res.filter(r => r.name.endsWith('.js'));
  const lt = window.__longTasks || [];
  return {
    fcp: paint['first-contentful-paint'] ?? null,
    lcp: window.__lcp ? Math.round(window.__lcp) : null,
    cls: Math.round((window.__cls || 0) * 1000) / 1000,
    dcl: Math.round(nav.domContentLoadedEventEnd || 0),
    longTasks: lt.length,
    blockingMs: Math.round(lt.reduce((s, d) => s + Math.max(0, d - 50), 0)),
    jsTransferKB: Math.round(js.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
    requests: res.length,
    domNodes: document.getElementsByTagName('*').length,
  };
}"""

# Scrolls the real scroll container: the dashboard scrolls an inner <main>,
# public pages scroll the document.
SCROLL = """async (mode) => {
  const main = document.querySelector('main');
  const el = (main && main.scrollHeight > main.clientHeight + 40) ? main : document.scrollingElement;
  const max = el.scrollHeight - el.clientHeight;
  if (max < 200) return { skipped: true, scrollable: max };
  const frames = []; let last = performance.now(); let raf;
  const tick = t => { frames.push(t - last); last = t; raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const step = mode === 'fling' ? 240 : 60;
  const wait = mode === 'fling' ? 8 : 16;
  for (let y = 0; y <= max; y += step) { el.scrollTop = y; await new Promise(r => setTimeout(r, wait)); }
  cancelAnimationFrame(raf);
  el.scrollTop = 0;
  const f = frames.slice(2).sort((a, b) => a - b);
  const q = p => f.length ? Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 10) / 10 : 0;
  return {
    scrollable: max, frames: f.length, median: q(0.5), p95: q(0.95),
    max: f.length ? Math.round(f[f.length - 1]) : 0,
    dropped: f.filter(x => x > 24).length,
    janky: f.filter(x => x > 50).length,
  };
}"""

# Verifies the scroll container returns to the top when the route changes.
SCROLL_STATE = """() => {
  const main = document.querySelector('main');
  const el = (main && main.scrollHeight > main.clientHeight + 40) ? main : document.scrollingElement;
  return { top: Math.round(el.scrollTop), tag: el === document.scrollingElement ? 'document' : 'main' };
}"""


async def run(base, routes, out_path):
    results = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3, is_mobile=True, has_touch=True,
        )
        await ctx.add_init_script(OBSERVERS)
        page = await ctx.new_page()
        cdp = await ctx.new_cdp_session(page)
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        await cdp.send("Network.enable")
        await cdp.send("Network.emulateNetworkConditions", {
            "offline": False, "latency": 150,
            "downloadThroughput": int(1.6 * 1024 * 1024 / 8),
            "uploadThroughput": int(750 * 1024 / 8),
        })

        await page.goto(base, wait_until="domcontentloaded")
        key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        session_file = os.environ.get("PERF_SESSION_FILE")
        if session_file and os.path.exists(session_file):
            # Session minted with `lovable auth-session --json --user <uuid>`.
            with open(session_file) as fh:
                blob = json.load(fh)
            key = blob.get("storage_key") or key
            sess = json.dumps(blob.get("session") or blob)
        if key and sess:
            await page.evaluate("([k, s]) => localStorage.setItem(k, s)", [key, sess])


        for route in routes:
            started = time.time()
            await page.goto(base + route, wait_until="domcontentloaded")
            try:
                await page.wait_for_load_state("networkidle", timeout=25000)
            except Exception:
                pass
            entry = {"finalUrl": page.url, "wallMs": int((time.time() - started) * 1000)}
            entry.update(await page.evaluate(COLLECT))
            entry["scrollSlow"] = await page.evaluate(SCROLL, "slow")
            entry["scrollFling"] = await page.evaluate(SCROLL, "fling")
            results[route] = entry

        # Scroll-restoration check: scroll deep on the last route, navigate to
        # the first, and read the scroll offset of the real container.
        if len(routes) > 1:
            await page.goto(base + routes[-1], wait_until="domcontentloaded")
            await page.evaluate("() => { const m=document.querySelector('main')||document.scrollingElement; m.scrollTop = 800; }")
            await page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            before = await page.evaluate(SCROLL_STATE)
            await page.goto(base + routes[0], wait_until="domcontentloaded")
            await page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            results["_scrollReset"] = {"before": before, "after": await page.evaluate(SCROLL_STATE)}

        await browser.close()

    text = json.dumps(results, indent=2)
    if out_path:
        with open(out_path, "w") as fh:
            fh.write(text)
    print(text)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("PERF_BASE_URL", "http://127.0.0.1:4173"))
    ap.add_argument("--routes", default=DEFAULT_ROUTES)
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    asyncio.run(run(a.base, [r for r in a.routes.split(",") if r], a.out))
