
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Darb Study <onboarding@resend.dev>';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ 
      error: "RESEND_API_KEY is not configured",
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const requestBody = await req.json();
    
    const { 
      email_type, 
      user_email, 
      user_name, 
      confirmation_url, 
      password_reset_url,
      magic_link_url 
    } = requestBody;

    let subject = '';
    let htmlContent = '';
    let textContent = '';

    const brandColors = {
      primary: '#2563eb',
      secondary: '#f97316',
      background: '#f8fafc',
      text: '#1e293b'
    };

    const baseTemplate = (content: string, isRTL = true) => `
      <!DOCTYPE html>
      <html lang="${isRTL ? 'ar' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Darb Study</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0; 
              padding: 0; 
              background-color: ${brandColors.background};
              color: ${brandColors.text};
              direction: ${isRTL ? 'rtl' : 'ltr'};
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white; 
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary});
              padding: 30px; 
              text-align: center; 
              color: white;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .content { 
              padding: 40px 30px;
              line-height: 1.6;
            }
            .button { 
              background: ${brandColors.primary};
              color: white; 
              padding: 15px 30px; 
              text-decoration: none; 
              border-radius: 8px; 
              display: inline-block; 
              margin: 20px 0;
              font-weight: bold;
              transition: background-color 0.3s ease;
            }
            .button:hover {
              background: #1d4ed8;
            }
            .footer { 
              background: #f1f5f9; 
              padding: 20px; 
              text-align: center; 
              font-size: 12px; 
              color: #64748b;
            }
            .highlight {
              background-color: #fef3c7;
              padding: 2px 6px;
              border-radius: 4px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">درب للدراسة | Darb Study</div>
              <div>Your Gateway to Global Education</div>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>© 2024 Darb Study. All rights reserved.</p>
              <p>مؤسسة درب للاستشارات التعليمية</p>
            </div>
          </div>
        </body>
      </html>
    `;

    switch (email_type) {
      case 'signup_confirmation':
        subject = 'مرحباً بك في درب للدراسة - تأكيد الحساب | Welcome to Darb Study';
        htmlContent = baseTemplate(`
          <h2>مرحباً ${user_name || 'عزيزي الطالب'}!</h2>
          <p>نرحب بك في <span class="highlight">درب للدراسة</span> - بوابتك للتعليم العالمي!</p>
          <p>لتفعيل حسابك والبدء في رحلتك التعليمية، يرجى النقر على الرابط أدناه:</p>
          <div style="text-align: center;">
            <a href="${confirmation_url}" class="button">تفعيل الحساب الآن</a>
          </div>
          <p><strong>ما يمكنك فعله بعد تفعيل حسابك:</strong></p>
          <ul>
            <li>إدارة طلبات القبول الجامعي</li>
            <li>متابعة حالة التأشيرة</li>
            <li>الوصول إلى الخدمات الاستشارية</li>
            <li>التواصل مع فريق الدعم</li>
          </ul>
          <p>إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذا البريد الإلكتروني.</p>
          <p>مع أطيب التحيات،<br>فريق درب للدراسة</p>
        `);
        textContent = `مرحباً ${user_name || 'عزيزي الطالب'}! نرحب بك في درب للدراسة. لتفعيل حسابك، يرجى زيارة: ${confirmation_url}`;
        break;

      case 'password_reset':
        subject = 'إعادة تعيين كلمة المرور - درب للدراسة | Password Reset';
        htmlContent = baseTemplate(`
          <h2>طلب إعادة تعيين كلمة المرور</h2>
          <p>مرحباً ${user_name || 'عزيزي المستخدم'},</p>
          <p>تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في درب للدراسة.</p>
          <div style="text-align: center;">
            <a href="${password_reset_url}" class="button">إعادة تعيين كلمة المرور</a>
          </div>
          <p><strong>مهم:</strong> هذا الرابط صالح لمدة 24 ساعة فقط لأغراض الأمان.</p>
          <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد أو التواصل معنا فوراً.</p>
          <p>مع أطيب التحيات،<br>فريق الأمان - درب للدراسة</p>
        `);
        textContent = `طلب إعادة تعيين كلمة المرور. يرجى زيارة: ${password_reset_url}`;
        break;

      case 'magic_link':
        subject = 'رابط تسجيل الدخول السريع - درب للدراسة | Magic Login Link';
        htmlContent = baseTemplate(`
          <h2>رابط تسجيل الدخول السريع</h2>
          <p>مرحباً ${user_name || 'عزيزي المستخدم'},</p>
          <p>يمكنك تسجيل الدخول إلى حسابك في درب للدراسة باستخدام الرابط أدناه:</p>
          <div style="text-align: center;">
            <a href="${magic_link_url}" class="button">تسجيل الدخول الآن</a>
          </div>
          <p><strong>ملاحظة:</strong> هذا الرابط صالح لمدة 60 دقيقة فقط لأغراض الأمان.</p>
          <p>إذا لم تطلب هذا الرابط، يرجى تجاهل هذا البريد.</p>
          <p>مع أطيب التحيات،<br>فريق درب للدراسة</p>
        `);
        textContent = `رابط تسجيل الدخول السريع: ${magic_link_url}`;
        break;

      default:
        subject = 'رسالة من درب للدراسة | Message from Darb Study';
        htmlContent = baseTemplate(`
          <h2>مرحباً ${user_name || 'عزيزي المستخدم'}!</h2>
          <p>شكراً لك على استخدام خدمات درب للدراسة.</p>
          <p>نحن هنا لمساعدتك في رحلتك التعليمية.</p>
          <p>مع أطيب التحيات،<br>فريق درب للدراسة</p>
        `);
        textContent = `رسالة من درب للدراسة`;
    }

    const emailResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: [user_email],
      subject: subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID(),
      }
    });

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      return new Response(JSON.stringify({ 
        error: `Email sending failed: ${JSON.stringify(emailResult.error)}`,
        success: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Branded email sent successfully",
      emailId: emailResult.data?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Email function error:', error);
    return new Response(JSON.stringify({ 
      error: `Server error: ${error.message}`,
      success: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
