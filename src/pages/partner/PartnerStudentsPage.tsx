import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800",
  appointment_scheduled: "bg-purple-100 text-purple-800",
  profile_completion: "bg-yellow-100 text-yellow-800",
  payment_confirmed: "bg-amber-100 text-amber-800",
  submitted: "bg-cyan-100 text-cyan-800",
  enrollment_paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const FRIENDLY_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: "New", ar: "جديد" },
  contacted: { en: "Contacted", ar: "تم التواصل" },
  appointment_scheduled: { en: "Appointment Scheduled", ar: "موعد محدد" },
  profile_completion: { en: "Profile Complete", ar: "ملف مكتمل" },
  payment_confirmed: { en: "Payment Received", ar: "تم الدفع" },
  submitted: { en: "Submitted for Enrollment", ar: "مقدم للتسجيل" },
  enrollment_paid: { en: "Enrolled", ar: "مسجل ✅" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
};

export default function PartnerStudentsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    // 1. Fetch per-partner visibility override
    const { data: override } = await (supabase as any)
      .from("partner_commission_overrides")
      .select("show_all_cases")
      .eq("partner_id", uid)
      .maybeSingle();

    // 2. Build cases query based on visibility:
    //    true  → all cases
    //    false → auto-generated agency leads only (apply_page / contact_form / team-submitted)
    //    null  → only cases directly attributed to this partner via partner_id
    let query = (supabase as any)
      .from("cases")
      .select("id,full_name,status,created_at,source,partner_id")
      .order("created_at", { ascending: false });

    // Agency-generated sources (excludes "referral" = peer student-to-student referrals)
    const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];

    if (override !== null && override !== undefined) {
      if (override.show_all_cases === false) {
        // Apply/Contact Only: agency-generated leads, no peer referrals
        query = query.in("source", PARTNER_SOURCES);
      } else if (override.show_all_cases === null || override.show_all_cases === undefined) {
        // Referral Cases Only: peer student-to-student referrals (source='referral')
        query = query.eq("source", "referral");
      }
      // show_all_cases === true → no extra filter (show everything)
    } else {
      // No override row at all → default: agency-generated leads only
      query = query.in("source", PARTNER_SOURCES);
    }

    const { data, error } = await query;
    if (error) console.error("cases fetch error:", error);
    setCases(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/student-auth");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  // Real-time: refetch when cases or partner overrides change
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);

  if (!userId || isLoading) return <DashboardLoading />;

  const statusLabel = (s: string) => {
    const entry = FRIENDLY_LABELS[s];
    if (!entry) return s;
    return isAr ? entry.ar : entry.en;
  };

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  const filtered = cases.filter((c) => {
    const matchSearch = !search || firstNameOnly(c.full_name).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(cases.map((c) => c.status))];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t("partner.registeredStudents")}
          <span className="text-base font-normal text-muted-foreground">({cases.length})</span>
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("partner.searchByFirstName")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
        >
          {t("partner.all")} ({cases.length})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
          >
            {statusLabel(s)} ({cases.filter((c) => c.status === s).length})
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("partner.noMatchingStudents")}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>{t("partner.colName")}</span>
            <span>{t("partner.colDate")}</span>
            <span>{t("partner.colStage")}</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border bg-background">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-3 items-center px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="font-medium text-foreground">{firstNameOnly(c.full_name)}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(c.created_at).toLocaleDateString('en-US')}
                </span>
                <Badge className={`text-xs w-fit ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel(c.status)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {t("partner.privacyNote")}
      </p>
    </div>
  );
}
