
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'وكالة درب | Darb Agency <onboarding@resend.dev>';

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

    // Enhanced brand colors and styling to match the website
    const brandColors = {
      primary: '#2563eb',      // Blue
      secondary: '#f97316',    // Orange  
      background: '#f8fafc',   // Light gray
      text: '#1e293b',         // Dark gray
      accent: '#0ea5e9',       // Light blue
      success: '#10b981',      // Green
      warning: '#f59e0b'       // Amber
    };

    const baseTemplate = (content: string, isRTL = true) => `
      <!DOCTYPE html>
      <html lang="${isRTL ? 'ar' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>درب للدراسة | Darb Study</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'Arial Unicode MS';
              margin: 0; 
              padding: 20px; 
              background: linear-gradient(135deg, ${brandColors.primary}10, ${brandColors.secondary}10);
              color: ${brandColors.text};
              direction: ${isRTL ? 'rtl' : 'ltr'};
              line-height: 1.6;
            }
            .email-container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white; 
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
              border: 1px solid ${brandColors.primary}20;
            }
            .header { 
              background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary});
              padding: 40px 30px; 
              text-align: center; 
              color: white;
              position: relative;
            }
            .header::after {
              content: '';
              position: absolute;
              bottom: -10px;
              left: 50%;
              transform: translateX(-50%);
              width: 20px;
              height: 20px;
              background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary});
              transform: translateX(-50%) rotate(45deg);
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 10px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .tagline {
              font-size: 16px;
              opacity: 0.9;
              font-weight: 300;
            }
            .content { 
              padding: 50px 40px 40px;
              line-height: 1.8;
            }
            .welcome-title {
              font-size: 24px;
              font-weight: bold;
              color: ${brandColors.primary};
              margin-bottom: 20px;
              text-align: center;
            }
            .message-text {
              font-size: 16px;
              margin-bottom: 25px;
              color: ${brandColors.text};
            }
            .cta-container {
              text-align: center;
              margin: 35px 0;
            }
            .button { 
              background: linear-gradient(135deg, ${brandColors.primary}, ${brandColors.accent});
              color: white; 
              padding: 18px 35px; 
              text-decoration: none; 
              border-radius: 50px; 
              display: inline-block; 
              font-weight: bold;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
              border: none;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
            }
            .features-list {
              background: ${brandColors.background};
              padding: 25px;
              border-radius: 12px;
              margin: 25px 0;
              border-left: 4px solid ${brandColors.secondary};
            }
            .features-list h3 {
              color: ${brandColors.primary};
              margin-bottom: 15px;
              font-size: 18px;
            }
            .features-list ul {
              list-style: none;
              padding: 0;
            }
            .features-list li {
              padding: 8px 0;
              padding-right: 25px;
              position: relative;
            }
            .features-list li::before {
              content: '✓';
              position: absolute;
              right: 0;
              color: ${brandColors.success};
              font-weight: bold;
              font-size: 16px;
            }
            .security-notice {
              background: linear-gradient(135deg, ${brandColors.warning}15, ${brandColors.warning}05);
              padding: 20px;
              border-radius: 10px;
              margin: 25px 0;
              border: 1px solid ${brandColors.warning}30;
            }
            .security-notice strong {
              color: ${brandColors.warning};
            }
            .footer { 
              background: ${brandColors.background}; 
              padding: 30px 20px; 
              text-align: center; 
              border-top: 1px solid ${brandColors.primary}20;
            }
            .footer-logo {
              font-size: 18px;
              font-weight: bold;
              color: ${brandColors.primary};
              margin-bottom: 10px;
            }
            .footer-text {
              font-size: 14px; 
              color: ${brandColors.text}80;
              margin-bottom: 15px;
            }
            .social-links {
              margin-top: 20px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: ${brandColors.primary};
              text-decoration: none;
              font-size: 14px;
            }
            .divider {
              height: 2px;
              background: linear-gradient(90deg, transparent, ${brandColors.primary}, transparent);
              margin: 30px 0;
            }
            @media (max-width: 600px) {
              .email-container {
                margin: 10px;
                border-radius: 12px;
              }
              .content {
                padding: 30px 25px;
              }
              .header {
                padding: 30px 20px;
              }
              .logo {
                font-size: 24px;
              }
              .button {
                padding: 15px 25px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">درب للدراسة | Darb Study</div>
              <div class="tagline">Your Gateway to Global Education Excellence</div>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <div class="footer-logo">درب للدراسة</div>
              <div class="footer-text">
                مؤسسة درب للاستشارات التعليمية<br>
                Educational Consultancy & Services
              </div>
              <div class="divider"></div>
              <div class="footer-text">
                © 2024 Darb Study. All rights reserved.<br>
                جميع الحقوق محفوظة لمؤسسة درب للدراسة
              </div>
              <div class="social-links">
                <a href="#">الموقع الإلكتروني</a> | 
                <a href="#">تواصل معنا</a> | 
                <a href="#">خدماتنا</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    switch (email_type) {
      case 'signup_confirmation':
        subject = 'مرحباً بك في درب للدراسة - تأكيد الحساب | Welcome to Darb Study';
        htmlContent = baseTemplate(`
          <div class="welcome-title">أهلاً وسهلاً ${user_name || 'عزيزي الطالب'}! 🎓</div>
          
          <div class="message-text">
            نرحب بك في <strong>درب للدراسة</strong> - بوابتك المتميزة للتعليم العالمي! 
            نحن سعداء لانضمامك إلى عائلتنا من الطلاب المتميزين.
          </div>
          
          <div class="message-text">
            لتفعيل حسابك والبدء في رحلتك التعليمية المثيرة، يرجى النقر على الزر أدناه:
          </div>
          
          <div class="cta-container">
            <a href="${confirmation_url}" class="button">🚀 تفعيل الحساب الآن</a>
          </div>
          
          <div class="features-list">
            <h3>🌟 ما يمكنك فعله بعد تفعيل حسابك:</h3>
            <ul>
              <li>إدارة طلبات القبول الجامعي بسهولة</li>
              <li>متابعة حالة التأشيرة خطوة بخطوة</li>
              <li>الوصول إلى استشاراتنا التعليمية المتخصصة</li>
              <li>التواصل المباشر مع فريق الدعم المتميز</li>
              <li>الحصول على تحديثات حصرية عن الفرص التعليمية</li>
            </ul>
          </div>
          
          <div class="security-notice">
            <strong>ملاحظة أمنية:</strong> إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذا البريد الإلكتروني بأمان.
          </div>
          
          <div class="divider"></div>
          
          <div class="message-text" style="text-align: center; font-style: italic;">
            نتطلع لمساعدتك في تحقيق أحلامك التعليمية! 🌟<br>
            <strong>فريق درب للدراسة</strong>
          </div>
        `);
        textContent = `مرحباً ${user_name || 'عزيزي الطالب'}! نرحب بك في درب للدراسة. لتفعيل حسابك، يرجى زيارة: ${confirmation_url}`;
        break;

      case 'password_reset':
        subject = 'إعادة تعيين كلمة المرور - درب للدراسة | Password Reset';
        htmlContent = baseTemplate(`
          <div class="welcome-title">🔐 طلب إعادة تعيين كلمة المرور</div>
          
          <div class="message-text">
            مرحباً <strong>${user_name || 'عزيزي المستخدم'}</strong>,
          </div>
          
          <div class="message-text">
            تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في منصة درب للدراسة. 
            لا تقلق، هذا أمر شائع ويمكننا مساعدتك بسهولة!
          </div>
          
          <div class="cta-container">
            <a href="${password_reset_url}" class="button">🔑 إعادة تعيين كلمة المرور</a>
          </div>
          
          <div class="security-notice">
            <strong>⚠️ مهم جداً:</strong> 
            <ul style="margin-top: 10px; padding-right: 20px;">
              <li>هذا الرابط صالح لمدة <strong>24 ساعة فقط</strong> لأغراض الأمان</li>
              <li>لا تشارك هذا الرابط مع أي شخص آخر</li>
              <li>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد</li>
            </ul>
          </div>
          
          <div class="message-text">
            إذا واجهت أي مشاكل أو لم تطلب هذا التغيير، يرجى التواصل معنا فوراً عبر فريق الدعم.
          </div>
          
          <div class="divider"></div>
          
          <div class="message-text" style="text-align: center;">
            مع أطيب التحيات،<br>
            <strong>فريق الأمان - درب للدراسة</strong> 🛡️
          </div>
        `);
        textContent = `طلب إعادة تعيين كلمة المرور. يرجى زيارة: ${password_reset_url}`;
        break;

      case 'magic_link':
        subject = 'رابط تسجيل الدخول السريع - درب للدراسة | Magic Login Link';
        htmlContent = baseTemplate(`
          <div class="welcome-title">⚡ رابط تسجيل الدخول السريع</div>
          
          <div class="message-text">
            مرحباً <strong>${user_name || 'عزيزي المستخدم'}</strong>,
          </div>
          
          <div class="message-text">
            يمكنك تسجيل الدخول إلى حسابك في منصة درب للدراسة بنقرة واحدة باستخدام الرابط السحري أدناه:
          </div>
          
          <div class="cta-container">
            <a href="${magic_link_url}" class="button">🎯 تسجيل الدخول الآن</a>
          </div>
          
          <div class="security-notice">
            <strong>⏰ ملاحظة أمنية:</strong> هذا الرابط صالح لمدة <strong>60 دقيقة فقط</strong> لضمان أمان حسابك.
          </div>
          
          <div class="message-text">
            إذا لم تطلب هذا الرابط، يمكنك تجاهل هذا البريد الإلكتروني بأمان.
          </div>
          
          <div class="divider"></div>
          
          <div class="message-text" style="text-align: center;">
            مع أطيب التحيات،<br>
            <strong>فريق درب للدراسة</strong> 🌟
          </div>
        `);
        textContent = `رابط تسجيل الدخول السريع: ${magic_link_url}`;
        break;

      case 'team_credentials':
        subject = 'بيانات حسابك الجديد - درب للدراسة | Your New Account Credentials';
        htmlContent = baseTemplate(`
          <div class="welcome-title">🔑 مرحباً بك في فريق درب للدراسة!</div>
          
          <div class="message-text">
            مرحباً <strong>${user_name || 'عزيزي العضو'}</strong>,
          </div>
          
          <div class="message-text">
            تم إنشاء حسابك في منصة درب للدراسة. استخدم البيانات التالية لتسجيل الدخول:
          </div>
          
          <div class="features-list">
            <h3>🔐 بيانات تسجيل الدخول:</h3>
            <ul>
              <li><strong>البريد الإلكتروني:</strong> ${user_email}</li>
              <li><strong>كلمة المرور المؤقتة:</strong> ${requestBody.temp_password || '—'}</li>
            </ul>
          </div>
          
          <div class="security-notice">
            <strong>⚠️ مهم جداً:</strong>
            <ul style="margin-top: 10px; padding-right: 20px;">
              <li>يجب تغيير كلمة المرور فور تسجيل الدخول الأول</li>
              <li>لا تشارك هذه البيانات مع أي شخص</li>
              <li>احذف هذا البريد بعد تسجيل الدخول بنجاح</li>
            </ul>
          </div>
          
          <div class="divider"></div>
          
          <div class="message-text" style="text-align: center;">
            مع أطيب التحيات،<br>
            <strong>فريق درب للدراسة</strong> 🛡️
          </div>
        `, true);
        textContent = `بيانات حسابك: البريد: ${user_email} | كلمة المرور المؤقتة: ${requestBody.temp_password || '—'} — يرجى تغييرها فوراً`;
        break;

      case 'student_credentials':
        subject = 'بيانات حسابك الطلابي - درب للدراسة | Your Student Portal Credentials';
        htmlContent = baseTemplate(`
          <div class="welcome-title">🎓 مرحباً بك في بوابة الطالب!</div>
          <div class="message-text">مرحباً <strong>${user_name || 'عزيزي الطالب'}</strong>,</div>
          <div class="message-text">تم إنشاء حسابك في بوابة الطالب الخاصة بمنصة درب للدراسة. استخدم البيانات التالية لتسجيل الدخول:</div>
          <div class="features-list">
            <h3>🔐 بيانات تسجيل الدخول:</h3>
            <ul>
              <li><strong>البريد الإلكتروني:</strong> ${user_email}</li>
              <li><strong>كلمة المرور المؤقتة:</strong> ${requestBody.temp_password || '—'}</li>
            </ul>
          </div>
          <div class="cta-container">
            <a href="https://darb-agency.lovable.app/student-auth" class="button">🚀 تسجيل الدخول إلى بوابة الطالب</a>
          </div>
          <div class="features-list">
            <h3>🌟 ما يمكنك فعله في بوابة الطالب:</h3>
            <ul>
              <li>رفع المستندات المطلوبة</li>
              <li>متابعة حالة طلبك خطوة بخطوة</li>
              <li>التواصل مع فريق الدعم</li>
              <li>تتبع قائمة المتطلبات</li>
            </ul>
          </div>
          <div class="security-notice">
            <strong>⚠️ مهم جداً:</strong>
            <ul style="margin-top: 10px; padding-right: 20px;">
              <li>يجب تغيير كلمة المرور فور تسجيل الدخول الأول</li>
              <li>لا تشارك هذه البيانات مع أي شخص</li>
            </ul>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;">مع أطيب التحيات،<br><strong>فريق درب للدراسة</strong> 🛡️</div>
        `, true);
        textContent = `بيانات حسابك الطلابي: البريد: ${user_email} | كلمة المرور المؤقتة: ${requestBody.temp_password || '—'}`;
        break;

      case 'welcome':
        subject = 'مرحباً بك في درب للدراسة! | Welcome to Darb Study!';
        htmlContent = baseTemplate(`
          <div class="welcome-title">مرحباً بك في عائلة درب! 🎉</div>
          <div class="message-text">مرحباً <strong>${user_name || 'عزيزي الطالب'}</strong>,</div>
          <div class="message-text">تم إنشاء حسابك بنجاح في منصة درب للدراسة. يمكنك الآن الوصول إلى لوحة التحكم الخاصة بك ومتابعة رحلتك التعليمية.</div>
          <div class="features-list">
            <h3>🌟 ابدأ بالخطوات التالية:</h3>
            <ul>
              <li>أكمل ملفك الشخصي</li>
              <li>ارفع المستندات المطلوبة</li>
              <li>تابع قائمة المتطلبات</li>
            </ul>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;"><strong>فريق درب للدراسة</strong> 🌟</div>
        `);
        textContent = `مرحباً بك في درب للدراسة! تم إنشاء حسابك بنجاح.`;
        break;

      case 'status_change':
        const newStatus = requestBody.new_status || 'updated';
        const oldStatus = requestBody.old_status || '';
        subject = 'تحديث حالة طلبك - درب للدراسة | Application Status Update';
        htmlContent = baseTemplate(`
          <div class="welcome-title">📋 تحديث حالة الطلب</div>
          <div class="message-text">مرحباً <strong>${user_name || 'عزيزي الطالب'}</strong>,</div>
          <div class="message-text">تم تحديث حالة طلبك من <strong>${oldStatus}</strong> إلى <strong>${newStatus}</strong>.</div>
          <div class="cta-container">
            <a href="https://darb-agency.lovable.app/student-auth" class="button">📊 عرض لوحة التحكم</a>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;"><strong>فريق درب للدراسة</strong></div>
        `);
        textContent = `تم تحديث حالة طلبك إلى: ${newStatus}`;
        break;

      case 'referral_accepted':
        const referredName = requestBody.referred_name || 'صديقك';
        subject = 'تم قبول إحالتك! 🎉 | Referral Accepted!';
        htmlContent = baseTemplate(`
          <div class="welcome-title">🎉 تم قبول إحالتك!</div>
          <div class="message-text">مرحباً <strong>${user_name || 'عزيزي المستخدم'}</strong>,</div>
          <div class="message-text">يسعدنا إبلاغك أن إحالتك لـ <strong>${referredName}</strong> تم قبولها بنجاح!</div>
          <div class="features-list">
            <h3>🏆 مكافآتك:</h3>
            <ul>
              <li>تتم مراجعة مكافأتك وستُضاف لحسابك</li>
              <li>يمكنك متابعة حالة المكافآت من لوحة التحكم</li>
            </ul>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;"><strong>فريق درب للدراسة</strong> 🌟</div>
        `);
        textContent = `تم قبول إحالتك لـ ${referredName}!`;
        break;

      case 'weekly_digest':
        const d = requestBody.digest_data || {};
        subject = 'التقرير الأسبوعي - درب للدراسة | Weekly Digest';
        htmlContent = baseTemplate(`
          <div class="welcome-title">📊 التقرير الأسبوعي</div>
          <div class="message-text">مرحباً <strong>${user_name || 'مدير'}</strong>,</div>
          <div class="message-text">إليك ملخص أداء الأسبوع:</div>
          <div class="features-list">
            <h3>📈 إحصائيات الأسبوع:</h3>
            <ul>
              <li>عملاء جدد: ${d.newLeads || 0}</li>
              <li>ملفات جديدة: ${d.newCases || 0}</li>
              <li>طلاب جدد: ${d.newStudents || 0}</li>
              <li>إحالات جديدة: ${d.newReferrals || 0}</li>
              <li>إيرادات: ${d.weekRevenue || 0} €</li>
              <li>مدفوعات: ${d.paidCount || 0}</li>
            </ul>
          </div>
          <div class="cta-container">
            <a href="https://darb-agency.lovable.app/admin" class="button">📊 عرض لوحة الإدارة</a>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;"><strong>فريق درب للدراسة</strong></div>
        `, true);
        textContent = `التقرير الأسبوعي: ${d.newLeads || 0} عملاء, ${d.weekRevenue || 0}€ إيرادات`;
        break;

      default:
        subject = 'رسالة من درب للدراسة | Message from Darb Study';
        htmlContent = baseTemplate(`
          <div class="welcome-title">مرحباً ${user_name || 'عزيزي المستخدم'}! 👋</div>
          <div class="message-text">شكراً لك على استخدام خدمات درب للدراسة المتميزة.</div>
          <div class="message-text">نحن هنا لمساعدتك في كل خطوة من رحلتك التعليمية نحو النجاح والتميز.</div>
          <div class="features-list">
            <h3>🎯 خدماتنا المتميزة:</h3>
            <ul>
              <li>استشارات تعليمية متخصصة</li>
              <li>مساعدة في القبولات الجامعية</li>
              <li>خدمات التأشيرات الطلابية</li>
              <li>دعم مستمر طوال رحلتك الدراسية</li>
            </ul>
          </div>
          <div class="divider"></div>
          <div class="message-text" style="text-align: center;">مع أطيب التحيات،<br><strong>فريق درب للدراسة</strong> 🌟</div>
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
