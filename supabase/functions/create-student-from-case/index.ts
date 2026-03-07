import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Validate caller ────────────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Team member access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ──────────────────────────────────────────────────
    const { case_id, student_email, student_full_name, student_phone } = await req.json();

    if (!case_id || !student_email || !student_full_name) {
      return new Response(JSON.stringify({ error: "case_id, student_email, student_full_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch full case data ───────────────────────────────────────────
    // We pull every field that has a corresponding column on profiles so
    // the student account is pre-populated with as much data as possible.
    const { data: caseData, error: caseErr } = await supabaseAdmin
      .from("cases")
      .select(
        `id, student_user_id, full_name, phone_number, city,
         education_level, passport_type, degree_interest,
         intake_notes, bagrut_score, english_units, math_units,
         english_level, source, partner_id, assigned_to,
         created_at`,
      )
      .eq("id", case_id)
      .single();

    if (caseErr || !caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If account already exists for this case, return early
    if (caseData.student_user_id) {
      return new Response(
        JSON.stringify({
          success: true,
          user_id: caseData.student_user_id,
          email: student_email,
          invited: false,
          message: "Student account already exists for this case",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch case_submission for programme/school dates ──────────────
    const { data: submission } = await supabaseAdmin
      .from("case_submissions")
      .select(
        `program_id, program_start_date, program_end_date,
         accommodation_id, service_fee`,
      )
      .eq("case_id", case_id)
      .maybeSingle();

    // ── Resolve intake month from intake_notes or programme start date ─
    // intake_notes is a free-text field like "2026-05" or "May 2026"
    // programme start date (YYYY-MM-DD) is more reliable when available
    let intakeMonth: string | null = null;
    if (submission?.program_start_date) {
      // Extract YYYY-MM from ISO date
      intakeMonth = submission.program_start_date.substring(0, 7);
    } else if (caseData.intake_notes) {
      // Try to parse "YYYY-MM" pattern from intake_notes
      const m = caseData.intake_notes.match(/\d{4}-\d{2}/);
      if (m) intakeMonth = m[0];
    }

    // ── Resolve university/school name from programme ─────────────────
    let universityName: string | null = null;
    if (submission?.program_id) {
      const { data: programme } = await supabaseAdmin
        .from("master_services")
        .select("school_name, name")
        .eq("id", submission.program_id)
        .maybeSingle();
      if (programme?.school_name) universityName = programme.school_name;
      else if (programme?.name) universityName = programme.name;
    }

    // ── Check if auth user already exists ─────────────────────────────
    let studentId: string;
    let tempPassword: string | null = null;

    const existingUsersList = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsersList.data?.users?.find(
      (u: any) => u.email?.toLowerCase() === student_email.toLowerCase(),
    );

    if (existingUser) {
      // Reuse existing auth account — just link it
      studentId = existingUser.id;
    } else {
      // Generate a secure temporary password.
      // Format: 9 random alphanum chars + "Aa1!" suffix = always passes
      // Supabase's default password policy (min 6 chars, mixed case, digit).
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      tempPassword =
        Array.from(crypto.getRandomValues(new Uint8Array(9)))
          .map((b) => alphabet[b % alphabet.length])
          .join("") + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: student_email,
        password: tempPassword,
        email_confirm: true, // skip email verification — admin handles onboarding
        user_metadata: {
          full_name: student_full_name,
          phone_number: student_phone ?? caseData.phone_number ?? "",
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      studentId = newUser.user.id;
    }

    // ── Assign student role ────────────────────────────────────────────
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // ── Upsert profile — export all available case data ───────────────
    // Only set values that actually exist on the cases record so we don't
    // overwrite existing profile fields with null.
    const profileUpsert: Record<string, unknown> = {
      id: studentId,
      email: student_email,
      full_name: student_full_name,
      must_change_password: true,
      case_id: case_id,
      created_by: callerId,
    };

    // Phone
    const phone = student_phone ?? caseData.phone_number ?? null;
    if (phone) profileUpsert.phone_number = phone;

    // City
    if (caseData.city) profileUpsert.city = caseData.city;

    // Intake month
    if (intakeMonth) profileUpsert.intake_month = intakeMonth;

    // University / school
    if (universityName) profileUpsert.university_name = universityName;

    // Arrival date — derive from programme start date if available
    if (submission?.program_start_date) {
      profileUpsert.arrival_date = submission.program_start_date;
    }

    // Nationality / passport type from case
    if (caseData.passport_type) profileUpsert.nationality = caseData.passport_type;

    // Notes — combine degree interest and education level as starter notes
    const noteParts: string[] = [];
    if (caseData.education_level) noteParts.push(`Education: ${caseData.education_level}`);
    if (caseData.degree_interest) noteParts.push(`Interest: ${caseData.degree_interest}`);
    if (caseData.english_level) noteParts.push(`English: ${caseData.english_level}`);
    if (noteParts.length > 0) profileUpsert.notes = noteParts.join(" | ");

    await supabaseAdmin.from("profiles").upsert(profileUpsert);

    // ── Link case → student ────────────────────────────────────────────
    await supabaseAdmin.from("cases").update({ student_user_id: studentId }).eq("id", case_id);

    // ── Audit log (non-fatal) ─────────────────────────────────────────
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .single();

    await supabaseAdmin
      .rpc("log_activity", {
        p_actor_id: callerId,
        p_actor_name: callerProfile?.full_name ?? "Team Member",
        p_action: "student_account_created",
        p_entity_type: "case",
        p_entity_id: case_id,
        p_metadata: {
          student_email,
          student_full_name,
          student_id: studentId,
          temp_password_issued: tempPassword !== null,
          data_exported: {
            city: !!caseData.city,
            intake_month: !!intakeMonth,
            university: !!universityName,
            arrival_date: !!submission?.program_start_date,
            phone: !!phone,
          },
        },
      })
      .catch(() => {
        /* non-fatal */
      });

    // ── Response ───────────────────────────────────────────────────────
    const responsePayload: Record<string, unknown> = {
      success: true,
      user_id: studentId,
      email: student_email,
      invited: false,
      message: tempPassword
        ? "Student account created with temporary password"
        : "Student account linked to existing user",
    };

    if (tempPassword) {
      // Only returned once — never logged
      responsePayload.temp_password = tempPassword;
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-student-from-case error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
