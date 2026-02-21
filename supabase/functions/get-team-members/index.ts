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

    // Check admin or lawyer role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'lawyer']);

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Get all users with 'lawyer' role
    const { data: lawyerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'lawyer');

    const lawyerIds = lawyerRoles?.map(r => r.user_id) ?? [];

    if (lawyerIds.length === 0) {
      return new Response(JSON.stringify({ members: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get active profiles for these users
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', lawyerIds)
      .neq('student_status', 'inactive')
      .order('full_name', { ascending: true });

    if (profileError) throw profileError;

    return new Response(JSON.stringify({ members: profiles ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
