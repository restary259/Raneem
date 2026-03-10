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

    // Fetch from canonical `cases` table with `enrollment_paid` status
    const [leadsRes, casesRes, profilesRes, referralsRes, submissionsRes] = await Promise.all([
      serviceClient.from("leads").select("id, status, created_at").gte("created_at", weekAgoISO),
      serviceClient.from("cases").select("id, status, influencer_commission, school_commission, lawyer_commission, created_at").is("deleted_at", null).gte("created_at", weekAgoISO),
      serviceClient.from("profiles").select("id, created_at").gte("created_at", weekAgoISO),
      serviceClient.from("referrals").select("id, status, created_at").gte("created_at", weekAgoISO),
      // Get service_fee from case_submissions for enrollment_paid cases this week
      serviceClient.from("case_submissions").select("case_id, service_fee, enrollment_paid_at").is("deleted_at", null).gte("enrollment_paid_at", weekAgoISO),
    ]);

    const newLeads = leadsRes.data?.length || 0;
    const newCases = casesRes.data?.length || 0;
    const newStudents = profilesRes.data?.length || 0;
    const newReferrals = referralsRes.data?.length || 0;

    // Revenue = service_fee (from case_submissions) + school_commission (from cases) for enrollment_paid cases
    const paidCaseIds = new Set(
      (casesRes.data ?? []).filter(c => c.status === "enrollment_paid").map(c => c.id)
    );
    const paidCasesCount = paidCaseIds.size;

    // Sum service fees from case_submissions for enrollment_paid cases
    const serviceFeeRevenue = (submissionsRes.data ?? [])
      .filter(s => paidCaseIds.has(s.case_id))
      .reduce((sum, s) => sum + (Number(s.service_fee) || 0), 0);

    // Sum school_commission from cases for enrollment_paid cases this week
    const schoolCommRevenue = (casesRes.data ?? [])
      .filter(c => c.status === "enrollment_paid")
      .reduce((sum, c) => sum + (Number(c.school_commission) || 0), 0);

    const weekRevenue = serviceFeeRevenue + schoolCommRevenue;

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
        body: `This week: ${newLeads} new leads, ${newStudents} new students, ${paidCasesCount} enrolled, ₪${weekRevenue.toLocaleString()} revenue.`,
        source: "system",
        metadata: { newLeads, newCases, newStudents, newReferrals, paidCasesCount, weekRevenue },
      });
    }

    return new Response(JSON.stringify({ success: true, kpis: { newLeads, newCases, newStudents, newReferrals, paidCasesCount, weekRevenue } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
