import React, { useState, useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import SegmentedTabs from "@/components/shell/SegmentedTabs";
import { toneClasses } from "@/lib/statusTokens";
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
  const {
    overview, agentList, studentConfig, teamMembers, partnerList, ambassadorList,
    loading, saving, error, setCommission, fetchSimulationInputs, refresh,
  } = useCommissionHub();

  const [rateDrafts, setRateDrafts] = useState<Record<string, number>>({});
  const [agentFilter, setAgentFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const globalRates = useMemo<GlobalRateField[]>(() => {
    const g = overview?.global_rates;
    if (!g) return [];
    return [
      { key: "team_member_commission_rate", label: t("commissionHub.rateTeam", "Team"), value: g.team },
      { key: "agent_self_referral_rate", label: t("commissionHub.rateAgentSelf", "Agent self-referral"), value: g.agent_self_referral },
      { key: "agent_commission_rate", label: t("commissionHub.rateAgent", "Agent recruitment"), value: g.agent },
      { key: "partner_commission_rate", label: t("commissionHub.ratePartner", "Partner"), value: g.partner },
      { key: "ambassador_commission_rate", label: t("commissionHub.rateAmbassador", "Ambassador"), value: g.ambassador },
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <SegmentedTabs
          items={[
            { value: "overview", label: t("commissionHub.tabOverview", "Overview") },
            { value: "rates", label: t("commissionHub.tabRates", "Global rates") },
            { value: "team", label: t("commissionHub.tabTeamMembers", "Team Members") },
            { value: "agents", label: t("commissionHub.tabAgents", "Agents") },
            { value: "partners", label: t("commissionHub.tabPartners", "Partners") },
            { value: "ambassadors", label: t("commissionHub.tabAmbassadors", "Ambassadors") },
            { value: "students", label: t("commissionHub.tabStudents", "Students") },
            { value: "simulator", label: t("commissionHub.tabSimulator", "Simulator"), icon: Calculator },
          ]}
        />

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={UserCog} label={t("commissionHub.kpiTeam", "Team members")} value={overview?.team_members_total ?? 0} />
            <KpiCard icon={Network} label={t("commissionHub.kpiAgents", "Agents")} value={overview?.agents_total ?? 0}
              sub={t("commissionHub.kpiCustom", "{{count}} custom", { count: overview?.agents_custom ?? 0 })} />
            <KpiCard icon={Users} label={t("commissionHub.kpiRecruitedPartners", "Recruited partners")} value={overview?.recruited_partners ?? 0}
              sub={t("commissionHub.badgeRecruited", "Recruited")} />
            <KpiCard icon={Users2} label={t("commissionHub.kpiRecruitedAmbassadors", "Recruited ambassadors")} value={overview?.recruited_ambassadors ?? 0}
              sub={t("commissionHub.badgeRecruited", "Recruited")} />
            <KpiCard icon={Users} label={t("commissionHub.kpiDirectPartners", "Direct partners")} value={overview?.direct_partners ?? 0}
              sub={t("commissionHub.badgeDirect", "Direct")} />
            <KpiCard icon={Users2} label={t("commissionHub.kpiDirectAmbassadors", "Direct ambassadors")} value={overview?.direct_ambassadors ?? 0}
              sub={t("commissionHub.badgeDirect", "Direct")} />
            <KpiCard icon={GraduationCap} label={t("commissionHub.kpiStudents", "Students")} value={overview?.students_total ?? 0} />
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
                        {fmtILS(c.old_value)} → <span className={`${toneClasses('payment').text} font-semibold`}>{fmtILS(c.new_value)}</span>
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
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {t("commissionHub.teamHint", "Override a team member's commission. Leave at default to use the global team rate.")}
              </p>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">{t("commissionHub.none", "None")}</p>
              ) : (
                teamMembers.map((m) => (
                  <TeamMemberRow
                    key={m.id}
                    member={m}
                    globalRate={m.global_rate ?? overview?.global_rates?.team ?? 0}
                    saving={saving}
                    onSetCommission={setCommission}
                    onSaved={() => toast({ description: t("commissionHub.saved", "Commission rate updated") })}
                    onError={(msg: string) => toast({ variant: "destructive", description: msg })}
                    t={t}
                  />
                ))
              )}
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

        {/* ── Partners ── */}
        <TabsContent value="partners" className="mt-4">
          <PartnerFamilySection
            icon={Users}
            title={t("commissionHub.partnersTitle", "Partners")}
            hint={t("commissionHub.partnersHint", "All partners — direct and agent-recruited. Override applies only to that account; ambassadors share the same override table, only their global default differs.")}
            accounts={partnerList}
            saving={saving}
            onSetCommission={setCommission}
            onSaved={() => toast({ description: t("commissionHub.saved", "Commission rate updated") })}
            onError={(m: string) => toast({ variant: "destructive", description: m })}
            t={t}
          />
        </TabsContent>

        {/* ── Ambassadors ── */}
        <TabsContent value="ambassadors" className="mt-4">
          <PartnerFamilySection
            icon={Users2}
            title={t("commissionHub.ambassadorsTitle", "Ambassadors")}
            hint={t("commissionHub.ambassadorsHint", "All ambassadors — direct and agent-recruited. Their default follows the global ambassador rate.")}
            accounts={ambassadorList}
            saving={saving}
            onSetCommission={setCommission}
            onSaved={() => toast({ description: t("commissionHub.saved", "Commission rate updated") })}
            onError={(m: string) => toast({ variant: "destructive", description: m })}
            t={t}
          />
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

        {/* ── Simulator — inputs resolved server-side by the engine's own resolvers ── */}
        <TabsContent value="simulator" className="mt-4">
          <CommissionSimulator
            t={t}
            fetchSimulationInputs={fetchSimulationInputs}
            people={[
              ...partnerList.map((p) => ({ id: p.id, name: p.name, role: "partner" as const })),
              ...ambassadorList.map((a) => ({ id: a.id, name: a.name, role: "ambassador" as const })),
              ...agentList.map((a) => ({ id: a.id, name: a.name, role: "agent" as const })),
            ]}
            refreshKey={overview}
          />
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

/* ── Team member row ──────────────────────────────────────────────────── */
const TeamMemberRow: React.FC<{
  member: { id: string; name: string; email: string; override: number | null; is_manager?: boolean };
  globalRate: number;
  saving: boolean;
  onSetCommission: (type: string, id: string | null, kind: string, amount: number) => Promise<void>;
  onSaved: () => void;
  onError: (m: string) => void;
  t: TFunction;
}> = ({ member, globalRate, saving, onSetCommission, onSaved, onError, t }) => {
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const display = draft !== undefined ? draft : (member.override ?? globalRate);

  const save = async () => {
    if (draft === undefined) return;
    try {
      await onSetCommission("team", member.id, "team_member_commission_rate", Math.max(0, Math.round(draft)));
      onSaved();
      setDraft(undefined);
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card flex-wrap">
      <div className="w-full sm:flex-1 min-w-0">
        <p className="text-sm font-semibold flex items-center gap-2 min-w-0">
          <span className="truncate" title={member.name}>{member.name}</span>
          {member.is_manager && (
            <Badge variant="outline" className="text-[10px] shrink-0">{t("commissionHub.badgeManager", "Manager")}</Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate" title={member.email}>{member.email}</p>
      </div>
      {member.override === null ? (
        <Badge variant="outline" className="text-xs">{t("commissionHub.badgeDefault", "default")}</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          {t("commissionHub.badgeCustom", "custom")}
          <span className="mx-1 opacity-60">·</span>
          <span className="font-mono">{fmtILS(member.override)}</span>
        </Badge>
      )}

      <div className="relative w-32">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
        <Input
          type="number" min={0} inputMode="numeric"
          className="ps-7 h-8 text-sm"
          value={display}
          onChange={(e) => setDraft(Number(e.target.value) || 0)}
        />
      </div>
      <Button size="sm" variant="outline" disabled={draft === undefined || saving} onClick={save}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {t("common.save", "Save")}
      </Button>
    </div>
  );
};

/* ── Agent section — two independent rates per agent (self-referral + additive) ── */
const AgentSection: React.FC<{
  agents: Array<{
    id: string; name: string; email: string; status: "active" | "inactive";
    override: number | null; global_rate: number;
    self_referral_override: number | null; self_referral_global: number;
    students_referred: number;
  }>;
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
  t: TFunction<"dashboard">;
}> = ({ agents, saving, onSetCommission, onSaved, onError, filter, setFilter, t }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = async (key: string, entityType: string, agentId: string) => {
    const raw = drafts[key];
    if (raw === undefined) return;
    const amount = Math.max(0, Math.round(Number(raw)));
    try {
      await onSetCommission(entityType, agentId, "commission_amount", amount);
      onSaved();
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
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
              const selfKey = `${a.id}_self`;
              const additiveKey = `${a.id}_additive`;
              const selfDraft = drafts[selfKey];
              const additiveDraft = drafts[additiveKey];
              const saveSelf = () => save(selfKey, "agent_self_referral", a.id);
              const saveAdditive = () => save(additiveKey, "agent", a.id);
              return (
                <div key={a.id} className="p-3 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-full sm:flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" title={a.name}>{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate" title={a.email}>{a.email}</p>

                    </div>
                    <Badge variant={a.status === "active" ? "secondary" : "outline"} className="text-xs">
                      {a.status === "active"
                        ? t("commissionHub.statusActive", "Active")
                        : t("commissionHub.statusInactive", "Inactive")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("commissionHub.studentsReferred", "{{count}} students", { count: a.students_referred })}
                    </span>
                  </div>

                  {/* Two independent rates, each with its own default/custom badge */}
                  {[
                    {
                      key: selfKey, draft: selfDraft, entity: "agent_self_referral",
                      label: t("commissionHub.agentSelfRate", "Self-referral rate"),
                      overrideValue: a.self_referral_override, globalValue: a.self_referral_global, onSave: saveSelf,
                    },
                    {
                      key: additiveKey, draft: additiveDraft, entity: "agent",
                      label: t("commissionHub.agentAdditiveRate", "Additive rate (per recruit)"),
                      overrideValue: a.override, globalValue: a.global_rate, onSave: saveAdditive,
                    },
                  ].map((row) => (
                    <div key={row.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                      <Label className="w-full sm:w-44 text-xs text-muted-foreground">{row.label}</Label>
                      {row.overrideValue === null ? (
                        <Badge variant="outline" className="text-xs w-fit">{t("commissionHub.badgeDefault", "default")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs w-fit whitespace-nowrap">
                          {t("commissionHub.badgeCustom", "custom")}
                          <span className="mx-1 opacity-60">·</span>
                          <span className="font-mono">{fmtILS(row.overrideValue)}</span>
                        </Badge>
                      )}

                      <div className="relative w-32">
                        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className="ps-7 h-8"
                          placeholder={String(row.overrideValue ?? row.globalValue)}
                          value={row.draft ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                        />
                      </div>
                      <Button size="sm" variant="outline" disabled={row.draft === undefined || saving} onClick={row.onSave}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {t("common.save", "Save")}
                      </Button>
                    </div>
                  ))}
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

/* ── Partners / Ambassadors — shared section over get_*_list ───────────── */
const PartnerFamilySection: React.FC<{
  icon: React.ElementType;
  title: string;
  hint: string;
  accounts: Array<{
    id: string; name: string; email: string;
    override: number | null; global_rate: number;
    agent_id: string | null; agent_name: string | null;
    students_referred: number;
  }>;
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
  t: TFunction<"dashboard">;
}> = ({ icon: Icon, title, hint, accounts, saving, onSetCommission, onSaved, onError, t }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">{hint}</p>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">{t("commissionHub.none", "None")}</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <CommissionAccountRow
                key={a.id}
                account={a}
                saving={saving}
                onSetCommission={onSetCommission}
                onSaved={onSaved}
                onError={onError}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Shared per-account commission row (Partners + Ambassadors) ─────────── */
const CommissionAccountRow: React.FC<{
  account: {
    id: string; name: string; email: string;
    override: number | null; global_rate: number;
    agent_id: string | null; agent_name: string | null;
    students_referred: number;
  };
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
  t: TFunction<"dashboard">;
}> = ({ account, saving, onSetCommission, onSaved, onError, t }) => {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const effective = account.override ?? account.global_rate;

  // Both roles write entity_type='partner' — ambassadors intentionally share
  // partner_commission_overrides (only the global default differs).
  const save = async () => {
    if (draft === undefined) return;
    const amount = Math.max(0, Math.round(Number(draft)));
    try {
      await onSetCommission("partner", account.id, "commission_amount", amount);
      onSaved();
      setDraft(undefined);
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{account.name}</p>
          {account.agent_id ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <Network className="h-3 w-3" />
              {t("commissionHub.badgeRecruited", "Recruited")}
              {account.agent_name && <span>· {account.agent_name}</span>}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{t("commissionHub.badgeDirect", "Direct")}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{account.email}</p>
      </div>
      {account.override === null ? (
        <Badge variant="outline" className="text-xs">{t("commissionHub.badgeDefault", "default")}</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">
          {t("commissionHub.badgeCustom", "custom")} <span className="font-mono">{fmtILS(account.override)}</span>
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {t("commissionHub.studentsReferred", "{{count}} students", { count: account.students_referred })}
      </span>
      <div className="relative w-32">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          className="ps-7 h-8"
          placeholder={String(effective)}
          value={draft ?? ""}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <Button size="sm" variant="outline" disabled={draft === undefined || saving} onClick={save}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {t("common.save", "Save")}
      </Button>
    </div>
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
  t: TFunction<"dashboard">;
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
