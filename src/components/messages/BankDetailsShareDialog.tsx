import { useTranslation } from "react-i18next";
import { Landmark, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hasBankDetails, type BankDetailsPayload } from "@/lib/chatFormat";

interface Props {
  open: boolean;
  details: BankDetailsPayload | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Preview step before a partner/ambassador/agent sends their saved bank details
 * into the admin chat. Fields come from the `profiles` row — nothing is typed.
 */
export default function BankDetailsShareDialog({
  open,
  details,
  submitting,
  onOpenChange,
  onConfirm,
}: Props) {
  const { t } = useTranslation("dashboard");
  const canSend = hasBankDetails(details);

  const fields: { key: string; label: string; value: string; mono?: boolean }[] = [
    { key: "bankName", label: t("chat.bankShare.bankName"), value: details?.bankName ?? "" },
    { key: "branch", label: t("chat.bankShare.branch"), value: details?.bankBranch ?? "" },
    { key: "account", label: t("chat.bankShare.account"), value: details?.bankAccount ?? "", mono: true },
    { key: "iban", label: t("chat.bankShare.iban"), value: details?.iban ?? "", mono: true },
    { key: "bic", label: t("chat.bankShare.bic"), value: details?.bic ?? "", mono: true },
    { key: "country", label: t("chat.bankShare.country"), value: details?.bankCountry ?? "" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {t("chat.bankShare.title")}
          </DialogTitle>
          <DialogDescription>{t("chat.bankShare.reviewHint")}</DialogDescription>
        </DialogHeader>

        {!details ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {fields.map((f) => (
                <div key={f.key} className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p
                    className="break-all font-medium"
                    dir={f.mono ? "ltr" : undefined}
                    style={f.mono ? { fontFamily: "monospace" } : undefined}
                  >
                    {f.value || "—"}
                  </p>
                </div>
              ))}
            </div>

            {!canSend && (
              <p className="text-xs text-amber-700">{t("chat.bankShare.empty")}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("chat.edit.cancel")}
          </Button>
          <Button disabled={!canSend || submitting} onClick={onConfirm}>
            {submitting && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {t("chat.bankShare.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
