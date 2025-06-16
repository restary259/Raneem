
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
  console.log('=== EMAIL FUNCTION START ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request handled');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check API key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is missing from environment variables");
      return new Response(JSON.stringify({ 
        error: "Server configuration error: Missing email API key.",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log('✅ Resend API key found');

    const resend = new Resend(RESEND_API_KEY);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📥 Request body received:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { form_source, ...formData } = requestBody;

    if (!form_source) {
      console.error('❌ form_source is missing');
      return new Response(JSON.stringify({ 
        error: "form_source is a required field.",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for admin operations
    );

    console.log('💾 Attempting to save to database...');

    // Save to database using service role (bypasses RLS)
    const { data: dbData, error: dbError } = await supabaseClient
      .from('contact_submissions')
      .insert([{
        form_source: form_source,
        data: formData,
        created_at: new Date().toISOString()
      }])
      .select();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      // Continue with email even if DB fails
      console.log('⚠️ Continuing with email despite DB error...');
    } else {
      console.log('✅ Successfully saved to database:', dbData);
    }

    // Prepare email content
    const subject = `New Contact Form Submission - ${form_source}`;
    
    // Create a clean, professional email format
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Contact Form Submission</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
              New Contact Form Submission
            </h1>
            
            <p style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #3498db;">
              <strong>Source:</strong> ${form_source}
            </p>
            
            <h2 style="color: #34495e;">Contact Details:</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${Object.entries(formData).map(([key, value]) => `
                <tr style="border-bottom: 1px solid #ecf0f1;">
                  <td style="padding: 8px; font-weight: bold; text-transform: capitalize; width: 30%;">
                    ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                  </td>
                  <td style="padding: 8px;">${value || 'Not provided'}</td>
                </tr>
              `).join('')}
            </table>
            
            <hr style="margin: 20px 0; border: none; height: 1px; background-color: #ecf0f1;">
            
            <p style="font-size: 12px; color: #7f8c8d;">
              This email was sent automatically from the Darb Study website contact form.
              <br>Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </body>
      </html>
    `;

    const emailText = `
New Contact Form Submission

Source: ${form_source}

Contact Details:
${Object.entries(formData).map(([key, value]) => 
  `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value || 'Not provided'}`
).join('\n')}

---
This email was sent automatically from the Darb Study website.
Timestamp: ${new Date().toISOString()}
    `;

    console.log('📧 Preparing to send email...');
    console.log('To:', TO_EMAIL);
    console.log('From:', FROM_EMAIL);
    console.log('Subject:', subject);

    // Send email with both HTML and text versions
    const emailResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: subject,
      html: emailHtml,
      text: emailText,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID(),
      }
    });

    console.log('📧 Resend API response:', JSON.stringify(emailResult, null, 2));

    if (emailResult.error) {
      console.error('❌ Resend error:', emailResult.error);
      return new Response(JSON.stringify({ 
        error: `Email sending failed: ${JSON.stringify(emailResult.error)}`,
        success: false,
        details: emailResult.error
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('✅ Email sent successfully! ID:', emailResult.data?.id);
    console.log('=== EMAIL FUNCTION SUCCESS ===');

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully",
      emailId: emailResult.data?.id,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR in email function:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== EMAIL FUNCTION FAILED ===');
    
    return new Response(JSON.stringify({ 
      error: `Server error: ${error.message}`,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
