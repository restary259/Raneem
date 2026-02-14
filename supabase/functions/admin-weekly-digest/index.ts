import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    const [leadsRes, casesRes, profilesRes, referralsRes] = await Promise.all([
      serviceClient.from("leads").select("id, status, created_at").gte("created_at", weekAgoISO),
      serviceClient.from("student_cases").select("id, case_status, service_fee, school_commission, created_at, paid_at").gte("created_at", weekAgoISO),
      serviceClient.from("profiles").select("id, created_at").gte("created_at", weekAgoISO),
      serviceClient.from("referrals").select("id, status, created_at").gte("created_at", weekAgoISO),
    ]);

    const newLeads = leadsRes.data?.length || 0;
    const newCases = casesRes.data?.length || 0;
    const newStudents = profilesRes.data?.length || 0;
    const newReferrals = referralsRes.data?.length || 0;
    const paidCases = casesRes.data?.filter(c => c.case_status === "paid" || c.case_status === "completed") || [];
    const weekRevenue = paidCases.reduce((s, c) => s + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);

    // Get admin user IDs
    const { data: adminRoles } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ message: "No admins found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create in-app notification for each admin
    for (const role of adminRoles) {
      await serviceClient.from("notifications").insert({
        user_id: role.user_id,
        title: "Weekly Digest",
        body: `This week: ${newLeads} new leads, ${newStudents} new students, ${paidCases.length} paid, ${weekRevenue}€ revenue.`,
        source: "system",
        metadata: { newLeads, newCases, newStudents, newReferrals, weekRevenue },
      });
    }

    return new Response(JSON.stringify({ success: true, kpis: { newLeads, newCases, newStudents, newReferrals, weekRevenue } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
