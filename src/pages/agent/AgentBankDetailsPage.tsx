import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Building2, CheckCircle2, Landmark, Globe, Loader2, Info } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

type BankCountry = "il" | "de";

interface BankData {
  bank_country: BankCountry;
  bank_name: string;
  bank_branch: string;
  bank_account_number: string;
  iban: string;
  bic: string;
  iban_confirmed_at: string | null;
}

const EMPTY: BankData = {
  bank_country: "il",
  bank_name: "",
  bank_branch: "",
  bank_account_number: "",
  iban: "",
  bic: "",
  iban_confirmed_at: null,
};

/** Bank-details page. The agent chooses between an Israeli or German bank
 *  account; the UI renders the matching fields. Once `iban_confirmed_at` is
 *  set (by an admin), all inputs disable — enforced by restrict_profiles_write. */
export default function AgentBankDetailsPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<BankData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data: row } = await (supabase as any)
        .from("profiles")
        .select("bank_country, bank_name, bank_branch, bank_account_number, iban, bic, iban_confirmed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (row) {
        setData({
          bank_country: (row.bank_country as BankCountry) ?? "il",
          bank_name: row.bank_name ?? "",
          bank_branch: row.bank_branch ?? "",
          bank_account_number: row.bank_account_number ?? "",
          iban: row.iban ?? "",
          bic: row.bic ?? "",
          iban_confirmed_at: row.iban_confirmed_at ?? null,
        });
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const locked = !!data.iban_confirmed_at;

  const update = (field: keyof BankData, value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  const save = async () => {
    if (!user) return;
    // Validation per country
    if (data.bank_country === "il") {
      if (!data.bank_name.trim()) {
        toast({ variant: "destructive", description: t("agent.bank.errBankName", "Bank name is required") });
        return;
      }
      if (data.bank_branch && !/^\d{2,4}$/.test(data.bank_branch.trim())) {
        toast({ variant: "destructive", description: t("agent.bank.errBranch", "Branch must be 2-4 digits") });
        return;
      }
      if (data.bank_account_number && !/^\d{4,12}$/.test(data.bank_account_number.trim())) {
        toast({ variant: "destructive", description: t("agent.bank.errAccount", "Account number must be 4-12 digits") });
        return;
      }
    } else {
      if (data.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(data.iban.replace(/\s/g, "").toUpperCase())) {
        toast({ variant: "destructive", description: t("agent.bank.errIban", "Enter a valid IBAN") });
        return;
      }
      if (!data.bank_name.trim() && !data.iban.trim()) {
        toast({ variant: "destructive", description: t("agent.bank.errIbanRequired", "IBAN or bank name is required") });
        return;
      }
    }

    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        bank_country: data.bank_country,
        bank_name: data.bank_name.trim() || null,
        bank_branch: data.bank_country === "il" ? (data.bank_branch.trim() || null) : null,
        bank_account_number: data.bank_country === "il" ? (data.bank_account_number.trim() || null) : null,
        iban: data.bank_country === "de" ? (data.iban.replace(/\s/g, "").toUpperCase() || null) : (data.iban.trim() || null),
        bic: data.bank_country === "de" ? (data.bic.trim().toUpperCase() || null) : null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.error", "Error"), description: error.message });
      return;
    }
    toast({ description: t("agent.bank.saved", "Bank details saved") });
  };

  if (loading || !user) return <DashboardLoading />;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6" dir={dir}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t("agent.bank.title", "Bank Details")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.bank.subtitle", "Secure financial information for receiving your commission payouts.")}
        </p>
      </div>

      {/* Country selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {t("agent.bank.country", "Bank account location")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <CountryCard
              active={data.bank_country === "il"}
              onClick={() => !locked && update("bank_country", "il")}
              icon={Landmark}
              title={t("agent.bank.israel", "Israeli account")}
              desc="₪ ILS"
              disabled={locked}
            />
            <CountryCard
              active={data.bank_country === "de"}
              onClick={() => !locked && update("bank_country", "de")}
              icon={Building2}
              title={t("agent.bank.germany", "German account")}
              desc="€ EUR"
              disabled={locked}
            />
          </div>
          {locked && (
            <p className="text-xs text-muted-foreground mt-3">
              {t("agent.bank.lockedHint", "Bank details are confirmed and can only be changed by an admin.")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dynamic fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {data.bank_country === "il"
              ? t("agent.bank.ilFields", "Israeli bank details")
              : t("agent.bank.deFields", "German bank details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.bank_country === "il" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bd-name">{t("agent.bank.bankName", "Bank name")}</Label>
                <Input id="bd-name" value={data.bank_name} disabled={locked} onChange={(e) => update("bank_name", e.target.value)} placeholder={t("agent.bank.bankNamePlaceholder", "e.g. Bank Hapoalim")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bd-branch">{t("agent.bank.branch", "Branch number")}</Label>
                  <Input id="bd-branch" value={data.bank_branch} disabled={locked} onChange={(e) => update("bank_branch", e.target.value)} dir="ltr" placeholder="e.g. 123" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bd-account">{t("agent.bank.account", "Account number")}</Label>
                  <Input id="bd-account" value={data.bank_account_number} disabled={locked} onChange={(e) => update("bank_account_number", e.target.value)} dir="ltr" placeholder="e.g. 456789" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bd-iban-il">{t("agent.bank.ibanOptional", "IBAN (optional)")}</Label>
                <Input id="bd-iban-il" value={data.iban} disabled={locked} onChange={(e) => update("iban", e.target.value)} dir="ltr" placeholder="IL62 0108 0000 0009 9999 999" />
                <p className="text-xs text-muted-foreground">{t("agent.bank.ibanHint", "Providing an IBAN speeds up international transfers.")}</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bd-iban-de">{t("agent.bank.iban", "IBAN")}</Label>
                <Input id="bd-iban-de" value={data.iban} disabled={locked} onChange={(e) => update("iban", e.target.value)} dir="ltr" placeholder="DE89 3704 0044 0532 0130 00" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bd-bic">{t("agent.bank.bic", "BIC / SWIFT (optional)")}</Label>
                <Input id="bd-bic" value={data.bic} disabled={locked} onChange={(e) => update("bic", e.target.value)} dir="ltr" placeholder="COBADEFFXXX" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bd-name-de">{t("agent.bank.bankName", "Bank name")}</Label>
                <Input id="bd-name-de" value={data.bank_name} disabled={locked} onChange={(e) => update("bank_name", e.target.value)} placeholder={t("agent.bank.bankNamePlaceholderDe", "e.g. Commerzbank")} />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/30 p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{t("agent.bank.deHint", "German IBANs start with DE and are 22 characters long.")}</span>
              </div>
            </>
          )}

          <Button onClick={save} disabled={saving || locked} className="w-full sm:w-auto gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? t("common.saving", "Saving...") : t("agent.bank.save", "Save bank details")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CountryCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all ${
        disabled ? "border-border opacity-60 cursor-not-allowed" :
        active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
