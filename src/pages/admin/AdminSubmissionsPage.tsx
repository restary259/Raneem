import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, ChevronRight, Download, FileText, User, Lock, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  education_level: string | null;
  city: string | null;
  passport_type: string | null;
  student_user_id: string | null;
  submission?: {
    id: string;
    service_fee: number;
    translation_fee: number;
    submitted_at: string | null;
    enrollment_paid_at: string | null;
    program_id: string | null;
    accommodation_id: string | null;
    program_start_date: string | null;
    program_end_date: string | null;
    payment_confirmed: boolean;
    extra_data: Record<string, unknown> | null;
  } | null;
  documents?: Array<{ id: string; file_name: string; file_url: string; category: string; created_at: string }>;
}

const AdminSubmissionsPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";

  const [cases, setCases] = useState<SubmittedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmittedCase | null>(null);
  const [marking, setMarking] = useState(false);

  const [programNames, setProgramNames] = useState<Record<string, string>>({});
  const [accommodationNames, setAccommodationNames] = useState<Record<string, string>>();

  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [reAuthing, setReAuthing] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const casesRes = await supabase
        .from("cases")
        .select("id, full_name, phone_number, status, created_at, education_level, city, passport_type, student_user_id")
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

      if (casesRes.error) throw casesRes.error;
      const ids = (casesRes.data || []).map((c) => c.id);

      if (ids.length === 0) {
        setCases([]);
        setLoading(false);
        return;
      }

      const [subRes, docsRes] = await Promise.all([
        supabase.from("case_submissions").select("*").in("case_id", ids),
        supabase.from("documents").select("id, file_name, file_url, category, created_at, case_id").in("case_id", ids),
      ]);

      const subMap: Record<string, any> = {};
      (subRes.data || []).forEach((s) => { subMap[s.case_id] = s; });

      const docsMap: Record<string, any[]> = {};
      (docsRes.data || []).forEach((d) => {
        if (!docsMap[d.case_id]) docsMap[d.case_id] = [];
        docsMap[d.case_id].push(d);
      });

      const enriched = (casesRes.data || []).map((c) => ({
        ...c,
        submission: subMap[c.id] || null,
        documents: docsMap[c.id] || [],
      }));
      setCases(enriched);

      const programIds = [...new Set(enriched.map((c) => c.submission?.program_id).filter(Boolean) as string[])];
      const accommodationIds = [...new Set(enriched.map((c) => c.submission?.accommodation_id).filter(Boolean) as string[])];

      if (programIds.length > 0) {
        const { data: progData } = await supabase.from("programs").select("id, name_en").in("id", programIds);
        const map: Record<string, string> = {};
        (progData || []).forEach((p: any) => { map[p.id] = p.name_en; });
        setProgramNames(map);
      }

      if (accommodationIds.length > 0) {
        const { data: accomData } = await (supabase as any).from("accommodations").select("id, name_en").in("id", accommodationIds);
        const map: Record<string, string> = {};
        (accomData || []).forEach((a: any) => { map[a.id] = a.name_en; });
        setAccommodationNames(map);
      }
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleReAuth = async () => {
    if (!reAuthPassword.trim() || !user?.email) return;
    setReAuthing(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: reAuthPassword });
      if (error) throw error;
      setShowPasswordGate(false);
      setReAuthPassword("");
      await markEnrolled();
    } catch (err: any) {
      toast({ variant: "destructive", description: t("admin.submissions.incorrectPassword") });
    } finally {
      setReAuthing(false);
    }
  };

  const markEnrolled = async () => {
    if (!selected) return;
    setMarking(true);
    try {
      const { error: caseErr } = await supabase.from("cases").update({ status: "enrollment_paid" }).eq("id", selected.id);
      if (caseErr) throw caseErr;

      if (selected.submission?.id) {
        const { error: subErr } = await supabase
          .from("case_submissions")
          .update({ enrollment_paid_at: new Date().toISOString(), enrollment_paid_by: user?.id })
          .eq("id", selected.submission.id);
        if (subErr) throw subErr;
      }

      await supabase.rpc("log_user_activity" as any, {
        p_action: "MARK_ENROLLED",
        p_target_id: selected.id,
        p_target_table: "cases",
        p_details: `Marked case ${selected.full_name} as enrolled`,
      });

      toast({ description: t("admin.submissions.enrolledSuccess") });
      setSelected(null);
      await fetchCases();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setMarking(false);
    }
  };

  const fmt = (ts: string | null) => {
    if (!ts) return "–";
    return format(new Date(ts), "dd/MM/yyyy");
  };

  const totalFee = (s: SubmittedCase) =>
    ((s.submission?.service_fee || 0) + (s.submission?.translation_fee || 0)).toLocaleString('en-US');

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("admin.submissions.title", "Submitted Applications")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.submissions.subtitle", "Cases awaiting enrollment confirmation")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCases}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t("admin.submissions.empty", "No submitted cases yet")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(c)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.phone_number} · {t("admin.submissions.submittedDate")}:{" "}
                      {fmt(c.submission?.submitted_at || null)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end">
                      <p className="text-sm font-semibold text-foreground">{totalFee(c)} ILS</p>
                      <p className="text-xs text-muted-foreground">{t("admin.submissions.totalFees")}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Case Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {selected?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t("admin.submissions.basicInfo")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.phone")}:</span>
                    <p className="font-medium">{selected.phone_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.city")}:</span>
                    <p className="font-medium">{selected.city || "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.education")}:</span>
                    <p className="font-medium">{selected.education_level || "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.passport")}:</span>
                    <p className="font-medium">{selected.passport_type?.replace(/_/g, " ") || "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.submittedDate")}:</span>
                    <p className="font-medium">{fmt(selected.submission?.submitted_at || null)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.payment")}:</span>
                    <Badge
                      className={
                        selected.submission?.payment_confirmed
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {selected.submission?.payment_confirmed
                        ? t("admin.submissions.paymentConfirmed")
                        : t("admin.submissions.paymentPending")}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t("admin.submissions.paymentDetails")}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.serviceFee")}:</span>
                    <p className="font-medium">{(selected.submission?.service_fee || 0).toLocaleString('en-US')} ILS</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.translationFee")}:</span>
                    <p className="font-medium">{(selected.submission?.translation_fee || 0).toLocaleString('en-US')} ILS</p>
                  </div>
                  {selected.submission?.program_start_date && (
                    <div>
                      <span className="text-muted-foreground">{t("admin.submissions.startDate")}:</span>
                      <p className="font-medium">{fmt(selected.submission.program_start_date)}</p>
                    </div>
                  )}
                  {selected.submission?.program_end_date && (
                    <div>
                      <span className="text-muted-foreground">{t("admin.submissions.endDate")}:</span>
                      <p className="font-medium">{fmt(selected.submission.program_end_date)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">{t("admin.submissions.total")}:</span>
                  <span className="font-bold ms-2 text-foreground">{totalFee(selected)} ILS</span>
                </div>
              </div>

              {/* Program / Accommodation resolved names */}
              {(selected.submission?.program_id || selected.submission?.accommodation_id) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t("admin.submissions.programAccom")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {selected.submission?.program_id && (
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.program")}:</span>
                          <p className="font-medium">
                            {programNames[selected.submission.program_id] || selected.submission.program_id}
                          </p>
                        </div>
                      )}
                      {selected.submission?.accommodation_id && (
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.accommodation")}:</span>
                          <p className="font-medium">
                            {accommodationNames?.[selected.submission.accommodation_id] || selected.submission.accommodation_id}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Extra Profile Data */}
              {selected.submission?.extra_data && Object.keys(selected.submission.extra_data).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t("admin.submissions.studentProfileData")}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(selected.submission.extra_data).map(([key, val]) => {
                        if (!val || val === "") return null;
                        if (key === "program_id" || key === "accommodation_id") return null;
                        const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                        return (
                          <div key={key}>
                            <span className="text-muted-foreground">{label}:</span>
                            <p className="font-medium">{String(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Documents */}
              {selected.documents && selected.documents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> {t("admin.submissions.documents")} ({selected.documents.length})
                    </h3>
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {selected.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.category} · {fmt(doc.created_at)}
                            </p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setSelected(null);
                    navigate(`/team/cases/${selected.id}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("admin.submissions.openFullCase")}
                </Button>
                <Button className="w-full gap-2" onClick={() => setShowPasswordGate(true)} disabled={marking}>
                  <Lock className="h-4 w-4" />
                  {marking ? t("admin.submissions.processing") : t("admin.submissions.markEnrolled", "Mark as Enrolled")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Re-Auth Gate */}
      <Dialog
        open={showPasswordGate}
        onOpenChange={(v) => {
          setShowPasswordGate(v);
          setReAuthPassword("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t("admin.submissions.confirmIdentity")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.submissions.confirmIdentityDesc")}
            </p>
            <div>
              <Label>{t("admin.submissions.password")}</Label>
              <Input
                type="password"
                value={reAuthPassword}
                onChange={(e) => setReAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReAuth()}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordGate(false);
                setReAuthPassword("");
              }}
            >
              {t("admin.submissions.cancel")}
            </Button>
            <Button onClick={handleReAuth} disabled={reAuthing || !reAuthPassword.trim()}>
              {reAuthing ? "..." : t("admin.submissions.confirmEnroll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubmissionsPage;
