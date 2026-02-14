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

    // Gather KPIs for the week
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

    // Get admin emails
    const { data: adminRoles } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ message: "No admins found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map(r => r.user_id);
    const { data: adminProfiles } = await serviceClient
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminIds);

    if (!adminProfiles || adminProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No admin profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send digest email to each admin via send-branded-email
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let sent = 0;

    for (const admin of adminProfiles) {
      if (!admin.email) continue;

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-branded-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            email_type: "weekly_digest",
            user_email: admin.email,
            user_name: admin.full_name,
            digest_data: {
              newLeads,
              newCases,
              newStudents,
              newReferrals,
              weekRevenue,
              paidCount: paidCases.length,
            },
          }),
        });
        sent++;
      } catch {
        // Skip failed sends
      }

      // Also create in-app notification
      await serviceClient.from("notifications").insert({
        user_id: admin.id,
        title: "Weekly Digest",
        body: `This week: ${newLeads} new leads, ${newStudents} new students, ${paidCases.length} paid, ${weekRevenue}€ revenue.`,
        source: "system",
        metadata: { newLeads, newCases, newStudents, newReferrals, weekRevenue },
      });
    }

    return new Response(JSON.stringify({ success: true, sent, kpis: { newLeads, newCases, newStudents, newReferrals, weekRevenue } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
