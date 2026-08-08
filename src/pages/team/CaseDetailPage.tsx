import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Phone,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Calendar,
  FileText,
  User,
  DollarSign,
  Download,
  Trash2,
  Activity,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CaseFinancialSummary from "@/components/cases/CaseFinancialSummary";
import CaseTimeline from "@/components/cases/CaseTimeline";
import CaseOverviewTab from "@/components/cases/CaseOverviewTab";
import CaseStudentTab from "@/components/cases/CaseStudentTab";
import CaseProgramTab from "@/components/cases/CaseProgramTab";
import CaseActivityTab from "@/components/cases/CaseActivityTab";
import CaseStatusPipeline from "@/components/cases/CaseStatusPipeline";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
  student_user_id: string | null;
  partner_id: string | null;
  city: string | null;
  education_level: string | null;
  bagrut_score: number | null;
  english_level: string | null;
  english_units: number | null;
  math_units: number | null;
  passport_type: string | null;
  degree_interest: string | null;
  intake_notes: string | null;
  created_by_team: boolean;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  outcome: string | null;
  notes: string | null;
  outcome_notes: string | null;
}

interface Submission {
  id: string;
  program_id: string | null;
  accommodation_id: string | null;
  program_start_date: string | null;
  program_end_date: string | null;
  service_fee: number;
  payment_confirmed: boolean;
  extra_data: Record<string, unknown> | null;
  submitted_at: string | null;
  program_price: number;
  accommodation_price: number;
  insurance_price: number;
}

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string;
  created_at: string;
  notes: string | null;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PIPELINE_STAGES = [
  "new",
  "contacted",
  "appointment_scheduled",
  "profile_completion",
  "payment_confirmed",
  "submitted",
  "enrollment_paid",
];

const PIPELINE_LABELS: Record<string, string> = {
  new: "case.status.new",
  contacted: "case.status.contacted",
  appointment_scheduled: "case.status.appointment_scheduled",
  profile_completion: "case.status.profile_completion",
  payment_confirmed: "case.status.payment_confirmed",
  submitted: "case.status.submitted",
  enrollment_paid: "case.status.enrollment_paid",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  appointment_scheduled: "bg-purple-100 text-purple-800",
  profile_completion: "bg-orange-100 text-orange-800",
  payment_confirmed: "bg-emerald-100 text-emerald-800",
  submitted: "bg-teal-100 text-teal-800",
  enrollment_paid: "bg-green-100 text-green-800",
  forgotten: "bg-red-100 text-red-800",
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  /* ── Data Fetching ───────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes, docsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase.from("appointments").select("*").eq("case_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("case_submissions").select("*").eq("case_id", id).maybeSingle(),
        supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
      ]);

      if (caseRes.error) throw caseRes.error;
      setCaseData(caseRes.data as unknown as Case);
      setAppointments((apptRes.data as Appointment[]) ?? []);
      setSubmission((subRes.data as unknown as Submission) ?? null);
      setDocuments((docsRes.data as Document[]) ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">{t("case.detail.loading")}</div>
    );
  }

  if (!caseData) {
    return <div className="p-6 text-muted-foreground">{t("case.detail.notFound")}</div>;
  }

  const pendingAppt = appointments.find((a) => !a.outcome);
  const daysInactive = Math.floor((Date.now() - new Date(caseData.last_activity_at).getTime()) / 86400000);
  const needsAttention =
    daysInactive > 3 ||
    !submission?.payment_confirmed ||
    documents.filter((d) => d.category === "passport").length === 0;

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Case Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{caseData.full_name}</h1>
            <p className="text-xs text-muted-foreground">
              ID: {id?.slice(0, 8).toUpperCase()}... | Case #{id?.slice(-4)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-2">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Call</span>
          </Button>
          <Button size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Button>
        </div>
      </div>

      {/* ── Quick Info Row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={STATUS_COLORS[caseData.status] ?? "bg-muted"}>
          {t(`case.status.${caseData.status}`, caseData.status)}
        </Badge>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(caseData.last_activity_at), {
            addSuffix: true,
          })}
        </div>
      </div>

      {/* ── Status Pipeline ─────────────────────────────────────────────── */}
      <CaseStatusPipeline currentStatus={caseData.status} stages={PIPELINE_STAGES} labels={PIPELINE_LABELS} />

      {/* ── Alert Banner (Needs Attention) ──────────────────────────────── */}
      {needsAttention && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <div className="space-y-1">
              {daysInactive > 3 && <p>⏱️ No activity for {daysInactive} days. Consider following up.</p>}
              {!submission?.payment_confirmed && <p>💳 Payment confirmation is pending.</p>}
              {documents.filter((d) => d.category === "passport").length === 0 && <p>📄 Passport copy is missing.</p>}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Main Content Grid (Tabs + Financial Summary) ──────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Tabs (Takes 2 columns on large screens) */}
        <div className="lg:col-span-2">
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-4 pt-4">
                <TabsTrigger value="overview" className="border-b-2">
                  <span className="hidden sm:inline">Overview</span>
                  <span className="sm:hidden">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="student" className="border-b-2">
                  Student
                </TabsTrigger>
                <TabsTrigger value="program" className="border-b-2">
                  Program
                </TabsTrigger>
                <TabsTrigger value="financial" className="border-b-2">
                  Financial
                </TabsTrigger>
                <TabsTrigger value="activity" className="border-b-2">
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <CaseOverviewTab
                  caseData={caseData}
                  submission={submission}
                  documents={documents}
                  appointments={appointments}
                  pendingAppt={pendingAppt}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="student">
                <CaseStudentTab caseData={caseData} submission={submission} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="program">
                <CaseProgramTab submission={submission} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="financial">
                <CaseFinancialSummary caseId={id!} submission={submission} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="activity">
                <CaseActivityTab caseId={id!} onRefresh={fetchData} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right: Financial Summary Sidebar (1 column on large screens) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service Fee:</span>
                      <span className="font-medium">₪{submission.service_fee.toLocaleString()}</span>
                    </div>
                    {submission.program_price > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Program:</span>
                        <span className="font-medium">€{submission.program_price.toLocaleString()}</span>
                      </div>
                    )}
                    {submission.accommodation_price > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Accommodation:</span>
                        <span className="font-medium">€{submission.accommodation_price.toLocaleString()}/mo</span>
                      </div>
                    )}
                    {submission.insurance_price > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Insurance:</span>
                        <span className="font-medium">€{submission.insurance_price.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold">
                      <span>Status:</span>
                      <Badge variant={submission.payment_confirmed ? "default" : "secondary"}>
                        {submission.payment_confirmed ? "✓ Paid" : "⏳ Pending"}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      // Handle payment confirmation
                      toast({
                        title: "Payment confirmed",
                        description: "The payment has been recorded.",
                      });
                    }}
                  >
                    Confirm Payment
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No submission data yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
