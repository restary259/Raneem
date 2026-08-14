import { useTranslation } from "react-i18next";
import { Copy, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { type BankDetailsPayload } from "@/lib/chatFormat";

interface Props {
  details: BankDetailsPayload;
}

/**
 * Rich card rendered inside a chat bubble when a message body carries the
 * `::bank-details::` marker. Per-field copy buttons + a "copy all" button.
 */
export default function BankDetailsCard({ details }: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const fields: { key: string; label: string; value: string; mono?: boolean }[] = [
    { key: "bankName", label: t("chat.bankShare.bankName", "Bank name"), value: details.bankName },
    { key: "branch", label: t("chat.bankShare.branch", "Branch number"), value: details.bankBranch },
    { key: "account", label: t("chat.bankShare.account", "Account number"), value: details.bankAccount, mono: true },
    { key: "iban", label: t("chat.bankShare.iban", "IBAN"), value: details.iban, mono: true },
    { key: "bic", label: t("chat.bankShare.bic", "BIC / SWIFT"), value: details.bic, mono: true },
    { key: "country", label: t("chat.bankShare.country", "Country"), value: details.bankCountry },
  ];

  const humanBlock = fields
    .map((f) => `${f.label}: ${f.value || "—"}`)
    .join("\n");

  const copy = (text: string, msg = t("chat.bankShare.copied", "Copied")) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ description: msg }),
      () => toast({ variant: "destructive", description: t("chat.bankShare.copied", "Copied") }),
    );
  };

  return (
    <div className="min-w-[240px] space-y-2 rounded-xl border border-primary/25 bg-background/70 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Landmark className="h-4 w-4 text-primary" />
        {t("chat.bankShare.title", "Bank details")}
      </div>

      <div className="space-y-1.5 text-sm">
        {fields.map((f) => (
          <div key={f.key} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p
                className="break-all font-medium"
                dir={f.mono ? "ltr" : undefined}
                style={f.mono ? { fontFamily: "monospace" } : undefined}
              >
                {f.value || "—"}
              </p>
            </div>
            {f.value && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                aria-label={t("chat.bankShare.copyAll", "Copy all")}
                onClick={() => copy(f.value)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="w-full" onClick={() => copy(humanBlock, t("chat.bankShare.copiedAll", "All bank details copied"))}>
        <Copy className="me-1.5 h-3.5 w-3.5" />
        {t("chat.bankShare.copyAll", "Copy all")}
      </Button>
    </div>
  );
}
