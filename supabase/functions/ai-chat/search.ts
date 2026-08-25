/**
 * Retrieval for the DARB assistant.
 *
 * Why this file exists: the AI gateway has no grounding. Passing a
 * `google_search` tool is silently ignored and the model answers from memory —
 * exactly the hallucination we are removing. Retrieval therefore happens here,
 * and every URL the model can cite passes through the source policy first.
 *
 * Two discovery paths, in priority order:
 *  1. A live search API, when BRAVE_SEARCH_API_KEY is configured. Keyless
 *     scrapers were evaluated and rejected: DuckDuckGo answers this runtime
 *     with an anti-bot challenge, and Bing's keyless RSS returns results
 *     unrelated to the query. Shipping either would have produced confident
 *     citations to arbitrary pages — worse than having no search at all.
 *  2. A hand-verified registry of official topic entry points, which always
 *     works and covers the questions students actually ask.
 *
 * Either way the model reads the real page through `fetchOfficialPage` before
 * citing it, so a citation reflects a page that was actually retrieved.
 */
import { isAuthoritativeUrl, SOURCE_REGISTRY, sourceQuality } from "./sources.ts";

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

/* -------------------------------------------------------------------------- */
/*  Live search (optional — only when an API key is configured)               */
/* -------------------------------------------------------------------------- */

async function braveSearch(q: string): Promise<SearchResult[]> {
  const key = Deno.env.get("BRAVE_SEARCH_API_KEY");
  if (!key) return [];
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=15`,
      {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: { title?: string; url?: string; description?: string }[] =
      data?.web?.results ?? [];
    return items
      .filter((r) => r.url && isAuthoritativeUrl(r.url))
      .map((r) => ({
        title: stripTags(r.title ?? "").slice(0, 200),
        url: (r.url as string).split("#")[0],
        snippet: stripTags(r.description ?? "").slice(0, 400),
        quality: sourceQuality(r.url as string),
      }));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Registry lookup (always available)                                        */
/* -------------------------------------------------------------------------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const TOPIC_HINTS: Record<string, string[]> = {
  "anabin.kmk.org": ["bagrut", "recognition", "anabin", "certificate", "entrance", "qualification", "hzb", "eligible", "eligibility"],
  "uni-assist.de": ["apply", "application", "deadline", "documents", "uni assist", "submit"],
  "auswaertiges-amt.de": ["visa", "embassy", "consulate", "residence", "appointment"],
  "make-it-in-germany.com": ["blocked", "sperrkonto", "financial", "proof", "money", "funds", "living costs"],
  "studienkollegs.de": ["studienkolleg", "feststellungsprufung", "t kurs", "m kurs", "w kurs", "preparatory"],
  "testdaf.de": ["german level", "testdaf", "language test", "dsh", "c1", "b2", "language requirement", "german language"],
  "hochschulkompass.de": ["university list", "programme", "program", "degree", "search", "which universities"],
  "daad.de": ["study in germany", "funding", "scholarship", "costs", "living", "studienkolleg", "feststellungsprufung", "preparatory", "requirement", "requirements", "admission"],

};

function registryMatches(query: string, limit: number): SearchResult[] {
  const q = norm(query);
  const scored = SOURCE_REGISTRY.map((s) => {
    let score = 0;
    const host = new URL(s.url).hostname.replace(/^www\d?\./, "");
    for (const [domain, hints] of Object.entries(TOPIC_HINTS)) {
      if (!host.endsWith(domain)) continue;
      for (const h of hints) if (q.includes(h)) score += 3;
    }
    for (const token of norm(s.topic).split(" ")) {
      if (token.length >= 5 && q.includes(token)) score += 2;
    }
    return { s, score };
  });

  const hits = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const chosen = hits.length ? hits : scored.slice(0, 2); // never leave the model empty-handed
  return chosen.slice(0, limit).map(({ s }) => ({
    title: s.label,
    url: s.url,
    snippet: `Official entry point for: ${s.topic}. Fetch this page to read the current wording before citing it.`,
    quality: sourceQuality(s.url),
  }));
}

/**
 * Finds authoritative sources for a question. Live search results (when a key
 * is configured) are merged ahead of registry entry points; everything is
 * hard-filtered to official/academic domains, so a blog or SEO aggregator can
 * never reach the model's context and therefore can never be cited.
 */
export async function searchOfficialSources(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];

  const live = await braveSearch(q);
  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  for (const r of [...live, ...registryMatches(q, limit)]) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    merged.push(r);
    if (merged.length >= limit) break;
  }

  merged.sort((a, b) => {
    const rank = (x: string) => (x === "OFFICIAL" ? 0 : x === "ACADEMIC" ? 1 : 2);
    return rank(a.quality) - rank(b.quality);
  });
  return merged;
}

/** True when live web search is wired up; used to tune the model's guidance. */
export const hasLiveSearch = (): boolean => Boolean(Deno.env.get("BRAVE_SEARCH_API_KEY"));

/* -------------------------------------------------------------------------- */
/*  Page reading                                                              */
/* -------------------------------------------------------------------------- */

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
