import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const { full_name, phone_number, source = 'apply_page', partner_id, actor_id, actor_name } = body;

    if (!full_name || !phone_number) {
      return new Response(JSON.stringify({ error: 'full_name and phone_number are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate partner_id if provided
    let validatedPartnerId: string | null = null;
    if (partner_id) {
      const { data: partnerRole } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('user_id', partner_id)
        .eq('role', 'social_media_partner')
        .maybeSingle();

      if (partnerRole) {
        validatedPartnerId = partner_id;
      }
    }

    // Insert the case
    const { data: newCase, error: caseError } = await supabaseAdmin
      .from('cases')
      .insert({
        full_name: full_name.trim(),
        phone_number: phone_number.trim(),
        source,
        partner_id: validatedPartnerId,
        status: 'new',
      })
      .select('id')
      .single();

    if (caseError) throw caseError;

    // Log activity
    if (actor_id && actor_name) {
      await supabaseAdmin.rpc('log_activity', {
        p_actor_id: actor_id,
        p_actor_name: actor_name,
        p_action: 'case_created_from_apply',
        p_entity_type: 'cases',
        p_entity_id: newCase.id,
        p_metadata: { source, partner_id: validatedPartnerId },
      });
    }

    return new Response(JSON.stringify({ case_id: newCase.id, ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
