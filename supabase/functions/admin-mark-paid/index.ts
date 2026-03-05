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

    const { case_id } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: 'case_id required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch current case state
    const { data: caseRow, error: fetchError } = await supabaseAdmin
      .from('cases')
      .select('id, status')
      .eq('id', case_id)
      .single();

    if (fetchError || !caseRow) {
      return new Response(JSON.stringify({ error: 'Case not found' }), { status: 404, headers: corsHeaders });
    }

    // Idempotent: already paid
    if (caseRow.status === 'enrollment_paid') {
      return new Response(JSON.stringify({ ok: true, message: 'Already marked as paid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    // Update case status to enrollment_paid
    const { error: updateError } = await supabaseAdmin
      .from('cases')
      .update({ status: 'enrollment_paid', updated_at: now })
      .eq('id', case_id);

    if (updateError) throw updateError;

    // Update case_submission enrollment payment fields
    await supabaseAdmin
      .from('case_submissions')
      .update({
        enrollment_paid_at: now,
        enrollment_paid_by: user.id,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: user.id,
      })
      .eq('case_id', case_id);

    // Log activity
    await supabaseAdmin.rpc('log_activity', {
      p_actor_id: user.id,
      p_actor_name: 'Admin',
      p_action: 'case_marked_paid',
      p_entity_type: 'cases',
      p_entity_id: case_id,
      p_metadata: { paid_at: now },
    });

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'admin_mark_paid',
      target_id: case_id,
      target_table: 'cases',
      details: `Admin marked case as enrollment_paid at ${now}`,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
