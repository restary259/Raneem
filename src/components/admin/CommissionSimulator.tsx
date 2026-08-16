import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import {
  simulateCommission,
  type AcquisitionType,
} from "@/lib/commissionSimulator";

const fmtILS = (n: number) => `₪${Math.round(n).toLocaleString("en-US")}`;

const ACQ_OPTIONS: { value: AcquisitionType; labelKey: string; fallback: string }[] = [
  { value: "partner", labelKey: "commissionHub.simAcqPartner", fallback: "Partner / Ambassador referral" },
  { value: "agent_self", labelKey: "commissionHub.simAcqAgentSelf", fallback: "Agent self-referral" },
  { value: "student", labelKey: "commissionHub.simAcqStudent", fallback: "Student → Student referral" },
  { value: "direct", labelKey: "commissionHub.simAcqDirect", fallback: "Direct (no referrer)" },
];

interface NumberField {
  key: string;
  labelKey: string;
  fallback: string;
  value: number;
}

/**
 * Pure-frontend "what-if" commission calculator. No Supabase calls, no DB
 * writes — mirrors the ADDITIVE engine formula in commissionSimulator.ts so
 * admins can preview a case's commission split before configuring rates.
 */
const CommissionSimulator: React.FC<{ t: any }> = ({ t }) => {
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>("partner");
  const [grossTotal, setGrossTotal] = useState(5000);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [partnerPool, setPartnerPool] = useState(1000);
  const [masterShare, setMasterShare] = useState(0);
  const [agentShare, setAgentShare] = useState(500);
  const [teamRate, setTeamRate] = useState(100);
  const [studentReward, setStudentReward] = useState(200);

  const result = useMemo(
    () =>
      simulateCommission({
        acquisitionType,
        grossTotal,
        referralDiscount,
        partnerPool,
        masterShare,
        agentShare,
        teamRate,
        studentReward,
      }),
    [acquisitionType, grossTotal, referralDiscount, partnerPool, masterShare, agentShare, teamRate, studentReward],
  );

  const isPartner = acquisitionType === "partner";
  const isAgentSelf = acquisitionType === "agent_self";
  const isStudent = acquisitionType === "student";

  const fields: NumberField[] = [
    { key: "gross", labelKey: "commissionHub.simGross", fallback: "Gross service total", value: grossTotal },
    { key: "discount", labelKey: "commissionHub.simDiscount", fallback: "Referral discount", value: referralDiscount },
    { key: "team", labelKey: "commissionHub.simTeam", fallback: "Team commission (flat)", value: teamRate },
  ];
  if (isPartner) {
    fields.push(
      { key: "pool", labelKey: "commissionHub.simPool", fallback: "Partner pool", value: partnerPool },
      { key: "master", labelKey: "commissionHub.simMaster", fallback: "Master carve (from pool)", value: masterShare },
      { key: "agent", labelKey: "commissionHub.simAgent", fallback: "Agent override (additive)", value: agentShare },
    );
  }
  if (isAgentSelf) {
    fields.push({ key: "agentSelf", labelKey: "commissionHub.simAgentSelf", fallback: "Agent self-referral amount", value: agentShare });
  }
  if (isStudent) {
    fields.push({ key: "student", labelKey: "commissionHub.simStudentReward", fallback: "Student referrer reward", value: studentReward });
  }

  const setters: Record<string, (n: number) => void> = {
    gross: setGrossTotal,
    discount: setReferralDiscount,
    team: setTeamRate,
    pool: setPartnerPool,
    master: setMasterShare,
    agent: setAgentShare,
    agentSelf: setAgentShare,
    student: setStudentReward,
  };

  const rows: { label: string; value: number; emphasis?: boolean; muted?: boolean }[] = [
    { label: t("commissionHub.simNet", "NET (after discount)"), value: result.net, emphasis: true },
    { label: t("commissionHub.simTeamOut", "Team commission"), value: result.teamCommission },
  ];
  if (isPartner) {
    rows.push(
      { label: t("commissionHub.simPartnerShare", "Partner share (net of master)"), value: result.partnerShare },
      { label: t("commissionHub.simMasterOut", "Master carve"), value: result.masterShare, muted: true },
      { label: t("commissionHub.simAgentOut", "Agent override (additive)"), value: result.agentShare },
    );
  }
  if (isAgentSelf) {
    rows.push({ label: t("commissionHub.simAgentSelfOut", "Agent self-referral"), value: result.agentShare });
  }
  if (isStudent) {
    rows.push({ label: t("commissionHub.simStudentOut", "Student referrer reward"), value: result.studentReward });
  }
  rows.push({ label: t("commissionHub.simTotalPayouts", "Total payouts"), value: result.totalPayouts });
  rows.push({ label: t("commissionHub.simDarbMargin", "Darb margin (platform revenue)"), value: result.darbMargin, emphasis: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          {t("commissionHub.simTitle", "Commission simulator (what-if)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          {t(
            "commissionHub.simHint",
            "Pure preview — mirrors the additive engine. No data is written. Change the inputs to see how a case's commission split would be computed at enrollment.",
          )}
        </p>

        {/* Acquisition type */}
        <div className="space-y-2">
          <Label className="text-sm">{t("commissionHub.simAcqType", "Acquisition type")}</Label>
          <select
            value={acquisitionType}
            onChange={(e) => setAcquisitionType(e.target.value as AcquisitionType)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ACQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey, o.fallback)}
              </option>
            ))}
          </select>
        </div>

        {/* Inputs */}
        <div className="grid sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t(f.labelKey, f.fallback)}</Label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="ps-7"
                  value={f.value}
                  onChange={(e) => setters[f.key](Number(e.target.value) || 0)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className={`flex items-center justify-between text-sm ${
                r.emphasis ? "font-semibold border-t border-border pt-2 mt-1" : ""
              } ${r.muted ? "text-muted-foreground" : ""}`}
            >
              <span>{r.label}</span>
              <span className="font-mono">{fmtILS(r.value)}</span>
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {result.negativeMargin ? (
            <>
              <AlertTriangle className={`h-4 w-4 ${toneClasses("payment").text}`} />
              <Badge variant="outline" className={toneClasses("payment").chip}>
                {t("commissionHub.simNegativeMargin", "Negative margin — payouts exceed NET (a warning would be logged)")}
              </Badge>
            </>
          ) : (
            <>
              <CheckCircle2 className={`h-4 w-4 ${toneClasses("paid").text}`} />
              <Badge variant="outline" className={toneClasses("paid").chip}>
                {t("commissionHub.simHealthy", "Healthy margin")}
              </Badge>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommissionSimulator;
