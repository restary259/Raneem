import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, AlertTriangle, Clock, Plus } from "lucide-react";
import { format, isPast } from "date-fns";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";

interface Appointment {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  case?: { full_name: string; phone_number: string; status: string };
}

export default function TeamTodayPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [overdueAppts, setOverdueAppts] = useState<Appointment[]>([]);
  const [caseCounts, setCaseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [apptRes, overdueRes, caseRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, case:cases(full_name, phone_number, status)")
          .eq("team_member_id", user.id)
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", todayEnd.toISOString())
          .order("scheduled_at"),
        supabase
          .from("appointments")
          .select("*, case:cases(full_name, phone_number, status)")
          .eq("team_member_id", user.id)
          .lt("scheduled_at", todayStart.toISOString())
          .is("outcome", null)
          .order("scheduled_at", { ascending: false })
          .limit(5),
        supabase.from("cases").select("status").eq("assigned_to", user.id),
      ]);

      if (apptRes.error) throw apptRes.error;
      if (overdueRes.error) throw overdueRes.error;
      if (caseRes.error) throw caseRes.error;

      setTodayAppts((apptRes.data as any[]) ?? []);
      setOverdueAppts((overdueRes.data as any[]) ?? []);

      const counts: Record<string, number> = {};
      for (const c of caseRes.data ?? []) {
        counts[c.status] = (counts[c.status] ?? 0) + 1;
      }
      setCaseCounts(counts);
    } catch (err: any) {
      console.error("TeamTodayPage fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCases = Object.values(caseCounts).reduce((a, b) => a + b, 0);
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{dateStr}</h1>
        <Button onClick={() => navigate("/team/cases")} size="sm">
          <Plus className="h-4 w-4 me-2" /> {t("team.cases.title", "Cases")}
        </Button>
      </div>

      {/* Overdue appointments alert */}
      {overdueAppts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">
                {isAr
                  ? `${overdueAppts.length} موعد بحاجة لتسجيل النتيجة`
                  : `${overdueAppts.length} appointment(s) need outcomes recorded`}
              </span>
            </div>
            <div className="space-y-2">
              {overdueAppts.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span>
                    {(a.case as any)?.full_name} — {format(new Date(a.scheduled_at), "MMM d, h:mm a")}
                  </span>
                  <Button size="sm" variant="destructive" onClick={() => setOutcomeApptId(a.id)}>
                    {isAr ? "تسجيل" : "Record"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{isAr ? "اليوم" : "Today"}</span>
            </div>
            <div className="text-2xl font-bold">{todayAppts.length}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "مواعيد" : "appointments"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{isAr ? "إجمالي الملفات" : "Total Cases"}</span>
            </div>
            <div className="text-2xl font-bold">{totalCases}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "معيّن" : "assigned"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">{isAr ? "قيد الانتظار" : "Pending"}</span>
            </div>
            <div className="text-2xl font-bold">{(caseCounts["new"] ?? 0) + (caseCounts["contacted"] ?? 0)}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "تحتاج إجراء" : "need action"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">{isAr ? "متأخرة" : "Overdue"}</span>
            </div>
            <div className="text-2xl font-bold text-destructive">{overdueAppts.length}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "تحتاج نتيجة" : "need outcome"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isAr ? "جدول اليوم" : "Today's Schedule"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {isAr ? "جار التحميل..." : "Loading..."}
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {isAr ? "لا توجد مواعيد اليوم" : "No appointments today"}
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">{(a.case as any)?.full_name ?? (isAr ? "غير معروف" : "Unknown")}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(a.scheduled_at), "h:mm a")} · {a.duration_minutes}min
                    </div>
                    {a.notes && <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.outcome ? (
                      <Badge variant="secondary">{a.outcome}</Badge>
                    ) : isPast(new Date(a.scheduled_at)) ? (
                      <Button size="sm" variant="destructive" onClick={() => setOutcomeApptId(a.id)}>
                        {isAr ? "تسجيل النتيجة" : "Record Outcome"}
                      </Button>
                    ) : (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {isAr ? "قادم" : "Upcoming"}
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/team/cases/${a.case_id}`)}>
                      {isAr ? "عرض" : "View"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
