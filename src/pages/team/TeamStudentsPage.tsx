import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  User,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Search,
  X,
  ChevronRight,
  CheckCircle2,
  FileText,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface CaseRecord {
  id: string;
  full_name: string;
  phone_number: string;
  city: string | null;
  status: string;
  education_level: string | null;
  degree_interest: string | null;
  intake_notes: string | null;
  created_at: string;
  source: string;
}

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  case_id: string | null;
}

/* ─── Status colour map ─────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  appointment_scheduled: "bg-purple-50 text-purple-700 border-purple-200",
  profile_completion: "bg-orange-50 text-orange-700 border-orange-200",
  payment_confirmed: "bg-teal-50 text-teal-700 border-teal-200",
  submitted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  enrollment_paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  forgotten: "bg-slate-50 text-slate-500 border-slate-200",
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  /* ── Student list state ──────────────────────────────────────────── */
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");

  /* ── Modal state ─────────────────────────────────────────────────── */
  const [showModal, setShowModal] = useState(false);

  /* All unlinked cases (loaded when modal opens) */
  const [allCases, setAllCases] = useState<CaseRecord[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);

  /* Email input */
  const [studentEmail, setStudentEmail] = useState("");
  const [creating, setCreating] = useState(false);

  /* Success modal */
  const [tempCreds, setTempCreds] = useState<{
    full_name: string;
    email: string;
    password: string | null;
    case_id: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);

  /* ── Load existing student accounts ────────────────────────────── */
  const fetchStudents = useCallback(async () => {
    setListLoading(true);
    try {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const ids = (roleData ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) {
        setStudents([]);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, created_at, case_id")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setStudents(data ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setListLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* ── Load all unlinked cases when modal opens ───────────────────── */
  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("cases")
        .select(
          "id, full_name, phone_number, city, status, education_level, degree_interest, intake_notes, created_at, source",
        )
        .is("student_user_id", null)
        .not("status", "in", '("cancelled","forgotten")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAllCases(data ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCasesLoading(false);
    }
  }, [toast]);

  const openModal = () => {
    setSelectedCase(null);
    setStudentEmail("");
    setCaseSearch("");
    setShowModal(true);
    loadCases();
  };

  /* ── Filter cases by search ─────────────────────────────────────── */
  const filteredCases = useMemo(() => {
    if (!caseSearch.trim()) return allCases;
    const q = caseSearch.toLowerCase();
    return allCases.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone_number?.includes(q) ||
        (c.city ?? "").toLowerCase().includes(q),
    );
  }, [allCases, caseSearch]);

  /* ── Create account ─────────────────────────────────────────────── */
  const handleCreateAccount = async () => {
    if (!selectedCase || !studentEmail.includes("@")) return;
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token)
        throw new Error(isRtl ? "انتهت الجلسة، يرجى تسجيل الدخول مجدداً" : "Session expired. Please log in again.");

      const resp = await supabase.functions.invoke("create-student-from-case", {
        body: {
          case_id: selectedCase.id,
          student_email: studentEmail.trim().toLowerCase(),
          student_full_name: selectedCase.full_name,
          student_phone: selectedCase.phone_number,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.error) throw new Error(resp.error.message || (isRtl ? "فشل إنشاء الحساب" : "Creation failed"));
      const result = resp.data as {
        success: boolean;
        email: string;
        temp_password?: string;
        message: string;
      };
      if (!result.success) throw new Error(result.message || (isRtl ? "فشل إنشاء الحساب" : "Creation failed"));

      setShowModal(false);
      setTempCreds({
        full_name: selectedCase.full_name,
        email: result.email,
        password: result.temp_password ?? null,
        case_id: selectedCase.id,
      });

      await fetchStudents();
      toast({ title: isRtl ? "تم إنشاء الحساب" : "Account created", description: result.message });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  /* ── Filtered student list ──────────────────────────────────────── */
  const filteredStudents = students.filter((s) => {
    if (!listSearch) return true;
    const q = listSearch.toLowerCase();
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  });

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-50 min-h-screen">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("team.students.title", "Students")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("team.students.subtitle", "Manage student accounts and link them to cases.")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchStudents}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
            title={isRtl ? "تحديث" : "Refresh"}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {t("team.students.createAccount", "Create Student Account")}
          </button>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder={t("team.students.searchPlaceholder", "Search by name or email...")}
          className="w-full border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
        />
      </div>

      {/* ── Student list ──────────────────────────────────────────── */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          {isRtl ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            {t("team.students.noStudents", "No student accounts yet")}
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            {t("team.students.noStudentsHint", "Start by creating an account and linking it to a case file.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow"
            >
              <div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{s.full_name || "—"}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  {s.email}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{format(new Date(s.created_at), "d MMM yyyy")}</p>
                {s.case_id && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    {isRtl ? "مرتبط بملف" : "Linked to case"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CREATE ACCOUNT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-indigo-600" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {t("team.students.createAccount", "Create Student Account")}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ── Step 1: Case selector ─────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{isRtl ? "١. اختر الملف" : "1. Select a case"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl
                      ? "جميع الملفات غير المرتبطة بحساب — اكتب للبحث أو تصفح القائمة"
                      : "All cases without an account — type to filter or scroll the list"}
                  </p>
                </div>

                {/* Search within cases */}
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    placeholder={isRtl ? "ابحث بالاسم أو الهاتف أو المدينة…" : "Search by name, phone, or city…"}
                    className="w-full border border-slate-200 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                    autoFocus
                  />
                </div>

                {/* Cases list */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {casesLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin me-2" />
                      {isRtl ? "جارٍ التحميل…" : "Loading cases…"}
                    </div>
                  ) : filteredCases.length === 0 ? (
                    <div className="py-8 text-center">
                      <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">
                        {caseSearch
                          ? isRtl
                            ? "لا توجد نتائج"
                            : "No matching cases"
                          : isRtl
                            ? "لا توجد ملفات متاحة"
                            : "No available cases"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredCases.map((c) => {
                        const isSelected = selectedCase?.id === c.id;
                        const statusColor = STATUS_COLORS[c.status] ?? "bg-slate-50 text-slate-600 border-slate-200";
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCase(isSelected ? null : c)}
                            className={`w-full text-start px-4 py-3 flex items-start gap-3 transition-colors ${
                              isSelected ? "bg-indigo-50 border-s-2 border-s-indigo-600" : "hover:bg-slate-50"
                            }`}
                          >
                            {/* Selection indicator */}
                            <div
                              className={`h-4 w-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                                isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="h-2.5 w-2.5 text-white m-auto block mt-px" />}
                            </div>

                            {/* Case info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}
                                >
                                  {c.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                                {c.phone_number && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {c.phone_number}
                                  </span>
                                )}
                                {c.city && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {c.city}
                                  </span>
                                )}
                                {c.intake_notes && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {c.intake_notes}
                                  </span>
                                )}
                              </div>
                              {(c.education_level || c.degree_interest) && (
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                  {c.education_level && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                                      {c.education_level}
                                    </span>
                                  )}
                                  {c.degree_interest && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                                      {c.degree_interest}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Count indicator */}
                {!casesLoading && (
                  <p className="text-xs text-slate-400 text-end">
                    {filteredCases.length} {isRtl ? "ملف متاح" : "case(s) available"}
                    {caseSearch && ` · ${allCases.length} ${isRtl ? "إجمالاً" : "total"}`}
                  </p>
                )}
              </div>

              {/* ── Selected case preview ─────────────────────────── */}
              {selectedCase && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                      {isRtl ? "الملف المختار — سيتم استيراد بياناته" : "Selected case — data will be imported"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <InfoPill label={isRtl ? "الاسم" : "Name"} value={selectedCase.full_name} />
                    <InfoPill label={isRtl ? "الهاتف" : "Phone"} value={selectedCase.phone_number} />
                    {selectedCase.city && <InfoPill label={isRtl ? "المدينة" : "City"} value={selectedCase.city} />}
                    {selectedCase.intake_notes && (
                      <InfoPill label={isRtl ? "دفعة القبول" : "Intake"} value={selectedCase.intake_notes} />
                    )}
                    {selectedCase.education_level && (
                      <InfoPill label={isRtl ? "التعليم" : "Education"} value={selectedCase.education_level} />
                    )}
                    {selectedCase.degree_interest && (
                      <InfoPill label={isRtl ? "التخصص" : "Degree"} value={selectedCase.degree_interest} />
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Email ─────────────────────────────────── */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {isRtl ? "٢. أدخل البريد الإلكتروني" : "2. Enter email address"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl
                      ? "سيتم إنشاء كلمة مرور مؤقتة ويجب على الطالب تغييرها عند أول تسجيل دخول"
                      : "A temporary password will be created. The student must change it on first login."}
                  </p>
                </div>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
                  placeholder={isRtl ? "student@example.com" : "student@example.com"}
                  disabled={!selectedCase}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50/50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={creating || !selectedCase || !studentEmail.includes("@")}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isRtl ? "جارٍ الإنشاء…" : "Creating…"}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {isRtl ? "إنشاء الحساب" : "Create Account"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SUCCESS MODAL — shows credentials after creation
      ══════════════════════════════════════════════════════════════ */}
      {tempCreds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Green top banner */}
            <div className="bg-emerald-500 px-6 py-5 text-center">
              <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">{isRtl ? "تم إنشاء الحساب!" : "Account Created!"}</h3>
              <p className="text-emerald-100 text-xs mt-1">
                {isRtl ? "للطالب: " : "For: "}
                {tempCreds.full_name}
              </p>
            </div>

            <div className="p-5 space-y-3">
              {/* Warning notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {isRtl
                    ? "شارك هذه البيانات مع الطالب مباشرة. كلمة المرور تظهر مرة واحدة فقط ويجب تغييرها عند أول دخول."
                    : "Share these credentials with the student directly. The password is shown only once and must be changed on first login."}
                </p>
              </div>

              {/* Email credential row */}
              <CredentialRow
                label={isRtl ? "البريد الإلكتروني" : "Email"}
                value={tempCreds.email}
                copied={copiedEmail}
                onCopy={async () => {
                  await navigator.clipboard.writeText(tempCreds.email);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }}
              />

              {/* Password credential row */}
              {tempCreds.password && (
                <CredentialRow
                  label={isRtl ? "كلمة المرور المؤقتة" : "Temporary Password"}
                  value={tempCreds.password}
                  copied={copiedPw}
                  highlight
                  onCopy={async () => {
                    await navigator.clipboard.writeText(tempCreds.password ?? "");
                    setCopiedPw(true);
                    setTimeout(() => setCopiedPw(false), 2000);
                  }}
                />
              )}

              {/* Imported data note */}
              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <FileText className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  {isRtl
                    ? "تم استيراد بيانات الملف (الاسم، الهاتف، المدينة، دفعة القبول) إلى حساب الطالب تلقائياً."
                    : "Case data (name, phone, city, intake month) has been automatically imported to the student account."}
                </p>
              </div>

              <button
                onClick={() => setTempCreds(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {isRtl ? "تم" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small helper components ────────────────────────────────────────── */

function InfoPill({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-indigo-400">{label}: </span>
      <span className="text-indigo-800 font-medium">{value}</span>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  highlight = false,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  highlight?: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
        highlight ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase mb-0.5 ${highlight ? "text-amber-500" : "text-slate-400"}`}>
          {label}
        </p>
        <p className={`text-sm font-mono font-semibold truncate ${highlight ? "text-amber-900" : "text-slate-800"}`}>
          {value}
        </p>
      </div>
      <button
        onClick={onCopy}
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
          highlight
            ? "hover:bg-amber-100 text-amber-400 hover:text-amber-700"
            : "hover:bg-slate-200 text-slate-400 hover:text-slate-700"
        }`}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
