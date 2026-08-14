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

type Caller = {
  userId: string | null;
  isStaff: boolean;
  isPartner: boolean;
};

/**
 * Resolves the caller from the bearer token, if the request carries a user JWT.
 * A logged-in social_media_partner / ambassador / agent (submitting from their
 * own dashboard apply form) is identified as `isPartner` so the case can be
 * attributed to them server-side — never from the request body. For an agent,
 * the attribution becomes a self-referral (the agent earns the
 * agent_self_referral_rate when the case pays out).
 */
async function resolveCaller(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<Caller> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return { userId: null, isStaff: false, isPartner: false };

  const { data: userData } = await admin.auth.getUser(token);
  const userId = userData?.user?.id ?? null;
  if (!userId) return { userId: null, isStaff: false, isPartner: false };

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = roleRow?.role as string | undefined;
  return {
    userId,
    isStaff: role === "admin" || role === "team_member",
    isPartner: role === "social_media_partner" || role === "ambassador" || role === "agent",
  };
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

    // ── Referral attribution ──────────────────────────────────────
    // Attribution is resolved server-side: a raw `referrer_user_id` or
    // `partner_id` in the request body is never trusted on its own, because a
    // public visitor could otherwise name an arbitrary account and have it paid
    // a commission later.
    const caller = await resolveCaller(req, supabaseAdmin);

    // A student referral is only credited to the signed-in referrer themselves
    // (or to whoever staff names), never to an id chosen by an anonymous caller.
    let validatedReferrerId: string | null =
      typeof referrer_user_id === "string" && UUID.test(referrer_user_id) &&
        (caller.isStaff || referrer_user_id === caller.userId)
        ? referrer_user_id
        : null;

    let validatedPartnerId: string | null = null;
    let attributionMethod: string | null = null;

    if (ref_code && typeof ref_code === "string" && /^[a-zA-Z0-9-]{3,40}$/.test(ref_code.trim())) {
      const { data: resolvedId } = await supabaseAdmin.rpc("resolve_referral_code", {
        p_code: ref_code.trim(),
      });

      if (resolvedId) {
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", resolvedId)
          .in("role", ["social_media_partner", "ambassador", "student", "agent"])
          .maybeSingle();

        if (roleRow?.role === "student") {
          validatedReferrerId = resolvedId as string;
        } else if (roleRow) {
          // partner / ambassador / agent — attribute via partner_id so the
          // commission function recognizes the agent self-referral reward.
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

    // ── Partner self-attribution (dashboard apply form) ─────────────
    // A logged-in partner/ambassador submitting from their own dashboard
    // attributes the case to themselves, derived server-side from the JWT —
    // the client-supplied partner_id is ignored for non-staff callers so a
    // partner can never credit a different account. A referral code on the
    // request still wins (the partner may be sharing a student's ref link),
    // so this only fills attribution when nothing else resolved it.
    if (!validatedPartnerId && caller.isPartner && caller.userId) {
      validatedPartnerId = caller.userId;
      attributionMethod = "partner_self";
    }

    // ── Referral discount ─────────────────────────────────────────────
    // A discount is granted ONLY when the referrer is a student (a partner
    // referral earns the referrer a commission, never a discount for the
    // applicant). The amount is read server-side from platform_settings —
    // never from the client body, so an applicant can't set their own discount.
    let cleanReferralDiscount = 0;
    if (validatedReferrerId) {
      const { data: settings } = await supabaseAdmin
        .from("platform_settings")
        .select("referral_discount_amount")
        .maybeSingle();
      const configuredDiscount = Number(settings?.referral_discount_amount ?? 0);
      cleanReferralDiscount = Number.isFinite(configuredDiscount)
        ? Math.min(Math.max(configuredDiscount, 0), MAX_REFERRAL_DISCOUNT)
        : 0;
    }

    // Duplicate phone detection — only block if the existing case comes from the same
    // public submission flows (contact_form or apply_page). If the blocking case was
    // created manually, by the team, or via referral, it may be a different person
    // who happens to share the same phone number, so we let the new submission through.
    const { data: existingCase } = await supabaseAdmin
      .from("cases")
      .select("id, full_name, status, source, referral_discount")
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

      // Referral flow hitting an existing contact_form/apply_page case: never
      // create a duplicate case — instead link the referral row to the existing
      // case and apply the discount, but ONLY if the case has none yet (never
      // overwrite a discount that is already on the case).
      if (validatedReferrerId && referral_id && typeof referral_id === "string" && UUID.test(referral_id)) {
        if ((!existingCase.referral_discount || Number(existingCase.referral_discount) === 0) && cleanReferralDiscount > 0) {
          await supabaseAdmin
            .from("cases")
            .update({ referral_discount: cleanReferralDiscount })
            .eq("id", existingCase.id);
        }
        await supabaseAdmin
          .from("referrals")
          .update({ referred_case_id: existingCase.id })
          .eq("id", referral_id)
          .eq("referrer_user_id", validatedReferrerId);
      }

      return new Response(
        JSON.stringify({
          duplicate: true,
          case_id: existingCase.id,
          existing_name: existingCase.full_name,
          existing_status: existingCase.status,
          referral_linked: !!(validatedReferrerId && referral_id && typeof referral_id === "string" && UUID.test(referral_id)),
          message: "A case with this phone number already exists — education data updated",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
