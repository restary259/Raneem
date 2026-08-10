import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";


Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
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

    const { target_user_id, transfer_to, force_purge, reason } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id required' }), { status: 400, headers: corsHeaders });
    }

    // Check for pending payouts
    const { data: pendingPayouts } = await supabaseAdmin
      .from('payout_requests')
      .select('id')
      .eq('requestor_id', target_user_id)
      .in('status', ['pending', 'approved']);

    if (pendingPayouts && pendingPayouts.length > 0) {
      return new Response(JSON.stringify({ error: 'User has pending payouts. Resolve them before purging.' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Get assigned cases count from cases table
    const { data: assignedCases } = await supabaseAdmin
      .from('cases')
      .select('id')
      .eq('assigned_to', target_user_id)
      .is('deleted_at', null);

    const caseCount = assignedCases?.length ?? 0;

    if (caseCount > 0) {
      if (transfer_to) {
        // Transfer all assigned cases to new member
        await supabaseAdmin
          .from('cases')
          .update({ assigned_to: transfer_to })
          .eq('assigned_to', target_user_id)
          .is('deleted_at', null);
      } else if (force_purge) {
        // Set cases to unassigned + flag for reassignment
        await supabaseAdmin
          .from('cases')
          .update({ assigned_to: null, requires_reassignment: true })
          .eq('assigned_to', target_user_id)
          .is('deleted_at', null);
      } else {
        return new Response(JSON.stringify({ 
          error: 'User has assigned cases. Provide transfer_to or set force_purge=true.',
          case_count: caseCount,
        }), { status: 400, headers: corsHeaders });
      }
    }

    // Cancel pending rewards
    await supabaseAdmin
      .from('rewards')
      .update({ status: 'cancelled' })
      .eq('user_id', target_user_id)
      .in('status', ['pending', 'approved']);

    // Anonymize the account instead of hard-deleting, so financial/audit
    // references (transaction_log, payout_requests, audit log) remain intact.
    // Use service role to bypass the auth.uid() self-check in the RPC.
    const { error: anonError } = await supabaseAdmin.rpc('anonymize_user', { p_user_id: target_user_id });
    if (anonError) throw anonError;

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'user_purged',
      target_id: target_user_id,
      target_table: 'profiles',
      details: JSON.stringify({ transfer_to, force_purge, reason, cases_affected: caseCount }),
    });

    return new Response(JSON.stringify({ ok: true, cases_affected: caseCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return serverErrorResponse(err, corsHeaders, "Failed to purge account");
  }
});
