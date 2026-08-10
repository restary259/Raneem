import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";


// Input sanitization
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function isValidPhone(phone: string): boolean {
  return /^[+\d\s\-()]{7,20}$/.test(phone);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REFERRAL_DISCOUNT = 500;

// The apply form is public, so the endpoint is rate limited per IP: every call
// writes a case (and a lead) with the service role.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
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

type Caller = { userId: string | null; isStaff: boolean };

/** Resolves the caller from the bearer token, if the request carries a user JWT. */
async function resolveCaller(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<Caller> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return { userId: null, isStaff: false };

  const { data: userData } = await admin.auth.getUser(token);
  const userId = userData?.user?.id ?? null;
  if (!userId) return { userId: null, isStaff: false };

  const { data: staffRole } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .in("role", ["admin", "team_member"])
    .maybeSingle();

  return { userId, isStaff: !!staffRole };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many submissions. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Honeypot: silently discard bot submissions
    if (body._honeypot) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      full_name,
      phone_number,
      source = "apply_page",
      partner_id,
      ref_code,
      actor_name,
      // Referral fields
      referrer_user_id,
      referral_id,
      referral_discount,
      // Extended fields
      city,
      education_level,
      bagrut_score,
      english_level,
      english_units,
      math_units,
      passport_type,
      degree_interest,
      intake_notes,
      email,
    } = body;

    // Required field validation
    if (!full_name || !phone_number) {
      return new Response(JSON.stringify({ error: "full_name and phone_number are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize and validate
    const cleanName = stripHtml(String(full_name)).slice(0, 100);
    const cleanPhone = String(phone_number).trim();

    if (!cleanName) {
      return new Response(JSON.stringify({ error: "Invalid full_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return new Response(JSON.stringify({ error: "Invalid phone_number format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (email && !isValidEmail(String(email))) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate numeric fields
    const cleanBagrutScore = bagrut_score != null ? Number(bagrut_score) : null;
    const cleanMathUnits = math_units != null ? Number(math_units) : null;

    if (cleanBagrutScore !== null && (isNaN(cleanBagrutScore) || cleanBagrutScore < 0 || cleanBagrutScore > 150)) {
      return new Response(JSON.stringify({ error: "bagrut_score must be between 0 and 150" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cleanMathUnits !== null && (isNaN(cleanMathUnits) || cleanMathUnits < 1 || cleanMathUnits > 5)) {
      return new Response(JSON.stringify({ error: "math_units must be between 1 and 5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEnglishUnits = english_units != null ? Number(english_units) : null;
    if (cleanEnglishUnits !== null && (isNaN(cleanEnglishUnits) || cleanEnglishUnits < 1 || cleanEnglishUnits > 5)) {
      return new Response(JSON.stringify({ error: "english_units must be between 1 and 5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Duplicate phone detection — only block if the existing case comes from the same
    // public submission flows (contact_form or apply_page). If the blocking case was
    // created manually, by the team, or via referral, it may be a different person
    // who happens to share the same phone number, so we let the new submission through.
    const { data: existingCase } = await supabaseAdmin
      .from("cases")
      .select("id, full_name, status, source")
      .eq("phone_number", cleanPhone)
      .in("source", ["contact_form", "apply_page"])
      .maybeSingle();

    if (existingCase) {
      // Update the existing case with the new education data (don't discard it)
      await supabaseAdmin
        .from("cases")
        .update({
          city: city ? stripHtml(String(city)).slice(0, 100) : undefined,
          education_level: education_level ? String(education_level) : undefined,
          english_units: cleanEnglishUnits ?? undefined,
          math_units: cleanMathUnits ?? undefined,
          english_level: english_level ? String(english_level) : undefined,
          passport_type: passport_type ? String(passport_type) : undefined,
          degree_interest: degree_interest ? String(degree_interest) : undefined,
          bagrut_score: cleanBagrutScore ?? undefined,
        })
        .eq("id", existingCase.id);

      return new Response(
        JSON.stringify({
          duplicate: true,
          case_id: existingCase.id,
          existing_name: existingCase.full_name,
          existing_status: existingCase.status,
          message: "A case with this phone number already exists — education data updated",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Referral attribution ──────────────────────────────────────
    // A referral code from the public link is resolved server-side, so a
    // visitor can never credit an arbitrary user by editing the request.
    const caller = await resolveCaller(req, supabaseAdmin);

    let validatedPartnerId: string | null = null;
    // A student referral is only credited to the signed-in referrer themselves
    // (or to whoever staff names), never to an id chosen by an anonymous caller.
    let validatedReferrerId: string | null =
      typeof referrer_user_id === "string" && UUID.test(referrer_user_id) &&
        (caller.isStaff || referrer_user_id === caller.userId)
        ? referrer_user_id
        : null;
    let attributionMethod: string | null = null;

    // A discount only exists for a validated referral, and never above the cap.
    const requestedDiscount = Number(referral_discount ?? 0);
    const cleanReferralDiscount = validatedReferrerId && Number.isFinite(requestedDiscount)
      ? Math.min(Math.max(requestedDiscount, 0), MAX_REFERRAL_DISCOUNT)
      : 0;

    if (ref_code && typeof ref_code === "string" && /^[a-zA-Z0-9-]{3,40}$/.test(ref_code.trim())) {
      const { data: resolvedId } = await supabaseAdmin.rpc("resolve_referral_code", {
        p_code: ref_code.trim(),
      });

      if (resolvedId) {
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", resolvedId)
          .in("role", ["social_media_partner", "ambassador", "student"])
          .maybeSingle();

        if (roleRow?.role === "student") {
          validatedReferrerId = resolvedId as string;
        } else if (roleRow) {
          validatedPartnerId = resolvedId as string;
        }
        if (roleRow) attributionMethod = "link";
      }
    }

    // Explicit partner_id is only honoured for signed-in admin/team callers.
    // A public applicant can never credit a partner by editing the request body —
    // attribution then comes solely from the server-resolved referral code.
    if (!validatedPartnerId && partner_id) {
      if (caller.isStaff) {
        const { data: partnerRole } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("user_id", partner_id)
          .in("role", ["social_media_partner", "ambassador"])
          .maybeSingle();

        if (partnerRole) {
          validatedPartnerId = partner_id;
          attributionMethod = "manual";
        }
      }
    }


    // Insert the case with all fields
    const { data: newCase, error: caseError } = await supabaseAdmin
      .from("cases")
      .insert({
        full_name: cleanName,
        phone_number: cleanPhone,
        source,
        partner_id: validatedPartnerId,
        referred_by: validatedReferrerId,
        source_attribution_method: attributionMethod,
        referral_discount: cleanReferralDiscount,
        status: "new",
        // Extended fields
        city: city ? stripHtml(String(city)).slice(0, 100) : null,
        education_level: education_level ? String(education_level) : null,
        bagrut_score: cleanBagrutScore,
        english_level: english_level ? String(english_level) : null,
        math_units: cleanMathUnits,
        english_units: cleanEnglishUnits,
        passport_type: passport_type ? String(passport_type) : null,
        degree_interest: degree_interest ? String(degree_interest) : null,
        intake_notes: intake_notes ? stripHtml(String(intake_notes)).slice(0, 2000) : null,
      })
      .select("id")
      .single();

    if (caseError) throw caseError;

    // Mirror the applicant into the leads table in the SAME server call, so a
    // referred applicant can never end up with a case but no lead (or the
    // reverse) when the browser drops a second request.
    if (source === "apply_page") {
      const { error: leadError } = await supabaseAdmin.rpc("insert_lead_from_apply", {
        p_full_name: cleanName,
        p_phone: cleanPhone,
        p_passport_type: passport_type ? String(passport_type) : null,
        p_english_units: cleanEnglishUnits,
        p_math_units: cleanMathUnits,
        p_city: city ? stripHtml(String(city)).slice(0, 100) : null,
        p_education_level: education_level ? String(education_level) : null,
        p_german_level: null,
        p_preferred_major: degree_interest ? String(degree_interest) : null,
        p_ref_code: ref_code ?? null,
      });
      if (leadError) console.error("lead mirror failed:", leadError.message);
    }


    // Link referral record back to the new case — only a referral that belongs
    // to the validated referrer, so a caller cannot re-point someone else's row.
    if (referral_id && typeof referral_id === "string" && UUID.test(referral_id) && validatedReferrerId && newCase?.id) {
      await supabaseAdmin
        .from("referrals")
        .update({ referred_case_id: newCase.id })
        .eq("id", referral_id)
        .eq("referrer_user_id", validatedReferrerId);
    }

    // Log activity. The actor is the verified caller: a body-supplied actor
    // would let anyone forge activity entries.
    if (caller.userId && actor_name) {
      await supabaseAdmin.rpc("log_activity", {
        p_actor_id: caller.userId,
        p_actor_name: stripHtml(String(actor_name)).slice(0, 100),
        p_action: "case_created_from_apply",
        p_entity_type: "cases",
        p_entity_id: newCase.id,
        p_metadata: { source, partner_id: validatedPartnerId },
      });
    }

    return new Response(JSON.stringify({ case_id: newCase.id, ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-case-from-apply error:", err);
    return new Response(JSON.stringify({ error: "Failed to create case" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
