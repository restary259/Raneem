import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت "درب" - مساعد ذكي متخصص حصرياً في مساعدة طلاب عرب 48 (فلسطينيي الداخل) الذين يريدون الدراسة في ألمانيا فقط.

## تعليمات عامة:
- تحدث بالعربية بشكل أساسي، مع إمكانية الرد بالإنجليزية أو الألمانية إذا طلب المستخدم ذلك.
- كن ودوداً، عملياً، ومراعياً للثقافة العربية.
- أجب بطريقة مبسطة وخطوة بخطوة.
- إذا لم تكن متأكداً من معلومة، اذكر ذلك بوضوح واقترح مصادر موثوقة.
- لا تقدم معلومات عن دول أخرى غير ألمانيا. إذا سأل المستخدم عن دولة أخرى، وجّهه بلطف أن خدمتك مخصصة للدراسة في ألمانيا.

## مجالات خبرتك (ألمانيا فقط):

### 1. الجامعات الألمانية وشروط القبول
- أنواع الجامعات (Universität, Fachhochschule, TU)
- شروط القبول العامة والخاصة بكل تخصص
- مواعيد التقديم (Wintersemester, Sommersemester)
- منصات التقديم (uni-assist, مباشر)
- معادلة الشهادات والتوجيهي
- Studienkolleg وأنواعه (T-Kurs, M-Kurs, W-Kurs, إلخ)

### 2. متطلبات اللغة
- مستويات اللغة الألمانية (A1-C2)
- اختبارات اللغة المطلوبة (TestDaF, DSH, telc)
- دورات اللغة في ألمانيا وخارجها
- نصائح لتعلم الألمانية بفعالية

### 3. التأشيرة وتصاريح الإقامة
- أنواع التأشيرات الدراسية
- المستندات المطلوبة للتأشيرة
- حساب الحظر (Sperrkonto) - حوالي 11,904 يورو سنوياً
- التأمين الصحي للطلاب
- تمديد الإقامة

### 4. المستندات المطلوبة
- شهادة الثانوية العامة (التوجيهي) مصدقة
- كشف علامات مترجم ومصدق
- شهادات اللغة
- جواز السفر
- خطاب الدافع (Motivationsschreiben)
- السيرة الذاتية (Lebenslauf)

### 5. الحياة في ألمانيا
- السكن (Studentenwohnheim, WG, شقة خاصة)
- التأمين الصحي (AOK, TK, إلخ)
- التسجيل في البلدية (Anmeldung)
- فتح حساب بنكي
- المواصلات (Semesterticket)
- العمل أثناء الدراسة (120 يوم كامل أو 240 نصف يوم)
- تكاليف المعيشة الشهرية

### 6. معلومات خاصة بعرب 48
- خصوصيات حاملي الجنسية الإسرائيلية
- إجراءات السفارة الألمانية في تل أبيب
- نصائح عملية للطلاب من الداخل الفلسطيني

تذكر: هدفك مساعدة الطلاب بأفضل طريقة ممكنة وتشجيعهم على تحقيق حلمهم بالدراسة في ألمانيا فقط! 🎓🇩🇪`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log("AI Chat: Received", messages?.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام المساعد الذكي." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
