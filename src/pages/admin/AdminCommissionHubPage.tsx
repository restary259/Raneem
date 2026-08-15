import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  RefreshCw,
  Settings2,
  Users,
  UserCog,
  Network,
  GraduationCap,
  DollarSign,
  Save,
  Crown,
  Heart,
  Users2,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { useCommissionHub } from "@/hooks/useCommissionHub";
import CommissionSimulator from "@/components/admin/CommissionSimulator";

const fmtILS = (n: number | null | undefined) =>
  `₪${(Number(n ?? 0)).toLocaleString("en-US")}`;

interface GlobalRateField {
  key: string;
  label: string;
  value: number;
}

const AdminCommissionHubPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { overview, independent, agentList, studentConfig, loading, saving, error, setCommission, refresh } =
    useCommissionHub();

  const [rateDrafts, setRateDrafts] = useState<Record<string, number>>({});
  const [agentFilter, setAgentFilter] = useState("");

  const globalRates = useMemo<GlobalRateField[]>(() => {
    const g = overview?.global_rates;
    if (!g) return [];
    return [
      { key: "partner_commission_rate", label: t("commissionHub.ratePartner", "Partner pool"), value: g.partner },
      { key: "ambassador_commission_rate", label: t("commissionHub.rateAmbassador", "Ambassador"), value: g.ambassador },
      { key: "team_member_commission_rate", label: t("commissionHub.rateTeam", "Team"), value: g.team },
      { key: "master_partner_override_rate", label: t("commissionHub.rateMaster", "Master share"), value: g.master_share },
      { key: "agent_commission_rate", label: t("commissionHub.rateAgent", "Agent (additive)"), value: g.agent },
      { key: "agent_self_referral_rate", label: t("commissionHub.rateAgentSelf", "Agent self-referral"), value: g.agent_self_referral },
      { key: "referral_discount_amount", label: t("commissionHub.rateReferralDiscount", "Referral discount"), value: g.referral_discount },
      { key: "student_refer_friend_discount", label: t("commissionHub.rateFriendDiscount", "Friend discount"), value: g.student_friend_discount },
      { key: "student_refer_friend_reward", label: t("commissionHub.rateFriendReward", "Friend referrer reward"), value: g.student_friend_reward },
      { key: "student_refer_family_discount", label: t("commissionHub.rateFamilyDiscount", "Family discount"), value: g.student_family_discount },
      { key: "student_refer_family_reward", label: t("commissionHub.rateFamilyReward", "Family referrer reward"), value: g.student_family_reward },
    ];
  }, [overview, t]);

  const saveGlobalRate = async (key: string) => {
    const amount = rateDrafts[key];
    if (amount === undefined) return;
    try {
      await setCommission("global", null, key, Math.max(0, Math.round(amount)));
      toast({ description: t("commissionHub.saved", "Commission rate updated") });
      setRateDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const g = overview?.global_rates;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            {t("commissionHub.title", "Commission Hub")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("commissionHub.subtitle", "Single source of truth for every commission relationship")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4 me-2" />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              {t("commissionHub.loadError", "Failed to load commission data")}
            </p>
            <p className="text-muted-foreground text-xs mt-1">{error}</p>
            {error.includes("does not exist") && (
              <p className="text-muted-foreground text-xs mt-1">
                {t("commissionHub.migrationHint", "Run the latest SQL migration in Supabase SQL Editor, then click Retry.")}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 me-2" />
            {t("common.retry", "Retry")}
          </Button>
        </div>
      )}

      {/* Model banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
        <DollarSign className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-foreground">
          {t(
            "commissionHub.modelBanner",
            "Agent commissions are ADDITIVE: paid on top of the partner's full pool share, funded from Darb's margin. The partner always keeps their full ₪{{pool}}.",
            { pool: fmtILS(g?.partner) },
          )}
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap w-full h-auto">
          <TabsTrigger value="overview">{t("commissionHub.tabOverview", "Overview")}</TabsTrigger>
          <TabsTrigger value="rates">{t("commissionHub.tabRates", "Global rates")}</TabsTrigger>
          <TabsTrigger value="team">{t("commissionHub.tabTeam", "Team")}</TabsTrigger>
          <TabsTrigger value="agents">{t("commissionHub.tabAgents", "Agents")}</TabsTrigger>
          <TabsTrigger value="independent">{t("commissionHub.tabIndependent", "Direct (no recruiter)")}</TabsTrigger>
            <TabsTrigger value="students">{t("commissionHub.tabStudents", "Students")}</TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2">
              <Calculator className="h-4 w-4" />
              {t("commissionHub.tabSimulator", "Simulator")}
            </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={UserCog} label={t("commissionHub.kpiTeam", "Team members")} value={overview?.team_members_total ?? 0} />
            <KpiCard icon={Users} label={t("commissionHub.kpiPartners", "Partners")} value={overview?.partners_total ?? 0}
              sub={t("commissionHub.kpiCustom", "{{count}} custom", { count: overview?.partners_custom ?? 0 })} />
            <KpiCard icon={Users2} label={t("commissionHub.kpiAmbassadors", "Ambassadors")} value={overview?.ambassadors_total ?? 0} />
            <KpiCard icon={Network} label={t("commissionHub.kpiAgents", "Agents")} value={overview?.agents_total ?? 0}
              sub={t("commissionHub.kpiCustom", "{{count}} custom", { count: overview?.agents_custom ?? 0 })} />
            <KpiCard icon={GraduationCap} label={t("commissionHub.kpiStudents", "Students")} value={overview?.students_total ?? 0} />
            <KpiCard icon={Crown} label={t("commissionHub.kpiMasters", "Master partners")} value={overview?.master_partners ?? 0} />
            <KpiCard icon={Users} label={t("commissionHub.kpiIndependent", "Direct (no recruiter)")} value={overview?.independent_partners ?? 0}
              sub={t("commissionHub.kpiIndependentSub", "No agent, no master")} />
            <KpiCard icon={DollarSign} label={t("commissionHub.kpiAtZero", "Partners at ₪0")} value={overview?.partners_at_zero ?? 0} />
          </div>

          {/* Recent changes (audit trail) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("commissionHub.recentChanges", "Recent commission changes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {(overview?.recent_changes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">{t("commissionHub.noChanges", "No rate changes recorded yet.")}</p>
              ) : (
                <div className="space-y-2">
                  {(overview?.recent_changes ?? []).slice(0, 12).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card text-sm flex-wrap">
                      <Badge variant="outline" className="font-mono">{c.entity_type}</Badge>
                      <span className="text-muted-foreground">{c.rate_kind}</span>
                      <span className="font-mono">
                        {fmtILS(c.old_value)} → <span className="text-primary font-semibold">{fmtILS(c.new_value)}</span>
                      </span>
                      {c.reason && <span className="text-xs text-muted-foreground italic">“{c.reason}”</span>}
                      <span className="ms-auto text-xs text-muted-foreground">
                        {new Date(c.changed_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Global rates ── */}
        <TabsContent value="rates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                {t("commissionHub.globalRatesTitle", "Global commission rates")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {globalRates.map((r) => {
                const draft = rateDrafts[r.key];
                const display = draft !== undefined ? draft : r.value;
                return (
                  <div key={r.key} className="flex items-center gap-3 flex-wrap" data-testid={`rate-row-${r.key}`}>
                    <Label className="flex-1 min-w-[180px] text-sm">{r.label}</Label>
                    <div className="relative w-40">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="ps-7"
                        value={display}
                        onChange={(e) => setRateDrafts((d) => ({ ...d, [r.key]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={draft === undefined || saving}
                      onClick={() => saveGlobalRate(r.key)}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {t("common.save", "Save")}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />
                {t("commissionHub.teamTitle", "Team members")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("commissionHub.teamHint", "Per-team-member overrides are configured from the Team page. The global team rate is on the Global rates tab.")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Agents ── */}
        <TabsContent value="agents" className="space-y-4 mt-4">
          <AgentSection
            agents={agentList}
            saving={saving}
            onSetCommission={setCommission}
            onSaved={() => toast({ description: t("commissionHub.saved", "Commission rate updated") })}
            onError={(m: string) => toast({ variant: "destructive", description: m })}
            filter={agentFilter}
            setFilter={setAgentFilter}
            t={t}
          />
        </TabsContent>

        {/* ── Independent ── */}
        <TabsContent value="independent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t("commissionHub.independentTitle", "Direct partners & ambassadors (no recruiter)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                {t("commissionHub.independentHint", "Recruited directly by Admin — no agent, no master partner.")}
              </p>
              {independent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">{t("commissionHub.none", "None")}</p>
              ) : (
                <div className="space-y-2">
                  {independent.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{a.role}</Badge>
                      <Badge variant="secondary" className="font-mono">
                        {a.override === null ? t("commissionHub.default", "default") : fmtILS(a.override)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("commissionHub.studentsReferred", "{{count}} students", { count: a.students_referred })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Students (referral config) ── */}
        <TabsContent value="students" className="space-y-4 mt-4">
          <StudentReferralSection
            config={studentConfig}
            saving={saving}
            onSetCommission={setCommission}
            onSaved={() => toast({ description: t("commissionHub.saved", "Commission rate updated") })}
            onError={(m: string) => toast({ variant: "destructive", description: m })}
            t={t}
          />
        </TabsContent>

        {/* ── Simulator (pure what-if, no writes) ── */}
        <TabsContent value="simulator" className="mt-4">
          <CommissionSimulator t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── KPI card ──────────────────────────────────────────────────────────── */
const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: number; sub?: string }> = ({
  icon: Icon,
  label,
  value,
  sub,
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

/* ── Agent section (renders the agent list from the Hub hook) ──────────── */
const AgentSection: React.FC<{
  agents: Array<{ id: string; name: string; email: string; override: number | null; students_referred: number }>;
  saving: boolean;
  onSetCommission: (
    entityType: string,
    entityId: string | null,
    rateKind: string,
    amount: number,
    reason?: string,
  ) => Promise<unknown>;
  onSaved: () => void;
  onError: (m: string) => void;
  filter: string;
  setFilter: (s: string) => void;
  t: (k: string, fallback?: string, opts?: any) => string;
}> = ({ agents, saving, onSetCommission, onSaved, onError, filter, setFilter, t }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = async (agentId: string) => {
    const raw = drafts[agentId];
    if (raw === undefined) return;
    const amount = Math.max(0, Math.round(Number(raw)));
    try {
      await onSetCommission("agent", agentId, "commission_amount", amount);
      onSaved();
      setDrafts((d) => {
        const n = { ...d };
        delete n[agentId];
        return n;
      });
    } catch (err: any) {
      onError(err.message);
    }
  };

  const filtered = agents.filter(
    (a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase()) || a.email.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            {t("commissionHub.agentsTitle", "Agents & network overrides")}
          </CardTitle>
          <Input
            placeholder={t("commissionHub.search", "Search…")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-48"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">{t("commissionHub.none", "None")}</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => {
              const draft = drafts[a.id];
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                  <Badge variant={a.override === null ? "outline" : "secondary"} className="font-mono">
                    {a.override === null ? t("commissionHub.default", "default") : fmtILS(a.override)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("commissionHub.studentsReferred", "{{count}} students", { count: a.students_referred })}
                  </span>
                  <div className="relative w-32">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="ps-7 h-9"
                      placeholder={String(a.override ?? "")}
                      value={draft ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                    />
                  </div>
                  <Button size="sm" variant="outline" disabled={draft === undefined || saving} onClick={() => save(a.id)}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t("common.save", "Save")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {t("commissionHub.agentAdditiveNote", "Agent overrides are additive — paid from Darb's margin, never deducted from the partner's pool.")}
        </p>
      </CardContent>
    </Card>
  );
};

/* ── Student referral config section ───────────────────────────────────── */
const StudentReferralSection: React.FC<{
  config: ReturnType<typeof useCommissionHub>["studentConfig"];
  saving: boolean;
  onSetCommission: (
    entityType: string,
    entityId: string | null,
    rateKind: string,
    amount: number,
    reason?: string,
  ) => Promise<unknown>;
  onSaved: () => void;
  onError: (m: string) => void;
  t: (k: string, fallback?: string, opts?: any) => string;
}> = ({ config, saving, onSetCommission, onSaved, onError, t }) => {
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [newStudentId, setNewStudentId] = useState("");
  const [newType, setNewType] = useState<"friend" | "family">("friend");
  const [newAmount, setNewAmount] = useState<number>(0);

  const saveGlobal = async (rateKind: string) => {
    const amount = drafts[`global_${rateKind}`];
    if (amount === undefined) return;
    try {
      await onSetCommission("global", null, rateKind, Math.max(0, Math.round(amount)));
      onSaved();
      setDrafts((d) => {
        const n = { ...d };
        delete n[`global_${rateKind}`];
        return n;
      });
    } catch (err: any) {
      onError(err.message);
    }
  };

  const saveOverride = async (studentId: string, referralType: string) => {
    const amount = drafts[`ov_${studentId}_${referralType}`];
    if (amount === undefined) return;
    try {
      await onSetCommission("student_override", studentId, referralType, Math.max(0, Math.round(amount)));
      onSaved();
      setDrafts((d) => {
        const n = { ...d };
        delete n[`ov_${studentId}_${referralType}`];
        return n;
      });
    } catch (err: any) {
      onError(err.message);
    }
  };

  const addOverride = async () => {
    const id = newStudentId.trim();
    if (!id) {
      onError(t("commissionHub.studentIdRequired", "Enter a student UUID"));
      return;
    }
    try {
      await onSetCommission("student_override", id, newType, Math.max(0, Math.round(newAmount)));
      onSaved();
      setNewStudentId("");
      setNewAmount(0);
    } catch (err: any) {
      onError(err.message);
    }
  };

  const cfg = config?.global;
  const fields = cfg
    ? [
        { key: "student_refer_friend_discount", label: t("commissionHub.rateFriendDiscount", "Friend discount"), value: cfg.friend_discount },
        { key: "student_refer_friend_reward", label: t("commissionHub.rateFriendReward", "Friend referrer reward"), value: cfg.friend_reward },
        { key: "student_refer_family_discount", label: t("commissionHub.rateFamilyDiscount", "Family discount"), value: cfg.family_discount },
        { key: "student_refer_family_reward", label: t("commissionHub.rateFamilyReward", "Family referrer reward"), value: cfg.family_reward },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          {t("commissionHub.studentReferralTitle", "Student referrals (Refer-a-Friend / Family)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t("commissionHub.studentReferralHint", "Student→student referrals pay ONLY the referring student, funded from Darb's margin. They never propagate upstream to any agent or partner.")}
        </p>

        <div className="space-y-3">
          {fields.map((f) => {
            const draft = drafts[`global_${f.key}`];
            const display = draft !== undefined ? draft : f.value;
            return (
              <div key={f.key} className="flex items-center gap-3 flex-wrap">
                <Label className="flex-1 min-w-[180px] text-sm">{f.label}</Label>
                <div className="relative w-40">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="ps-7"
                    value={display}
                    onChange={(e) => setDrafts((d) => ({ ...d, [`global_${f.key}`]: Number(e.target.value) || 0 }))}
                  />
                </div>
                <Button size="sm" variant="outline" disabled={draft === undefined || saving} onClick={() => saveGlobal(f.key)}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t("common.save", "Save")}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Per-student overrides */}
        <div className="pt-2 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("commissionHub.perStudentOverrides", "Per-student overrides")}
          </p>

          {/* Add new override */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border bg-card flex-wrap">
            <Input
              placeholder={t("commissionHub.studentIdPlaceholder", "Student UUID")}
              value={newStudentId}
              onChange={(e) => setNewStudentId(e.target.value)}
              className="flex-1 min-w-[200px] h-9 font-mono text-xs"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "friend" | "family")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="friend">{t("referrals.type_friend", "Friend")}</option>
              <option value="family">{t("referrals.type_family", "Family")}</option>
            </select>
            <div className="relative w-28">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className="ps-7 h-9"
                value={newAmount}
                onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
              />
            </div>
            <Button size="sm" disabled={saving || !newStudentId.trim()} onClick={addOverride}>
              {t("commissionHub.addOverride", "Add")}
            </Button>
          </div>

          {(config?.overrides ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("commissionHub.none", "None")}</p>
          ) : (
            <div className="space-y-2">
              {(config?.overrides ?? []).map((o) => {
                const draftKey = `ov_${o.student_id}_${o.referral_type}`;
                const draft = drafts[draftKey];
                return (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{o.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{o.student_id}</p>
                    </div>
                    <Badge variant="outline">{o.referral_type}</Badge>
                    <Badge variant="secondary" className="font-mono">{fmtILS(o.reward_amount)}</Badge>
                    <div className="relative w-28">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="ps-7 h-9"
                        placeholder={String(o.reward_amount)}
                        value={draft ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={draft === undefined || saving}
                      onClick={() => saveOverride(o.student_id, o.referral_type)}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {t("common.save", "Save")}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCommissionHubPage;
