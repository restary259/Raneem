import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody, uuid, shortText, longText } from "../_shared/validate.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = userData.user.id;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Team member access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const isAdmin = roles.some((r: { role: string }) => r.role === "admin");

    const parsed = await parseBody(req, z.object({
      appointment_id: uuid,
      outcome: shortText.min(1),
      outcome_notes: longText.optional().nullable(),
      new_scheduled_at: z.string().datetime().optional().nullable(),
    }));
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { appointment_id, outcome, outcome_notes, new_scheduled_at } = parsed.data;

    if (!appointment_id || !outcome) {
      return new Response(JSON.stringify({ error: "appointment_id and outcome required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validOutcomes = ["completed", "delayed", "cancelled", "rescheduled", "no_show"];
    if (!validOutcomes.includes(outcome)) {
      return new Response(JSON.stringify({ error: "Invalid outcome" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: appt, error: apptError } = await supabaseAdmin.from("appointments").select("*").eq("id", appointment_id).single();
    if (apptError || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ownership check: a non-admin team member may only record outcomes for
    // their own appointments or appointments on a case assigned to them.
    if (!isAdmin) {
      let owns = appt.team_member_id === userId;
      if (!owns && appt.case_id) {
        const { data: caseRow } = await supabaseAdmin
          .from("cases")
          .select("assigned_to")
          .eq("id", appt.case_id)
          .maybeSingle();
        owns = caseRow?.assigned_to === userId;
      }
      if (!owns) {
        return new Response(JSON.stringify({ error: "This appointment is not assigned to you" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    // Update appointment outcome
    await supabaseAdmin.from("appointments").update({
      outcome,
      outcome_notes: outcome_notes ?? null,
      outcome_recorded_at: new Date().toISOString(),
      outcome_recorded_by: userId,
    }).eq("id", appointment_id);

    // Update case status based on outcome
    let newCaseStatus: string | null = null;
    let isNoShow = false;

    if (outcome === "completed") newCaseStatus = "profile_completion";
    else if (outcome === "cancelled") newCaseStatus = "contacted";
    else if (outcome === "no_show") { newCaseStatus = "forgotten"; isNoShow = true; }

    if (newCaseStatus) {
      const updatePayload: Record<string, unknown> = { status: newCaseStatus };
      if (isNoShow) updatePayload.is_no_show = true;
      await supabaseAdmin.from("cases").update(updatePayload).eq("id", appt.case_id);
    }

    // For rescheduled: create new appointment row
    if ((outcome === "rescheduled" || outcome === "delayed") && new_scheduled_at) {
      const { data: newAppt } = await supabaseAdmin.from("appointments").insert({
        case_id: appt.case_id,
        team_member_id: userId,
        scheduled_at: new_scheduled_at,
        notes: `Rescheduled from ${appt.scheduled_at}`,
      }).select().single();

      if (newAppt && outcome === "rescheduled") {
        await supabaseAdmin.from("appointments").update({ rescheduled_to: newAppt.id }).eq("id", appointment_id);
      }
    }

    // Log activity
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).single();
    await supabaseAdmin.rpc("log_activity", {
      p_actor_id: userId,
      p_actor_name: profile?.full_name ?? "Team Member",
      p_action: `appointment_${outcome}`,
      p_entity_type: "appointment",
      p_entity_id: appointment_id,
      p_metadata: { case_id: appt.case_id, outcome, new_case_status: newCaseStatus },
    });

    return new Response(JSON.stringify({ success: true, outcome, new_case_status: newCaseStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("record-appointment-outcome error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
