import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Clock, Send, Lock, History } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import {
  getMyPayoutPreview,
  requestPayoutViaChat,
  type PayoutPreview,
} from "@/services/PayoutRequestService";
import { useEarningsSummary } from "@/hooks/useEarningsSummary";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Agent earnings: locked/available/paid buckets derived server-side from the
 *  agent's own agent_override rewards, plus the 20-day lock and the chat payout
 *  request. Reuses the exact same RPCs as partners/ambassadors/team. */
export default function AgentEarningsPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { toast } = useToast();
  const { summary: earnings } = useEarningsSummary(true);
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setPreview(await getMyPayoutPreview());
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const requestPayout = async () => {
    setSubmitting(true);
    try {
      const res = await requestPayoutViaChat();
      toast({ title: t("influencer.earnings.requestSubmitted", "Request submitted!"), description: fmt(res.amount) });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLoading />;

  const available = Number(earnings?.available ?? preview?.eligible_amount ?? 0);
  const locked = Number(earnings?.locked ?? preview?.locked_amount ?? 0);
  const requested = Number(earnings?.requested ?? 0);
  const paid = Number(earnings?.paid ?? 0);
  const hasOpen = preview?.has_open_request || requested > 0;

  const buckets = [
    { label: t("influencer.earnings.available", "Available"), value: available, icon: Award, color: "text-emerald-600" },
    { label: t("influencer.earnings.locked", "Locked"), value: locked, icon: Lock, color: "text-amber-600" },
    { label: t("influencer.earnings.requested", "Requested"), value: requested, icon: Clock, color: "text-blue-600" },
    { label: t("influencer.earnings.paid", "Paid"), value: paid, icon: History, color: "text-teal-600" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold">{t("agent.earningsTitle", "Earnings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.earningsSubtitle", "Override commissions from your recruited partners & ambassadors.")}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {buckets.map((b) => (
          <Card key={b.label}>
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 bg-muted ${b.color}`}>
                <b.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold">{fmt(b.value)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{b.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {locked > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3">
          <Lock className="h-4 w-4" />
          {t("influencer.earnings.lockActive", "20-day lock active")}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("influencer.earnings.requestPayout", "Request a payout")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("influencer.earnings.waitingPeriod", "20-day waiting period not over yet")}
          </p>
          <Button
            onClick={requestPayout}
            disabled={submitting || available <= 0 || hasOpen}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? t("influencer.earnings.sending", "Sending...") : t("influencer.earnings.requestPayout", "Request payout")}
          </Button>
          {hasOpen && (
            <Badge variant="secondary" className="ms-2">
              {t("influencer.earnings.requestPending", "Request pending")}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
