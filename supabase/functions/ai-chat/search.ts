/**
 * Web retrieval for the DARB assistant.
 *
 * The AI gateway has no built-in grounding — passing a `google_search` tool is
 * silently ignored and the model answers from memory, which is precisely the
 * hallucination we are trying to remove. So retrieval is done here, against a
 * real search endpoint, and every result is filtered through the source policy
 * before the model ever sees it.
 *
 * Consequence: the model can only ever cite a URL that actually came back from
 * a live search or from the hand-verified registry. It cannot invent one.
 */
import { isAuthoritativeUrl, sourceQuality } from "./sources.ts";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  quality: "OFFICIAL" | "ACADEMIC" | "OTHER";
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'");

const stripTags = (s: string): string =>
  decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Pulls the real target out of DuckDuckGo's redirect wrapper. */
function unwrap(href: string): string | null {
  try {
    const m = href.match(/[?&]uddg=([^&"]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (href.startsWith("http")) return href;
    return null;
  } catch {
    return null;
  }
}

/**
 * Searches official German higher-education sources.
 *
 * Results are hard-filtered to authoritative domains: a blog or an SEO
 * aggregator can never enter the model's context, so it cannot cite one.
 */
export async function searchOfficialSources(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];

  let html = "";
  try {
    const res = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": UA, "Accept-Language": "en,de;q=0.8,ar;q=0.6" },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // The lite layout is a table: result link row, then a snippet row.
  const rows = html.split(/<tr/i);
  for (let i = 0; i < rows.length; i++) {
    const linkMatch = rows[i].match(/href="([^"]+)"[^>]*class="result-link"/i) ??
      rows[i].match(/class="result-link"[^>]*href="([^"]+)"/i) ??
      rows[i].match(/href="(\/\/duckduckgo\.com\/l\/\?uddg=[^"]+)"/i);
    if (!linkMatch) continue;

    const url = unwrap(decodeEntities(linkMatch[1]));
    if (!url || !isAuthoritativeUrl(url)) continue;
    const key = url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);

    const title = stripTags(rows[i]).slice(0, 200);
    let snippet = "";
    for (let j = i + 1; j < Math.min(i + 4, rows.length); j++) {
      if (/result-snippet/i.test(rows[j])) {
        snippet = stripTags(rows[j]).slice(0, 400);
        break;
      }
    }

    results.push({ title, url: key, snippet, quality: sourceQuality(key) });
    if (results.length >= limit) break;
  }

  // Primary sources first so the model reaches for official evidence.
  results.sort((a, b) => {
    const rank = (q: string) => (q === "OFFICIAL" ? 0 : q === "ACADEMIC" ? 1 : 2);
    return rank(a.quality) - rank(b.quality);
  });

  return results;
}

/**
 * Fetches an authoritative page as plain text so the model can confirm the page
 * actually supports the claim instead of citing it on keyword similarity.
 * Non-authoritative URLs are refused outright.
 */
export async function fetchOfficialPage(
  url: string,
): Promise<{ ok: boolean; url: string; text?: string; error?: string }> {
  if (!isAuthoritativeUrl(url)) {
    return {
      ok: false,
      url,
      error:
        "Refused: not an official or academic source. Only official German authority, DAAD/uni-assist/anabin, or university domains may be fetched.",
    };
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en,de;q=0.8" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { ok: false, url, error: `Page returned HTTP ${res.status}` };
    }
    const raw = await res.text();
    const body = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    const text = stripTags(body).slice(0, 6000);
    if (!text) return { ok: false, url, error: "Page had no readable text" };
    return { ok: true, url, text };
  } catch {
    return { ok: false, url, error: "Page could not be reached" };
  }
}
