import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const checks: Record<string, { count: number; sample_ids: string[] }> = {};

    // 1. Cases with no assigned team member (may need attention)
    const { data: unassignedCases } = await supabaseAdmin
      .from('cases')
      .select('id')
      .is('assigned_to', null)
      .is('deleted_at', null)
      .not('status', 'in', '("enrollment_paid","cancelled","rejected")');
    checks['unassigned_cases'] = {
      count: unassignedCases?.length ?? 0,
      sample_ids: (unassignedCases ?? []).slice(0, 10).map((c: any) => c.id),
    };

    // 2. Duplicate leads by phone
    const { data: allLeads } = await supabaseAdmin
      .from('leads')
      .select('id, phone')
      .is('deleted_at', null);
    if (allLeads?.length) {
      const phoneCounts: Record<string, string[]> = {};
      for (const l of allLeads) {
        (phoneCounts[l.phone] ??= []).push(l.id);
      }
      const dupes = Object.entries(phoneCounts).filter(([, ids]) => ids.length > 1);
      checks['duplicate_leads_by_phone'] = {
        count: dupes.length,
        sample_ids: dupes.slice(0, 10).map(([phone]) => phone),
      };
    } else {
      checks['duplicate_leads_by_phone'] = { count: 0, sample_ids: [] };
    }

    // 3. Stale appointments (not completed/cancelled, scheduled > 7 days ago)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleAppts } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .not('outcome', 'in', '("completed","cancelled","no_show")')
      .lt('scheduled_at', sevenDaysAgo);
    checks['stale_appointments'] = {
      count: staleAppts?.length ?? 0,
      sample_ids: (staleAppts ?? []).slice(0, 10).map((a: any) => a.id),
    };

    // 4. Reward duplicates (same user + admin_notes)
    const { data: allRewards } = await supabaseAdmin
      .from('rewards')
      .select('id, user_id, admin_notes')
      .in('status', ['pending', 'approved']);
    if (allRewards?.length) {
      const rewardKeys: Record<string, string[]> = {};
      for (const r of allRewards) {
        const key = `${r.user_id}::${r.admin_notes ?? ''}`;
        (rewardKeys[key] ??= []).push(r.id);
      }
      const dupeRewards = Object.entries(rewardKeys).filter(([, ids]) => ids.length > 1);
      checks['duplicate_rewards'] = {
        count: dupeRewards.length,
        sample_ids: dupeRewards.slice(0, 10).flatMap(([, ids]) => ids.slice(0, 2)),
      };
    } else {
      checks['duplicate_rewards'] = { count: 0, sample_ids: [] };
    }

    // 5. Cases with commission_split_done=false but status=enrollment_paid (missed split)
    const { data: missedSplitCases } = await supabaseAdmin
      .from('cases')
      .select('id')
      .eq('status', 'enrollment_paid')
      .eq('commission_split_done', false)
      .is('deleted_at', null);
    checks['missed_commission_split'] = {
      count: missedSplitCases?.length ?? 0,
      sample_ids: (missedSplitCases ?? []).slice(0, 10).map((c: any) => c.id),
    };

    const healthy = Object.values(checks).every(c => c.count === 0);

    return new Response(JSON.stringify({ healthy, checks, ran_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
