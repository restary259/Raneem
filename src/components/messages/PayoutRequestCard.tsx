import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Banknote, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import AttachmentPreview from "@/components/messages/AttachmentPreview";
import type { ChatAttachment } from "@/lib/chatFormat";
import { formatILS } from "@/lib/money";
import {
  adminRespondPayoutRequest,
  getPayoutRequestDetail,
  type PayoutRequestDetail,
} from "@/services/PayoutRequestService";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-blue-100 text-blue-900",
  paid: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
};

interface Props {
  requestId: string;
  /** Admins get the review actions; everyone else sees the read-only card. */
  isAdmin: boolean;
  /** Route prefix for opening a case, e.g. `/admin/cases`. */
  caseLinkBase?: string;
  /** Files the partner attached to the request message. */
  attachments?: ChatAttachment[];
}

/**
 * Structured payout request rendered inside a chat message. The chat is only
 * the interface — every figure comes from `payout_requests` and the rewards
 * behind it, never from the message body.
 */
export default function PayoutRequestCard({
  requestId,
  isAdmin,
  caseLinkBase,
  attachments = [],
}: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [detail, setDetail] = useState<PayoutRequestDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");

  const load = async () => {
    try {
      setDetail(await getPayoutRequestDetail(requestId));
    } catch {
      setDetail(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const act = async (action: "approve" | "pay" | "reject") => {
    setBusy(true);
    try {
      await adminRespondPayoutRequest(requestId, action, note || undefined, ref || undefined);
      toast({ description: t(`chat.payout.done.${action}`) });
      setNote("");
      setRef("");
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("chat.payout.loading")}
      </div>
    );
  }

  const status = detail.status ?? "pending";

  return (
    <div className="min-w-[240px] space-y-2 rounded-xl border border-primary/25 bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Banknote className="h-4 w-4 text-primary" />
          {t("chat.payout.title")}
        </span>
        <Badge className={STATUS_STYLE[status] ?? ""}>{t(`chat.payout.status.${status}`, status)}</Badge>
      </div>

      {detail.payout_reference && (
        <div className="flex items-center gap-1.5">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" dir="ltr">
            {detail.payout_reference}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            aria-label={t("chat.payout.copyReference", "Copy reference")}
            onClick={() => {
              navigator.clipboard.writeText(detail.payout_reference as string);
              toast({ description: t("chat.payout.referenceCopied", "Reference copied") });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}


      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">{t("chat.payout.amount")}</p>
          <p className="font-semibold">{formatILS(detail.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("chat.payout.cases")}</p>
          <p className="font-semibold">{detail.cases.length}</p>
        </div>
        {isAdmin && (
          <div className="col-span-2">
            <p className="text-muted-foreground">{t("chat.payout.partner")}</p>
            <p className="font-semibold">{detail.partner_name ?? "—"}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {t("chat.payout.viewCases")}
        </Button>
        {detail.cases.length === 1 && detail.cases[0].case_id && caseLinkBase && (
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link to={`${caseLinkBase}/${detail.cases[0].case_id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t("chat.payout.openCase")}
            </Link>
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {t("chat.payout.title")}
              {detail.payout_reference && (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" dir="ltr">
                  {detail.payout_reference}
                </code>
              )}
            </DialogTitle>
            <DialogDescription>
              {formatILS(detail.amount)} · {t("chat.payout.cases")}: {detail.cases.length}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {detail.cases.map((c) => (
              <div
                key={c.reward_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.student_name || "—"}
                    {c.case_reference && (
                      <span className="ms-2 font-mono text-xs text-muted-foreground">
                        {c.case_reference}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("chat.payout.caseStatus")}: {c.case_status ?? "—"} ·{" "}
                    {t("chat.payout.eligibleAt")}:{" "}
                    {new Date(c.eligible_at).toLocaleDateString("en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{formatILS(c.amount)}</Badge>
                  <Badge className={STATUS_STYLE[c.reward_status] ?? ""}>
                    {t(`chat.payout.status.${c.reward_status}`, c.reward_status)}
                  </Badge>
                  {c.case_id && caseLinkBase && (
                    <Link
                      to={`${caseLinkBase}/${c.case_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("chat.payout.openCase")}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("chat.payout.attachments")}
            </p>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("chat.payout.noAttachments")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <AttachmentPreview key={att.path} att={att} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
            <div>
              <p className="text-muted-foreground">{t("chat.payout.requestedAt")}</p>
              <p className="font-medium">
                {detail.requested_at
                  ? new Date(detail.requested_at).toLocaleDateString("en-US")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("chat.payout.approvedAt")}</p>
              <p className="font-medium">
                {detail.approved_at ? new Date(detail.approved_at).toLocaleDateString("en-US") : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("chat.payout.paidAt")}</p>
              <p className="font-medium">
                {detail.paid_at ? new Date(detail.paid_at).toLocaleDateString("en-US") : "—"}
              </p>
            </div>
          </div>

          {isAdmin && status !== "paid" && (
            <div className="space-y-2 border-t pt-3">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("chat.payout.notePlaceholder")}
              />
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder={t("chat.payout.refPlaceholder")}
                dir="ltr"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            {isAdmin && status === "pending" && (
              <Button variant="outline" disabled={busy} onClick={() => act("approve")}>
                {t("chat.payout.approve")}
              </Button>
            )}
            {isAdmin && status !== "paid" && status !== "rejected" && (
              <Button disabled={busy} onClick={() => setConfirmPay(true)}>
                {busy && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {t("chat.payout.markPaid")}
              </Button>
            )}
            {isAdmin && status !== "paid" && status !== "rejected" && (
              <Button variant="destructive" disabled={busy} onClick={() => act("reject")}>
                {t("chat.payout.reject")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmPay} onOpenChange={setConfirmPay}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("chat.payout.confirmPayTitle")}</DialogTitle>
            <DialogDescription>
              {t("chat.payout.confirmPayBody", {
                amount: formatILS(detail.amount),
                partner: detail.partner_name ?? "—",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmPay(false)}>
              {t("chat.payout.cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await act("pay");
                setConfirmPay(false);
              }}
            >
              {busy && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
              {t("chat.payout.confirmPayAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
