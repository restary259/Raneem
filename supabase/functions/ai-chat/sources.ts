/**
 * Source policy for the DARB assistant.
 *
 * Two jobs:
 *  1. Define which domains count as authoritative for German higher-education
 *     facts, so web search can be restricted to them.
 *  2. Define the ONLY URLs the model may cite without having searched — a
 *     small, hand-verified registry of official entry points. Anything else
 *     must come back from a tool call, which makes fabricated URLs impossible
 *     rather than merely discouraged.
 */

/** Official / primary domains. Subdomains are matched too. */
export const OFFICIAL_DOMAINS: string[] = [
  // German government + authorities
  "daad.de",
  "uni-assist.de",
  "anabin.kmk.org",
  "kmk.org",
  "auswaertiges-amt.de",
  "make-it-in-germany.com",
  "bamf.de",
  "arbeitsagentur.de",
  "destatis.de",
  "bmbf.de",
  "studienkollegs.de",
  "hochschulkompass.de",
  "hrk.de",
  "studieren-in-deutschland.org",
  "study-in-germany.de",
  "testdaf.de",
  "goethe.de",
  "telc.net",
  "germany.diplomatik.de",
];

/**
 * German higher-education host patterns. Universities each have their own
 * domain, so an allowlist of names would go stale; these patterns cover the
 * standard German academic namespace instead.
 */
const ACADEMIC_PATTERNS: RegExp[] = [
  /(^|\.)uni-[a-z0-9-]+\.de$/i,
  /(^|\.)tu-[a-z0-9-]+\.de$/i,
  /(^|\.)th-[a-z0-9-]+\.de$/i,
  /(^|\.)fh-[a-z0-9-]+\.de$/i,
  /(^|\.)hs-[a-z0-9-]+\.de$/i,
  /(^|\.)universitaet-[a-z0-9-]+\.de$/i,
  /(^|\.)hochschule-[a-z0-9-]+\.de$/i,
  /\.uni-[a-z0-9-]+\.de$/i,
];

/** Extra university hosts that don't follow the uni-/tu- naming convention. */
export const EXTRA_UNIVERSITY_DOMAINS: string[] = [
  "tum.de",
  "lmu.de",
  "rwth-aachen.de",
  "charite.de",
  "kit.edu",
  "hu-berlin.de",
  "fu-berlin.de",
  "ulm.de",
];

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** True when the URL belongs to an authoritative/official source. */
export function isAuthoritativeUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (OFFICIAL_DOMAINS.some((d) => matchesDomain(host, d))) return true;
  if (EXTRA_UNIVERSITY_DOMAINS.some((d) => matchesDomain(host, d))) return true;
  return ACADEMIC_PATTERNS.some((p) => p.test(host));
}

/** Rough quality label so the model can prefer primary evidence. */
export function sourceQuality(url: string): "OFFICIAL" | "ACADEMIC" | "OTHER" {
  const host = hostOf(url);
  if (!host) return "OTHER";
  if (OFFICIAL_DOMAINS.some((d) => matchesDomain(host, d))) return "OFFICIAL";
  if (isAuthoritativeUrl(url)) return "ACADEMIC";
  return "OTHER";
}

/**
 * Hand-verified official entry points. These are the only external URLs the
 * model may cite WITHOUT a tool call. Each is a topic entry point, not a
 * bare homepage used as filler.
 */
export const SOURCE_REGISTRY: { label: string; url: string; topic: string }[] = [
  {
    label: "anabin — recognition of foreign school certificates (KMK)",
    url: "https://anabin.kmk.org/anabin.html",
    topic: "Bagrut recognition, university entrance qualification",
  },
  {
    label: "uni-assist — international application service",
    url: "https://www.uni-assist.de/en/",
    topic: "how to apply, application deadlines, document review",
  },
  {
    label: "DAAD — study in Germany portal",
    url: "https://www.daad.de/en/studying-in-germany/",
    topic: "general study information, funding, programme search",
  },
  {
    label: "DAAD — international programmes database",
    url: "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/",
    topic: "finding specific degree programmes and their language of instruction",
  },
  {
    label: "Hochschulkompass — official German degree programme database (HRK)",
    url: "https://www.hochschulkompass.de/en/",
    topic: "official list of universities and degree programmes",
  },
  {
    label: "Federal Foreign Office — visa for study purposes",
    url: "https://www.auswaertiges-amt.de/en/visa-service/visabestimmungen-node",
    topic: "student visa requirements and procedure",
  },
  {
    label: "Make it in Germany — proof of financial resources",
    url: "https://www.make-it-in-germany.com/en/visa-residence/types/study",
    topic: "blocked account, financial proof for the study visa",
  },
  {
    label: "Studienkollegs in Germany — official overview",
    url: "https://www.studienkollegs.de/",
    topic: "Studienkolleg courses (T/M/W/G/S) and Feststellungsprüfung",
  },
  {
    label: "TestDaF — German language test for university admission",
    url: "https://www.testdaf.de/en/",
    topic: "German language proficiency requirements",
  },
];

/** URLs the model may always cite (registry + the university pages we ship). */
export function baselineAllowedUrls(universityUrls: string[]): Set<string> {
  const set = new Set<string>();
  for (const s of SOURCE_REGISTRY) set.add(s.url);
  for (const u of universityUrls) if (u) set.add(u);
  return set;
}
