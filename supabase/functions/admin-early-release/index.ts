import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify caller identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { case_id } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: 'case_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find all pending rewards linked to this case via admin_notes
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('rewards')
      .select('*')
      .like('admin_notes', `%${case_id}%`)
      .eq('status', 'pending');

    if (rewardsError) throw rewardsError;

    if (!rewards || rewards.length === 0) {
      return new Response(JSON.stringify({ error: 'No pending rewards found for this case' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rewardIds = rewards.map(r => r.id);
    const totalAmount = rewards.reduce((sum, r) => sum + Number(r.amount), 0);

    // Mark all rewards as paid immediately
    const { error: updateError } = await supabaseAdmin
      .from('rewards')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', rewardIds);

    if (updateError) throw updateError;

    // Group rewards by user for payout requests
    const byUser: Record<string, typeof rewards> = {};
    for (const r of rewards) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }

    // Create payout_request per user with status 'paid'
    for (const [userId, userRewards] of Object.entries(byUser)) {
      const userAmount = userRewards.reduce((sum, r) => sum + Number(r.amount), 0);
      const userRewardIds = userRewards.map(r => r.id);

      await supabaseAdmin.from('payout_requests').insert({
        requestor_id: userId,
        requestor_role: 'social_media_partner',
        linked_reward_ids: userRewardIds,
        amount: userAmount,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user.id,
        admin_notes: `Early release by admin for case ${case_id}`,
      });
    }

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'early_payout_release',
      target_id: case_id,
      target_table: 'rewards',
      details: JSON.stringify({ reward_ids: rewardIds, total_amount: totalAmount }),
    });

    return new Response(JSON.stringify({ ok: true, rewards_released: rewardIds.length, total_amount: totalAmount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
