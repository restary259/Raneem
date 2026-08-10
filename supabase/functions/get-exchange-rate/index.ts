import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Public endpoint (the currency calculator is on marketing pages), so it is
// rate limited per IP: every call spends quota on a paid third-party API key.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return json({ error: "Too many requests. Please try again later." }, 429);
    }

    const { from, to } = await req.json();

    const fromCode = String(from ?? "").trim().toUpperCase();
    const toCode = String(to ?? "").trim().toUpperCase();

    if (!CURRENCY_CODE.test(fromCode) || !CURRENCY_CODE.test(toCode)) {
      return json({ error: "Invalid 'from' or 'to' currency code" }, 400);
    }

    const apiKey = Deno.env.get("EXCHANGE_RATE_API_KEY");
    if (!apiKey) {
      console.error("get-exchange-rate: EXCHANGE_RATE_API_KEY is not configured");
      return json({ error: "Exchange rate service unavailable" }, 500);
    }

    const url = `https://api.exchangerate.host/convert?from=${fromCode}&to=${toCode}&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    return json({ result: data.result ?? null });
  } catch (e) {
    console.error("get-exchange-rate error:", e);
    return json({ error: "Failed to fetch exchange rate" }, 500);
  }
});
