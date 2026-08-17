import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Gift, Users, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ReferralFormProps {
  userId: string;
}

export type ReferralType = "friend" | "family";

const ReferralForm: React.FC<ReferralFormProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(500);
  const [referralType, setReferralType] = useState<ReferralType>("friend");
  const [form, setForm] = useState({ referred_name: "", referred_phone: "" });

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    let active = true;
    // platform_settings RLS is staff/partner only, so the amount comes from a
    // SECURITY DEFINER RPC that exposes just this one value to students. The
    // type-aware RPC lets a friend and a family referral carry different
    // discounts.
    (supabase as any)
      .rpc("get_student_referral_discount_by_type", { p_referral_type: referralType })
      .then(({ data }: any) => {
        if (!active) return;
        const amount = Number(data ?? 0);
        if (Number.isFinite(amount) && amount > 0) setDiscountAmount(amount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [referralType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ variant: "destructive", title: t("referrals.termsError") });
      return;
    }
    if (!form.referred_name.trim()) {
      toast({ variant: "destructive", description: t("referrals.nameRequired", "Name is required") });
      return;
    }
    const phoneRegex = /^\+?\d{7,15}$/;
    if (!phoneRegex.test(form.referred_phone.replace(/[\s\-()]/g, ""))) {
      toast({ variant: "destructive", description: t("referrals.phoneErrorDesc") });
      return;
    }

    // Duplicate check
    const { data: existing } = await (supabase as any)
      .from("referrals")
      .select("id")
      .eq("referred_phone", form.referred_phone.trim())
      .eq("referrer_user_id", userId);

    if (existing?.length) {
      toast({ variant: "destructive", title: t("referrals.duplicateError") });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Insert referral record (with referral_type for the student reward)
      const { data: referralData, error: refErr } = await (supabase as any)
        .from("referrals")
        .insert({
          referrer_user_id: userId,
          referred_name: form.referred_name.trim(),
          referred_phone: form.referred_phone.trim(),
          discount_applied: false,
          referral_type: referralType,
        })
        .select()
        .single();

      if (refErr) throw refErr;

      // 2. Create case tagged as referral (discount amount is server-derived)
      try {
        await supabase.functions.invoke("create-case-from-apply", {
          body: {
            full_name: form.referred_name.trim(),
            phone_number: form.referred_phone.trim(),
            source: "referral",
            referrer_user_id: userId,
            referral_id: referralData?.id ?? null,
            referral_type: referralType,
          },
        });
      } catch (caseErr) {
        console.warn("Auto-case creation failed (non-blocking):", caseErr);
      }

      toast({ title: t("referrals.success") });
      setForm({ referred_name: "", referred_phone: "" });
      setTermsAccepted(false);
      setReferralType("friend");
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Discount banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {t(
            "student.refer.discount_message",
            "Referring a friend or family member will give them a {{amount}} shekel discount on their registration.",
            { amount: discountAmount.toLocaleString("en-US") },
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t("referrals.title", "Refer a Friend or Family Member")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Referral type selector (friend / family) — drives the reward type */}
            <div className="space-y-2">
              <Label>{t("referrals.typeLabel", "Who are you referring?")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["friend", "family"] as const).map((type) => {
                  const Icon = type === "friend" ? Users : Heart;
                  const selected = referralType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReferralType(type)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-start text-sm transition-all ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">
                        {t(`referrals.type_${type}`, type === "friend" ? "Friend" : "Family")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referred_name">{t("referrals.firstName", "Full Name")} *</Label>
              <Input
                id="referred_name"
                value={form.referred_name}
                onChange={(e) => updateField("referred_name", e.target.value)}
                required
                placeholder={t("referrals.namePlaceholder", "Friend's full name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referred_phone">{t("referrals.phone", "Phone (with country code)")} *</Label>
              <Input
                id="referred_phone"
                type="tel"
                value={form.referred_phone}
                onChange={(e) => updateField("referred_phone", e.target.value)}
                required
                placeholder="+972 52 XXX XXXX"
                dir="ltr"
              />
            </div>
            <div className="flex items-start gap-2 pt-2">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                {t("referrals.termsLabel", "I confirm all information is correct and agree to the terms.")}
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <UserPlus className="h-4 w-4 me-2" />}
              {t("referrals.submit", "Submit Referral")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralForm;
