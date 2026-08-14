import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsManager } from "@/hooks/useIsManager";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, User, Clock, UserCheck, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

interface PipelineCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  partner_id: string | null;
  created_at: string;
  archived: boolean;
}

interface TeamDirMember {
  id: string;
  full_name: string;
}

const STATUS_LABEL: Record<string, { en: string; ar: string; cls: string }> = {
  new: { en: "New", ar: "جديد", cls: "bg-slate-100 text-slate-700" },
  contacted: { en: "Contacted", ar: "تم التواصل", cls: "bg-blue-100 text-blue-700" },
  appointment_scheduled: { en: "Appointment", ar: "موعد", cls: "bg-purple-100 text-purple-700" },
  profile_completion: { en: "Profile", ar: "الملف", cls: "bg-yellow-100 text-yellow-700" },
  payment_confirmed: { en: "Payment", ar: "دفعة", cls: "bg-emerald-100 text-emerald-700" },
  submitted: { en: "Submitted", ar: "مُرسل", cls: "bg-green-100 text-green-700" },
  enrollment_paid: { en: "Enrolled", ar: "مسجّل", cls: "bg-teal-100 text-teal-700" },
  rejected: { en: "Rejected", ar: "مرفوض", cls: "bg-red-100 text-red-700" },
  cancelled: { en: "Cancelled", ar: "ملغى", cls: "bg-gray-100 text-gray-500" },
};

const daysSince = (iso: string) => {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24)));
};

/**
 * Manager pipeline: lists cases that arrived via a partner/ambassador referral
 * (cases.partner_id IS NOT NULL) and lets the manager assign each to a team
 * member, after which the case follows the normal flow. The manager can see
 * the full active pipeline but can ONLY change assigned_to (enforced by RLS:
 * "Manager can assign cases" updates assigned_to only). Catalog, settings and
 * deletes remain admin-only. Non-managers are bounced to the team overview.
 */
const TeamPipelinePage: React.FC = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isManager, loading: mgrLoading } = useIsManager();
  const isAr = i18n.language === "ar";

  const [cases, setCases] = useState<PipelineCase[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamDirMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterAssigned, setFilterAssigned] = useState<string>("all"); // all | unassigned | assigned

  const fetchData = useCallback(async () => {
    try {
      // Manager sees all active (non-archived) cases via RLS. We surface the
      // partner/ambassador-sourced ones (partner_id IS NOT NULL) — the cases a
      // manager is responsible for triaging.
      const [caseRes, teamRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, full_name, phone_number, status, source, assigned_to, partner_id, created_at, archived")
          .eq("archived", false)
          .not("status", "in", '("forgotten","cancelled","enrollment_paid")')
          .not("partner_id", "is", null)
          .order("created_at", { ascending: false }),
        supabase.rpc("list_team_directory"),
      ]);
      if (caseRes.error) throw caseRes.error;
      setCases((caseRes.data as PipelineCase[]) ?? []);
      setTeamMembers((teamRes.data as TeamDirMember[]) ?? []);
    } catch (err: unknown) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mgrLoading) return;
    if (!isManager) {
      navigate("/team", { replace: true });
      return;
    }
    fetchData();
  }, [mgrLoading, isManager, navigate, fetchData]);

  const assignCase = async (caseId: string, userId: string | null) => {
    setAssigning(caseId);
    try {
      // Only assigned_to is touched; RLS restricts the UPDATE to that column.
      const { error } = await supabase
        .from("cases")
        .update({ assigned_to: userId || null })
        .eq("id", caseId);
      if (error) throw error;
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, assigned_to: userId } : c)));
      toast({ description: t("admin.pipeline.caseAssigned", "Case assigned successfully") });
    } catch (err: unknown) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "" });
    } finally {
      setAssigning(null);
    }
  };

  if (mgrLoading) return <DashboardLoading label={t("common.loading", "Loading…")} />;

  const filtered = cases.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.full_name.toLowerCase().includes(q) || c.phone_number.includes(q);
    const matchesFilter =
      filterAssigned === "all" ||
      (filterAssigned === "unassigned" && !c.assigned_to) ||
      (filterAssigned === "assigned" && !!c.assigned_to);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            {t("manager.pipelineTitle", "Pipeline")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("manager.pipelineSubtitle", "Assign partner & ambassador referrals to a team member.")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("manager.searchPlaceholder", "Search by name or phone…")}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>
        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("manager.filterAll", "All cases")}</SelectItem>
            <SelectItem value="unassigned">{t("admin.pipeline.unassigned", "Unassigned")}</SelectItem>
            <SelectItem value="assigned">{t("manager.filterAssigned", "Assigned")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <DashboardLoading label={t("common.loading", "Loading…")} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("manager.noCases", "No partner/ambassador cases to assign right now.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => {
            const status = STATUS_LABEL[c.status] ?? { en: c.status, ar: c.status, cls: "bg-muted text-muted-foreground" };
            const days = daysSince(c.created_at);
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{c.full_name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.cls}`}>
                          {isAr ? status.ar : status.en}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {t("manager.referral", "Referral")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono ltr" dir="ltr">{c.phone_number}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {days}d
                        </span>
                        {c.assigned_to && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {teamMembers.find((tm) => tm.id === c.assigned_to)?.full_name ?? "—"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={c.assigned_to || "unassigned"}
                        onValueChange={(val) => assignCase(c.id, val === "unassigned" ? null : val)}
                        disabled={assigning === c.id}
                      >
                        <SelectTrigger className="w-full md:w-56 h-9 text-sm">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5" />
                            <SelectValue placeholder={t("admin.pipeline.assignPlaceholder", "Assign to team member")} />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">{t("admin.pipeline.unassigned", "Unassigned")}</SelectItem>
                          {teamMembers.map((tm) => (
                            <SelectItem key={tm.id} value={tm.id}>
                              {tm.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamPipelinePage;
