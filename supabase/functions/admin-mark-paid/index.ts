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
      .from('student_cases')
      .select('id, case_status, is_paid_admin, paid_at')
      .eq('id', case_id)
      .single();

    if (fetchError || !caseRow) {
      return new Response(JSON.stringify({ error: 'Case not found' }), { status: 404, headers: corsHeaders });
    }

    // Idempotent: if already marked paid by admin, return success
    if (caseRow.is_paid_admin) {
      return new Response(JSON.stringify({ ok: true, message: 'Already marked as paid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as paid — this sets case_status to 'paid' which triggers auto_split_payment
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('student_cases')
      .update({
        case_status: 'paid',
        paid_at: now,
        is_paid_admin: true,
        paid_countdown_started_at: now,
      })
      .eq('id', case_id);

    if (updateError) throw updateError;

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'admin_mark_paid',
      target_id: case_id,
      target_table: 'student_cases',
      details: `Admin marked case as paid. Countdown started at ${now}`,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
