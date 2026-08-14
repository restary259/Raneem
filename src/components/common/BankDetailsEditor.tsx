import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

/**
 * Payout-bank beneficiary editor. Reads/writes the shared profiles bank columns
 * (bank_name, bank_branch, bank_account_number, iban, iban_confirmed_at) that
 * every payout-earning role uses. The restrict_profiles_write trigger blocks
 * non-admins from changing bank fields once iban_confirmed_at is set.
 */
export default function BankDetailsEditor({ userId }: { userId: string }) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [account, setAccount] = useState("");
  const [iban, setIban] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("bank_name, bank_branch, bank_account_number, iban, iban_confirmed_at")
        .eq("id", userId)
        .maybeSingle();
      if (data) {
        setBankName(data.bank_name ?? "");
        setBranch(data.bank_branch ?? "");
        setAccount(data.bank_account_number ?? "");
        setIban(data.iban ?? "");
        setConfirmedAt(data.iban_confirmed_at ?? null);
      }
    })();
  }, [userId]);

  const locked = !!confirmedAt;

  const save = async () => {
    if (!bankName.trim()) {
      toast({ variant: "destructive", description: t("influencer.earnings.bankNameRequired") });
      return;
    }
    if (branch && !/^\d{2,4}$/.test(branch.trim())) {
      toast({ variant: "destructive", description: t("influencer.earnings.invalidBranch") });
      return;
    }
    if (account && !/^\d{4,12}$/.test(account.trim())) {
      toast({ variant: "destructive", description: t("influencer.earnings.invalidAccount") });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        bank_name: bankName.trim() || null,
        bank_branch: branch.trim() || null,
        bank_account_number: account.trim() || null,
        iban: iban.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.error"), description: error.message });
      return;
    }
    toast({ description: t("influencer.earnings.bankSaved") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          {t("influencer.earnings.bankModalTitle", "Bank Account Details")}
          {locked && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("influencer.earnings.editBankDetails", "Confirmed")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked && (
          <p className="text-xs text-muted-foreground">
            {t("agent.bankLocked", "Bank details are confirmed and can only be changed by an admin.")}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="bd-name">{t("influencer.earnings.bankName", "Bank Name")}</Label>
          <Input id="bd-name" value={bankName} disabled={locked} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bd-branch">{t("influencer.earnings.bankBranch", "Branch Number")}</Label>
            <Input id="bd-branch" value={branch} disabled={locked} onChange={(e) => setBranch(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd-account">{t("influencer.earnings.bankAccount", "Account Number")}</Label>
            <Input id="bd-account" value={account} disabled={locked} onChange={(e) => setAccount(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd-iban">{t("influencer.earnings.bankIban", "IBAN (optional)")}</Label>
          <Input id="bd-iban" value={iban} disabled={locked} onChange={(e) => setIban(e.target.value)} dir="ltr" />
          <p className="text-xs text-muted-foreground">{t("influencer.earnings.bankIbanHint")}</p>
        </div>
        <Button onClick={save} disabled={saving || locked} className="w-full sm:w-auto">
          {saving ? t("common.saving") : t("influencer.earnings.bankSaveBtn", "Save")}
        </Button>
      </CardContent>
    </Card>
  );
}
