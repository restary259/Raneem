import React, { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import {
  simulateCommission,
  type AcquisitionType,
} from "@/lib/commissionSimulator";
import type { SimulationInputs } from "@/hooks/useCommissionHub";

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

interface PickerPerson {
  id: string;
  name: string;
  role: "partner" | "ambassador" | "agent";
}

interface Props {
  t: TFunction;
  fetchSimulationInputs: (userId?: string) => Promise<SimulationInputs>;
  people: PickerPerson[];
  /** Changes whenever the Hub refetches (after a rate save) → inputs refetch. */
  refreshKey: unknown;
}

/**
 * "What-if" commission calculator. The pure arithmetic (simulateCommission)
 * is display math only; every rate VALUE is resolved server-side by
 * get_commission_simulation_inputs — which calls the SAME resolver functions
 * the commission engine calls. The frontend never recalculates rates.
 */
const CommissionSimulator: React.FC<Props> = ({ t, fetchSimulationInputs, people, refreshKey }) => {
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>("partner");
  const [grossTotal, setGrossTotal] = useState(5000);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [partnerPool, setPartnerPool] = useState(1000);
  const [agentShare, setAgentShare] = useState(500);
  const [teamRate, setTeamRate] = useState(100);
  const [studentReward, setStudentReward] = useState(200);

  const [inputs, setInputs] = useState<SimulationInputs | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadingInputs, setLoadingInputs] = useState(false);

  const person = inputs?.person ?? null;
  const globals = inputs?.globals ?? null;

  // Load (and reload on Hub refresh) the server-resolved inputs.
  useEffect(() => {
    let cancelled = false;
    setLoadingInputs(true);
    fetchSimulationInputs(selectedId || undefined)
      .then((data) => {
        if (cancelled) return;
        setInputs(data);
        const g = data.globals;
        setTeamRate(data.person?.effective.team ?? g.team);
        if (data.person) {
          const p = data.person;
          if (p.role === "social_media_partner" || p.role === "ambassador") {
            setAcquisitionType("partner");
            setPartnerPool(p.effective.partner ?? g.partner);
            setAgentShare(p.recruiter?.agent_effective ?? g.agent);
          } else if (p.role === "agent") {
            setAcquisitionType("agent_self");
            setAgentShare(p.effective.agent_self_referral ?? g.agent_self_referral);
          } else if (p.role === "student") {
            setAcquisitionType("student");
            setStudentReward(p.effective.student_friend_reward ?? g.student_friend_reward);
          } else if (p.role === "team_member") {
            setAcquisitionType("direct");
          }
        } else {
          setPartnerPool(g.partner);
          setAgentShare(g.agent);
          setStudentReward(g.student_friend_reward);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingInputs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSimulationInputs, selectedId, refreshKey]);

  const resetToConfigured = () => {
    if (!globals) return;
    setTeamRate(person?.effective.team ?? globals.team);
    if (person) {
      if (person.role === "social_media_partner" || person.role === "ambassador") {
        setPartnerPool(person.effective.partner ?? globals.partner);
        setAgentShare(person.recruiter?.agent_effective ?? globals.agent);
      } else if (person.role === "agent") {
        setAgentShare(person.effective.agent_self_referral ?? globals.agent_self_referral);
      } else if (person.role === "student") {
        setStudentReward(person.effective.student_friend_reward ?? globals.student_friend_reward);
      }
    } else {
      setPartnerPool(globals.partner);
      setAgentShare(globals.agent);
      setStudentReward(globals.student_friend_reward);
    }
  };

  const result = useMemo(
    () =>
      simulateCommission({
        acquisitionType,
        grossTotal,
        referralDiscount,
        partnerPool,
        agentShare,
        teamRate,
        studentReward,
      }),
    [acquisitionType, grossTotal, referralDiscount, partnerPool, agentShare, teamRate, studentReward],
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
      { label: t("commissionHub.simPartnerShare", "Partner share"), value: result.partnerShare },
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

        {/* Person picker — rates resolved server-side by the engine's resolvers */}
        <div className="space-y-2">
          <Label className="text-sm">{t("commissionHub.simPickPerson", "Simulate for (optional)")}</Label>
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 flex-1 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("commissionHub.simNoPerson", "— Global defaults only —")}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={resetToConfigured} disabled={loadingInputs || !inputs}>
              {t("commissionHub.simReset", "Reset to configured")}
            </Button>
          </div>
          {person && (
            <p className="text-xs text-muted-foreground font-mono" dir="ltr">
              {person.is_recruited && person.agent_name
                ? t("commissionHub.simChainRecruited", "Admin → Agent {{agent}} → {{role}} {{name}} → Student")
                    .replace("{{agent}}", person.agent_name)
                    .replace("{{role}}", person.role ?? "")
                    .replace("{{name}}", person.name ?? "")
                : t("commissionHub.simChainDirect", "Admin → Direct {{role}} {{name}} → Student")
                    .replace("{{role}}", person.role ?? "")
                    .replace("{{name}}", person.name ?? "")}
            </p>
          )}
        </div>

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
