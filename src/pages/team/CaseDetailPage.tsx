import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Calendar,
  FileText,
  User,
  DollarSign,
  Download,
  Check,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

const PIPELINE_STAGES = [
  "new",
  "contacted",
  "appointment_scheduled",
  "profile_completion",
  "payment_confirmed",
  "submitted",
  "enrollment_paid",
];

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

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

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
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (!caseData) {
    return <div className="p-6 text-muted-foreground">Case not found</div>;
  }

  const pendingAppt = appointments.find((a) => !a.outcome);
  const passportDocs = documents.filter((d) => d.category === "passport");
  const daysInactive = Math.floor((Date.now() - new Date(caseData.last_activity_at).getTime()) / 86400000);
  const needsAttention = daysInactive > 3 || !submission?.payment_confirmed || passportDocs.length === 0;

  // Financial calcs
  const serviceFee = submission?.service_fee || 0;
  const programPrice = submission?.program_price || 0;
  const accommodationPrice = submission?.accommodation_price || 0;
  const insurancePrice = submission?.insurance_price || 0;
  const totalDue = serviceFee + programPrice + accommodationPrice + insurancePrice;
  const amountPaid = submission?.payment_confirmed ? serviceFee : 0;
  const outstanding = totalDue - amountPaid;
  const percentPaid = totalDue > 0 ? (amountPaid / totalDue) * 100 : 0;

  const currentIndex = PIPELINE_STAGES.indexOf(caseData.status);

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{caseData.full_name}</h1>
            <p className="text-xs text-muted-foreground">ID: {id?.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex gap-2">
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

      {/* Status & Time */}
      <div className="flex items-center gap-2">
        <Badge className={STATUS_COLORS[caseData.status] ?? "bg-muted"}>
          {t(`case.status.${caseData.status}`, caseData.status)}
        </Badge>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(caseData.last_activity_at), { addSuffix: true })}
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <React.Fragment key={stage}>
              {idx > 0 && <div className={`h-0.5 w-4 ${isDone ? "bg-green-400" : "bg-border"}`} />}
              <div className={`flex flex-col items-center gap-1 ${idx > currentIndex && "opacity-40"}`}>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isDone ? "bg-green-100 border-green-400 text-green-700" : ""
                  } ${isCurrent ? "bg-blue-100 border-blue-400 text-blue-700 ring-2 ring-blue-300" : ""} ${
                    idx > currentIndex ? "bg-gray-100 border-gray-300" : ""
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Alert */}
      {needsAttention && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 ml-2">
            <p className="font-semibold mb-1">Needs attention now</p>
            {daysInactive > 3 && <p>⏱️ No activity for {daysInactive} days</p>}
            {!submission?.payment_confirmed && <p>💳 Payment confirmation is overdue</p>}
            {passportDocs.length === 0 && <p>📄 Passport copy missing</p>}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tabs Section */}
        <div className="lg:col-span-2">
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-4 pt-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
                <TabsTrigger value="program">Program</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview">
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Docs</p>
                      <p className="text-2xl font-bold">{documents.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Appts</p>
                      <p className="text-2xl font-bold">{appointments.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="text-2xl font-bold">{submission?.payment_confirmed ? "✓" : "⏳"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Age</p>
                      <p className="text-2xl font-bold">
                        {Math.floor((Date.now() - new Date(caseData.created_at).getTime()) / 86400000)}d
                      </p>
                    </div>
                  </div>

                  {pendingAppt && (
                    <div className="border-l-4 border-blue-500 pl-4 py-2">
                      <p className="text-sm font-semibold">Next Appointment</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(pendingAppt.scheduled_at), "MMM d, yyyy @ h:mm a")}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    {caseData.city && (
                      <div>
                        <p className="text-xs text-muted-foreground">City</p>
                        <p className="text-sm font-medium">{caseData.city}</p>
                      </div>
                    )}
                    {caseData.education_level && (
                      <div>
                        <p className="text-xs text-muted-foreground">Education</p>
                        <p className="text-sm font-medium">{caseData.education_level}</p>
                      </div>
                    )}
                    {caseData.english_level && (
                      <div>
                        <p className="text-xs text-muted-foreground">English</p>
                        <p className="text-sm font-medium">{caseData.english_level}</p>
                      </div>
                    )}
                    {caseData.degree_interest && (
                      <div>
                        <p className="text-xs text-muted-foreground">Degree</p>
                        <p className="text-sm font-medium">{caseData.degree_interest}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </TabsContent>

              {/* Student */}
              <TabsContent value="student">
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase mb-3">Personal</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Name</label>
                          <p className="text-sm font-medium">{caseData.full_name}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Phone</label>
                          <p className="text-sm font-medium">{caseData.phone_number}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase mb-3">Academic</p>
                      <div className="space-y-3">
                        {caseData.bagrut_score && (
                          <div>
                            <label className="text-xs text-muted-foreground">Bagrut</label>
                            <p className="text-sm font-medium">{caseData.bagrut_score}</p>
                          </div>
                        )}
                        {caseData.english_units && (
                          <div>
                            <label className="text-xs text-muted-foreground">English Units</label>
                            <p className="text-sm font-medium">{caseData.english_units}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </TabsContent>

              {/* Program */}
              <TabsContent value="program">
                <CardContent className="space-y-4 pt-6">
                  {submission?.program_start_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium">{submission.program_start_date}</p>
                    </div>
                  )}
                  {submission?.program_end_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="text-sm font-medium">{submission.program_end_date}</p>
                    </div>
                  )}
                  {submission?.program_price && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground">Program Price</p>
                      <p className="text-sm font-medium">€{submission.program_price.toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Financial */}
              <TabsContent value="financial">
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-3">
                    {serviceFee > 0 && (
                      <div className="flex justify-between text-sm py-2 px-2 rounded-lg bg-muted/50">
                        <span>Service Fee</span>
                        <span className="font-medium">₪{serviceFee.toLocaleString()}</span>
                      </div>
                    )}
                    {programPrice > 0 && (
                      <div className="flex justify-between text-sm py-2 px-2 rounded-lg bg-muted/50">
                        <span>Program</span>
                        <span className="font-medium">€{programPrice.toLocaleString()}</span>
                      </div>
                    )}
                    {accommodationPrice > 0 && (
                      <div className="flex justify-between text-sm py-2 px-2 rounded-lg bg-muted/50">
                        <span>Accommodation</span>
                        <span className="font-medium">€{accommodationPrice.toLocaleString()}/mo</span>
                      </div>
                    )}
                    {insurancePrice > 0 && (
                      <div className="flex justify-between text-sm py-2 px-2 rounded-lg bg-muted/50">
                        <span>Insurance</span>
                        <span className="font-medium">€{insurancePrice.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between font-semibold">
                      <span>Total Due</span>
                      <span>₪{totalDue.toLocaleString()}</span>
                    </div>
                    <div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${percentPaid}%` }} />
                      </div>
                      <p className="text-xs text-center text-muted-foreground mt-1">{Math.round(percentPaid)}%</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Outstanding</span>
                      <span className="font-semibold text-amber-600">₪{outstanding.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </TabsContent>

              {/* Documents */}
              <TabsContent value="documents">
                <CardContent className="space-y-4 pt-6">
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents</p>
                  ) : (
                    <div className="divide-y">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">{doc.category}</p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar: Financial Summary */}
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
                      <span className="text-muted-foreground">Service:</span>
                      <span>₪{serviceFee.toLocaleString()}</span>
                    </div>
                    {programPrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Program:</span>
                        <span>€{programPrice.toLocaleString()}</span>
                      </div>
                    )}
                    {accommodationPrice > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Accom:</span>
                        <span>€{accommodationPrice.toLocaleString()}/mo</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold mb-2">
                      <span>Total:</span>
                      <span>₪{totalDue.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: `${percentPaid}%` }} />
                    </div>
                    <div className="text-xs text-center mb-2">{Math.round(percentPaid)}% Complete</div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Paid:</span>
                      <span>₪{amountPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600 font-semibold">
                      <span>Outstanding:</span>
                      <span>₪{outstanding.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button size="sm" className="w-full">
                    Confirm Payment
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No submission</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
