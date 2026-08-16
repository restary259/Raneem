import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "dump");

const SITES = [
  {
    slug: "fu-academy",
    name: "F+U / Academy of Languages Heidelberg",
    urls: [
      "https://academy-languages.com/en/german-courses/intensive-courses-heidelberg/",
      "https://academy-languages.com/en/accommodation-heidelberg/dormitories-apartments-heidelberg/",
    ],
  },
  {
    slug: "alpha-aktiv",
    name: "Alpha Aktiv Heidelberg",
    urls: [
      "https://www.alpha-heidelberg.de/en/language-courses/german-courses/",
      "https://www.alpha-heidelberg.de/en/service/accommodation/",
      "https://www.alpha-heidelberg.de/en/service/health-insurance/",
    ],
  },
  {
    slug: "go-academy",
    name: "GO Academy Düsseldorf",
    urls: [
      "https://goacademy.de/en/language-courses/german/german-intensive-course/",
      "https://goacademy.de/en/support/accommodation/",
    ],
  },
  {
    slug: "kapito",
    name: "KAPITO Münster",
    urls: [
      "https://www.kapito.com/en/german-intensive-course/",
      "https://www.kapito.com/en/intensive-plus-course/",
      "https://www.kapito.com/en/accommodation/",
    ],
  },
];

// Grab the "real" image URL from all the lazy-load attributes + srcset
function realSrc(img) {
  const candidates = [
    img.getAttribute("src"),
    img.getAttribute("data-src"),
    img.getAttribute("data-lazy-src"),
    img.getAttribute("data-original"),
    img.getAttribute("data-full"),
    img.getAttribute("data-large_image"),
    img.getAttribute("data-url"),
  ].filter(Boolean);
  // Highest-res from srcset
  let bestFromSrcset = null;
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
  if (srcset) {
    bestFromSrcset = srcset
      .split(",")
      .map((s) => {
        const [u, w] = [s.trim().split(" ")[0], s.trim().split(" ")[1]];
        return { u, w: w ? parseInt(w, 10) : 0 };
      })
      .sort((a, b) => b.w - a.w)[0]?.u ?? null;
  }
  const first = candidates[0] ?? bestFromSrcset;
  if (!first) return { url: null, srcsetUrl: bestFromSrcset };
  return { url: first.trim(), srcsetUrl: bestFromSrcset };
}

async function scrapeDump(browser, site, url) {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "en-GB",
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const out = {
    slug: site.slug,
    url,
    title: "",
    lang: null,
    cards: [],
    images: [],
  };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    out.title = await page.title();
    out.lang = await page.evaluate(() => document.documentElement.lang || null);

    // Force-load any lazily loaded images by scrolling through the page.
    await page.evaluate(async () => {
      const step = 700;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });

    out.cards = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const headingScore = (el) => {
        const h = el.closest("h1,h2,h3,h4,h5,h6");
        if (!h) return 4;
        const t = Array.from({ length: 6 }, (_, i) => `H${i + 1}`).indexOf(h.tagName);
        return t < 0 ? 5 : t;
      };
      const images = Array.from(document.querySelectorAll("img"));
      const visibleImgs = images.filter(isVisible);

      // Group visible images by their nearest enclosing block-ish ancestor
      const groups = [];
      for (const img of visibleImgs) {
        const block =
          img.closest("figure, li, .card, .et_pb_module, .wp-block-group, [class*=gallery], [class*=slider], [class*=item], td, .elementor-widget, section, article") ??
          img;
        let section = "";
        for (const sel of ["h1", "h2", "h3", "h4", "h5"]) {
          const hEl = block.closest(sel) || (block.querySelector ? block.querySelector(sel) : null);
          if (hEl) {
            section = hEl.textContent.trim().slice(0, 120);
            break;
          }
        }
        if (!section) {
          // fallback: nearest heading anywhere above
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          let node = walker.nextNode();
          let best = "";
          let bestDist = Infinity;
          while (node) {
            if (/^H[1-6]$/.test(node.tagName) && node.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING) {
              const d = node.compareDocumentPosition(img);
              void d;
              break;
            }
            node = walker.nextNode();
          }
          void best;
          void bestDist;
        }
        groups.push({
          alt: img.alt || null,
          section,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          src: img.currentSrc || img.src || null,
          srcset: img.getAttribute("srcset") || null,
          dataSrc: img.getAttribute("data-src") || null,
          className: (img.className || "").toString().slice(0, 80),
        });
      }
      void headingScore;

      const allHeadings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => {
        let text = "";
        // capture surrounding text but drop cloned nav text
        const clone = h.cloneNode(true);
        Array.from(clone.querySelectorAll("script,style,noscript")).forEach((n) => n.remove());
        text = clone.textContent.replace(/\s+/g, " ").trim().slice(0, 160);
        return { tag: h.tagName, text };
      });

      // tables with context
      const tables = Array.from(document.querySelectorAll("table")).map((tb) => {
        const rows = Array.from(tb.querySelectorAll("tr")).slice(0, 40).map((tr) =>
          Array.from(tr.querySelectorAll("th,td"))
            .map((c) => c.textContent.replace(/\s+/g, " ").trim().slice(0, 80))
            .filter(Boolean),
        );
        const head = Array.from(
          (tb.previousElementSibling ? [tb.previousElementSibling] : []),
        )
          .map((el) => el.textContent.replace(/\s+/g, " ").trim().slice(0, 120))
          .filter(Boolean);
        return { head, rows };
      });
      return { images: groups, headings: allHeadings, tables };
    });

    // Also snapshot full body text of the main content (deduplicate nav/footer)
    out.bodyText = await page.evaluate(() => {
      const main = document.querySelector("main, #main, .main, .entry-content, .et_pb_post, article, #content");
      const root = main || document.body;
      const sections = [];
      let currentHeading = "";
      let buf = [];
      const flush = () => {
        const t = buf.join(" ").replace(/\s+/g, " ").trim();
        if (t) sections.push({ heading: currentHeading, text: t.slice(0, 1200) });
        buf = [];
      };
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        const tag = node.tagName;
        if (/^H[1-6]$/.test(tag)) {
          flush();
          currentHeading = node.textContent.replace(/\s+/g, " ").trim().slice(0, 160);
        } else if (tag === "P" || tag === "LI" || tag === "TD" || tag === "TH") {
          const txt = node.textContent.replace(/\s+/g, " ").trim();
          if (txt && txt.length > 2) buf.push(txt);
        }
        node = walker.nextNode();
      }
      flush();
      return sections;
    });

    // Download-candidate images (filter decorative/duplicate)
    const seen = new Set();
    for (const img of out.cards.images) {
      const cand = realSrc({ getAttribute: (a) =>
        a === "src" ? img.src : a === "data-src" ? img.dataSrc : a === "srcset" ? img.srcset : null });
      const u = cand.url || cand.srcsetUrl;
      if (!u) continue;
      const key = u.split("?")[0];
      if (seen.has(key)) continue;
      // skip SVG flags / logos / tiny icons
      if (/\.(svg|gif)(\?|$)/i.test(key)) continue;
      if (img.width && img.width < 200) continue;
      seen.add(key);
      // Remove WordPress responsive size suffix (-768x512.jpg -> .jpg) when the srcset points higher
      let best = u;
      if (img.srcset && cand.srcsetUrl && (cand.srcsetUrl.split("?")[0] !== key)) {
        best = cand.srcsetUrl;
      }
      out.images.push({
        alt: img.alt,
        section: img.section,
        url: best,
        thumb: key,
        width: img.width,
        height: img.height,
      });
    }
  } catch (err) {
    out.error = String(err).slice(0, 500);
  } finally {
    await ctx.close();
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const summary = [];
for (const site of SITES) {
  for (const url of site.urls) {
    const dump = await scrapeDump(browser, site, url);
    const safe = url.replace(/[^a-z0-9]/gi, "_").slice(0, 90);
    const file = join(OUT, `${site.slug}__${safe}.json`);
    writeFileSync(file, JSON.stringify(dump, null, 1));
    summary.push({
      slug: site.slug,
      url,
      title: dump.title,
      lang: dump.lang,
      cards: dump.cards.headings.length,
      images: dump.images.length,
      error: dump.error ?? null,
      file,
    });
  }
}
await browser.close();
console.log(JSON.stringify({ summary, count: summary.length }, null, 1));