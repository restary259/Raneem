
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { form_source, ...formData } = requestBody;

    if (!form_source) {
      return new Response(JSON.stringify({ error: "form_source is required", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate required fields
    if (!formData.name || !formData.email) {
      return new Response(JSON.stringify({ error: "الاسم والبريد الإلكتروني مطلوبان", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Save to database
    const { data: dbData, error: dbError } = await supabaseClient
      .from('contact_submissions')
      .insert([{
        form_source,
        data: formData,
        status: 'new',
        created_at: new Date().toISOString()
      }])
      .select();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ 
        error: "فشل في حفظ الرسالة. يرجى المحاولة لاحقاً.",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Contact submission saved:', dbData);

    // Optionally send email via Resend if configured
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY) {
      try {
        const { Resend } = await import('npm:resend@2.0.0');
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
          from: 'Darb Study <onboarding@resend.dev>',
          to: ['darbsocial27@gmail.com'],
          subject: `New Contact - ${form_source}`,
          html: `<h2>رسالة جديدة من ${formData.name}</h2>
            <p><strong>البريد:</strong> ${formData.email}</p>
            <p><strong>واتساب:</strong> ${formData.whatsapp || 'غير محدد'}</p>
            <p><strong>الخدمة:</strong> ${formData.service || 'غير محدد'}</p>
            <p><strong>الرسالة:</strong> ${formData.message || 'لا يوجد'}</p>`,
        });
      } catch (emailErr) {
        console.warn('Email sending failed (non-critical):', emailErr);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "تم إرسال رسالتك بنجاح",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Critical error:', error);
    return new Response(JSON.stringify({ 
      error: `خطأ في الخادم: ${error.message}`,
      success: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
