
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple HTML tag stripper
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Rate limit
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح. يرجى المحاولة بعد ساعة.", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { form_source, honeypot, ...formData } = requestBody;

    // Honeypot check - bots fill this hidden field
    if (honeypot) {
      // Silently accept but don't process
      return new Response(JSON.stringify({ success: true, message: "تم إرسال رسالتك بنجاح" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!form_source) {
      return new Response(JSON.stringify({ error: "form_source is required", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Input validation and sanitization
    const name = stripHtml(String(formData.name || '')).slice(0, 100);
    const email = stripHtml(String(formData.email || '')).slice(0, 255);
    const whatsapp = String(formData.whatsapp || '').replace(/[^\d+\-\s]/g, '').slice(0, 20);
    const message = stripHtml(String(formData.message || '')).slice(0, 2000);
    const service = stripHtml(String(formData.service || '')).slice(0, 200);

    if (!name || name.length < 2) {
      return new Response(JSON.stringify({ error: "الاسم مطلوب (حرفين على الأقل)", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "بريد إلكتروني غير صالح", success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const sanitizedData = { ...formData, name, email, whatsapp, message, service };

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: dbData, error: dbError } = await supabaseClient
      .from('contact_submissions')
      .insert([{
        form_source,
        data: sanitizedData,
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
      error: "خطأ في الخادم",
      success: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
