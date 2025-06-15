
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0';

const TO_EMAIL = 'darbsocial27@gmail.com';
const FROM_EMAIL = 'Darb Study <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set in environment variables.");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing email API key." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    const resend = new Resend(RESEND_API_KEY);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { form_source, ...formData } = await req.json()

    if (!form_source) {
      throw new Error("form_source is a required field.");
    }

    const { error: dbError } = await supabaseClient.from('contact_submissions').insert([
        { form_source: form_source, data: formData }
    ]);

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Error saving submission to database: ${dbError.message}`);
    }

    const subject = `New Submission from: ${form_source}`;
    const emailHtml = `
      <h1>New Form Submission</h1>
      <p><strong>Source:</strong> ${form_source}</p>
      <hr>
      <h2>Details:</h2>
      <pre>${JSON.stringify(formData, null, 2)}</pre>
    `;
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: subject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      throw new Error(`Error sending email notification: ${JSON.stringify(emailError)}`);
    }

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Function error:', error.stack || error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
