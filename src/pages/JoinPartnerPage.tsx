import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useDirection } from "@/hooks/useDirection";
import SEOHead from "@/components/common/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Streamlined recruit signup for a recruiter's dedicated link (/join/MP-XXXX).
 * Attribution is resolved server-side from the code — it is never typed by the applicant.
 */
export default function JoinPartnerPage() {
  const { code = "" } = useParams();
  const { t } = useTranslation("partnership");
  const { dir } = useDirection();

  const [checking, setChecking] = useState(true);
  const [recruiter, setRecruiter] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    social_link: "",
    note: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any).rpc("resolve_recruit_code", { p_code: code });
      const row = Array.isArray(data) ? data[0] : null;
      if (!alive) return;
      setRecruiter(row?.valid ? row.recruiter_name : null);
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("submit_recruit_application", {
      p_code: code,
      p_full_name: form.full_name,
      p_email: form.email,
      p_phone: form.phone,
      p_city: form.city || null,
      p_social_link: form.social_link || null,
      p_note: form.note || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(t("join.submitError", "Something went wrong sending your application. Please try again."));
      return;
    }
    setDone(true);
  };

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recruiter) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" dir={dir}>
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
            <h1 className="text-xl font-bold">{t("join.invalidTitle", "رابط غير صالح")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("join.invalidBody", "هذا الرابط منتهي أو غير صحيح. يمكنك التقديم عبر صفحة الشراكة العامة.")}
            </p>
            <Button asChild variant="outline">
              <Link to="/partnership">{t("join.goPublic", "صفحة الشراكة")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-muted/30 py-10 px-4" dir={dir}>
      <SEOHead
        title={t("join.seoTitle", "انضم كوكيل مع دَرب")}
        description={t("join.seoDesc", "تسجيل سريع للوكلاء بدعوة من شريك رئيسي في دَرب.")}
      />
      <Card className="max-w-xl mx-auto shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <ShieldCheck className="h-4 w-4" />
            {t("join.invitedBy", "بدعوة من")} {recruiter}
          </div>
          <CardTitle className="text-2xl">{t("join.title", "انضم كوكيل")}</CardTitle>
          <CardDescription>
            {t("join.subtitle", "تسجيل سريع — تتم مراجعة الطلب من إدارة دَرب قبل تفعيل الحساب.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="font-semibold">{t("join.doneTitle", "تم استلام طلبك")}</p>
              <p className="text-sm text-muted-foreground">
                {t("join.doneBody", "سيتواصل معك فريق دَرب بعد المراجعة.")}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jp-name">{t("join.name", "الاسم الكامل")}</Label>
                  <Input id="jp-name" required maxLength={100} value={form.full_name} onChange={set("full_name")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jp-phone">{t("join.phone", "رقم الهاتف")}</Label>
                  <Input id="jp-phone" required maxLength={30} value={form.phone} onChange={set("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jp-email">{t("join.email", "البريد الإلكتروني")}</Label>
                  <Input id="jp-email" type="email" required value={form.email} onChange={set("email")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jp-city">{t("join.city", "المدينة")}</Label>
                  <Input id="jp-city" maxLength={80} value={form.city} onChange={set("city")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jp-social">{t("join.social", "رابط حساب التواصل الاجتماعي")}</Label>
                <Input id="jp-social" maxLength={300} value={form.social_link} onChange={set("social_link")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jp-note">{t("join.note", "نبذة قصيرة (اختياري)")}</Label>
                <Textarea id="jp-note" rows={3} maxLength={1000} value={form.note} onChange={set("note")} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("join.submit", "إرسال الطلب")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t("join.consent", "بإرسال الطلب أنت توافق على سياسة الخصوصية وشروط الاستخدام.")}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
