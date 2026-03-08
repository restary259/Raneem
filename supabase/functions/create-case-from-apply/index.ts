import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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
      actor_id,
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

    // Duplicate phone detection
    const { data: existingCase } = await supabaseAdmin
      .from("cases")
      .select("id, full_name, status")
      .eq("phone_number", cleanPhone)
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

    // Validate partner_id if provided
    let validatedPartnerId: string | null = null;
    if (partner_id) {
      const { data: partnerRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", partner_id)
        .in("role", ["social_media_partner", "influencer"])
        .maybeSingle();

      if (partnerRole) {
        validatedPartnerId = partner_id;
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
        referred_by: referrer_user_id ?? null,
        referral_discount: referral_discount ? Number(referral_discount) : 0,
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

    // Link referral record back to the new case
    if (referral_id && newCase?.id) {
      await supabaseAdmin.from("referrals").update({ referred_case_id: newCase.id }).eq("id", referral_id);
    }

    // Log activity
    if (actor_id && actor_name) {
      await supabaseAdmin.rpc("log_activity", {
        p_actor_id: actor_id,
        p_actor_name: actor_name,
        p_action: "case_created_from_apply",
        p_entity_type: "cases",
        p_entity_id: newCase.id,
        p_metadata: { source, partner_id: validatedPartnerId },
      });
    }

    return new Response(JSON.stringify({ case_id: newCase.id, ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-case-from-apply error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
