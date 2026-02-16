import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Find leads assigned but not contacted within 24h
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Get cases that are in 'assigned' status
    const { data: staleCases, error: caseErr } = await supabase
      .from("student_cases")
      .select("id, lead_id, assigned_lawyer_id, assigned_at, case_status")
      .eq("case_status", "assigned")
      .not("assigned_at", "is", null);

    if (caseErr) throw caseErr;

    const results = { highlighted: 0, notified: 0, stale_marked: 0 };

    for (const sc of staleCases || []) {
      if (!sc.assigned_at) continue;
      const assignedAt = new Date(sc.assigned_at).getTime();
      const hoursSinceAssign = (now.getTime() - assignedAt) / (1000 * 60 * 60);

      // After 48 hours — mark lead as stale
      if (hoursSinceAssign >= 48) {
        await supabase.from("leads").update({ is_stale: true }).eq("id", sc.lead_id);
        
        // Create admin notification
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "⚠️ SLA Breach: Lead uncontacted 48h+",
            body: `Case ${sc.id.slice(0, 8)} has been assigned for ${Math.floor(hoursSinceAssign)}h without contact. Consider reassignment.`,
            source: "sla_automation",
            metadata: { case_id: sc.id, lead_id: sc.lead_id, hours: Math.floor(hoursSinceAssign) },
          });
        }
        results.stale_marked++;
      }
      // After 24 hours — notify admin
      else if (hoursSinceAssign >= 24) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        for (const admin of admins || []) {
          // Check if we already notified for this case today
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("source", "sla_automation")
            .contains("metadata", { case_id: sc.id })
            .gte("created_at", twentyFourHoursAgo)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "⏰ SLA Warning: Lead approaching 48h",
              body: `Case ${sc.id.slice(0, 8)} assigned ${Math.floor(hoursSinceAssign)}h ago. Contact required.`,
              source: "sla_automation",
              metadata: { case_id: sc.id, lead_id: sc.lead_id, hours: Math.floor(hoursSinceAssign) },
            });
          }
        }
        results.notified++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
