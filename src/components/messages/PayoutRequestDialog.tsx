import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatILS } from "@/lib/money";
import type { PayoutPreview } from "@/services/PayoutRequestService";

interface Props {
  open: boolean;
  preview: PayoutPreview | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Review step before a partner sends a payout request into the admin chat.
 * Every figure comes from `get_my_payout_preview`; nothing is typed by hand.
 */
export default function PayoutRequestDialog({
  open,
  preview,
  submitting,
  onOpenChange,
  onConfirm,
}: Props) {
  const { t } = useTranslation("dashboard");
  const eligible = preview?.eligible_amount ?? 0;
  const canSend = !!preview && eligible > 0 && !preview.has_open_request;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("chat.payout.request")}</DialogTitle>
          <DialogDescription>{t("chat.payout.reviewHint")}</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t("chat.payout.eligible")}</p>
                <p className="text-lg font-semibold">{formatILS(eligible)}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.eligible_count} {t("chat.payout.cases")}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t("chat.payout.locked")}</p>
                <p className="text-lg font-semibold">{formatILS(preview.locked_amount)}</p>
                {preview.next_unlock_at && (
                  <p className="text-xs text-muted-foreground">
                    {t("chat.payout.nextUnlock")}:{" "}
                    {new Date(preview.next_unlock_at).toLocaleDateString("en-US")}
                  </p>
                )}
              </div>
            </div>

            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {preview.cases.map((c) => (
                <li
                  key={c.reward_id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {c.student_name || "—"}
                    {c.case_reference && (
                      <span className="ms-2 font-mono text-xs text-muted-foreground">
                        {c.case_reference}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium">{formatILS(c.amount)}</span>
                </li>
              ))}
            </ul>

            {preview.has_open_request && (
              <p className="text-xs text-amber-700">{t("chat.payout.openRequest")}</p>
            )}
            {eligible <= 0 && !preview.has_open_request && (
              <p className="text-xs text-muted-foreground">{t("chat.payout.noneEligible")}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("chat.edit.cancel")}
          </Button>
          <Button disabled={!canSend || submitting} onClick={onConfirm}>
            {submitting && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {t("chat.payout.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
