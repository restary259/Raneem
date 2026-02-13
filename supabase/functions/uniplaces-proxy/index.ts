import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const apiKey = Deno.env.get('UNIPLACES_API_KEY');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            message: 'Student housing search is coming soon. Please check back later!' 
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();
      const { action, ...params } = body;

      let url: string;
      let method: string = 'GET';
      let reqBody: string | null = null;

      switch (action) {
        case 'get-cities':
          url = 'https://api-export.staging-uniplaces.com/v1/cities';
          break;

        case 'get-offers':
          const { city, moveIn, moveOut, limit = 50, page = 1, maxBudget, rentType } = params;
          const searchParams = new URLSearchParams({
            limit: String(limit),
            page: String(page),
            ...(moveIn && { move_in: moveIn }),
            ...(moveOut && { move_out: moveOut }),
            ...(maxBudget && { rent_price_cents_max: String(maxBudget * 100) }),
            ...(rentType && { rent_type: rentType }),
          });
          url = `https://api-export.staging-uniplaces.com/v1/cities/${city}/offers?${searchParams}`;
          break;

        case 'get-offer-detail':
          const { offerId } = params;
          url = `https://api-export.staging-uniplaces.com/v1/offers/${offerId}`;
          break;

        case 'calculate-pricing':
          url = 'https://api-export.staging-uniplaces.com/v1/calculate-pricing';
          method = 'POST';
          reqBody = JSON.stringify({
            offer_id: params.offerId,
            move_in_date: params.moveIn,
            move_out_date: params.moveOut,
            guests: params.guests || 1,
          });
          break;

        default:
          return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: corsHeaders }
          );
      }

      const options: RequestInit = {
        method,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      };

      if (reqBody) {
        options.body = reqBody;
      }

      const response = await fetch(url, options);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  });
}
