/**
 * Origin-restricted CORS headers.
 *
 * Browser calls are only answered for our own origins; anything else gets a
 * response without an allow-origin header, which the browser rejects.
 * Non-browser callers (triggers, cron, server-to-server) send no Origin and
 * are unaffected — they are still authenticated by requireAuth().
 */
const ALLOWED_ORIGINS = [
  "https://darb.agency",
  "https://www.darb.agency",
  "https://darb-agency.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Lovable preview/sandbox subdomains for this project.
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
