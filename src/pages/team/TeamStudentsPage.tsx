import React, { useEffect, useState, useCallback } from "react";
import {
  User,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Mail,
  ChevronRight,
  ChevronLeft,
  X,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface CaseResult {
  id: string;
  full_name: string;
  phone_number: string;
  city: string | null;
  status: string;
}

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  linked_case_id: string | null;
}

/* ─── Helper UI ─────────────────────────────────────────────────────── */
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md ${className}`}
  >
    {children}
  </div>
);

const Badge = ({
  children,
  variant = "outline",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "outline" | "secondary" | "success";
  className?: string;
}) => {
  const styles =
    variant === "outline"
      ? "border-amber-300 text-amber-600 bg-amber-50/50"
      : variant === "success"
        ? "border-green-300 text-green-700 bg-green-50"
        : "bg-slate-100 text-slate-600 border-transparent";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles} ${className}`}>{children}</span>
  );
};

const Btn = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "success";
  size?: "sm" | "md";
}) => {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { toast } = useToast();

  /* ── List state ─────────────────────────────────────────────────────── */
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");

  /* ── Modal state ─────────────────────────────────────────────────────── */
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<"search" | "email">("search");

  /* Step 1 – Case search */
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [matchedCases, setMatchedCases] = useState<CaseResult[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseResult | null>(null);
  const [searching, setSearching] = useState(false);

  /* Step 2 – Account details */
  const [studentEmail, setStudentEmail] = useState("");
  const [creating, setCreating] = useState(false);

  /* Success state */
  const [tempCreds, setTempCreds] = useState<{
    full_name: string;
    email: string;
    password: string | null;
    invited: boolean;
    case_id: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);

  /* ── Load existing students ─────────────────────────────────────────── */
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
        .select("id, full_name, email, created_at, linked_case_id")
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

  /* ── Debounced case search ──────────────────────────────────────────── */
  useEffect(() => {
    const fullName = [firstName, middleName, familyName].filter(Boolean).join(" ").trim();

    // Don't re-search if we just selected a case and the name matches
    if (selectedCase && selectedCase.full_name.toLowerCase() === fullName.toLowerCase()) {
      return;
    }

    if (fullName.length < 2) {
      setMatchedCases([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await (supabase as any)
          .from("cases")
          .select("id, full_name, phone_number, city, status")
          .ilike("full_name", `%${fullName}%`)
          .is("student_user_id", null) // only cases without an account yet
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        setMatchedCases(data ?? []);
      } catch (err: any) {
        console.error("Case search failed:", err);
        setMatchedCases([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [firstName, middleName, familyName, selectedCase]);

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const handleCaseSelect = (c: CaseResult) => {
    setSelectedCase(c);
    const parts = c.full_name.trim().split(/\s+/);
    if (parts.length >= 3) {
      setFirstName(parts[0]);
      setMiddleName(parts.slice(1, -1).join(" "));
      setFamilyName(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      setFirstName(parts[0]);
      setMiddleName("");
      setFamilyName(parts[1]);
    } else {
      setFirstName(c.full_name);
      setMiddleName("");
      setFamilyName("");
    }
    setMatchedCases([]);
  };

  const resetWizard = () => {
    setWizardStep("search");
    setFirstName("");
    setMiddleName("");
    setFamilyName("");
    setMatchedCases([]);
    setSelectedCase(null);
    setStudentEmail("");
  };

  const handleCreateAccount = async () => {
    if (!selectedCase || !studentEmail) return;
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Session expired. Please log in again.");

      const resp = await supabase.functions.invoke("create-student-from-case", {
        body: {
          case_id: selectedCase.id,
          student_email: studentEmail.trim().toLowerCase(),
          student_full_name: selectedCase.full_name,
          student_phone: selectedCase.phone_number,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.error) throw new Error(resp.error.message || "Creation failed");
      const result = resp.data as {
        success: boolean;
        email: string;
        invited: boolean;
        temp_password?: string;
        message: string;
      };

      if (!result.success) throw new Error(result.message || "Creation failed");

      setTempCreds({
        full_name: selectedCase.full_name,
        email: result.email,
        password: result.temp_password ?? null,
        invited: result.invited,
        case_id: selectedCase.id,
      });

      setShowModal(false);
      resetWizard();
      await fetchStudents();

      toast({ title: "Student account created", description: result.message });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  /* ── Filtered list ──────────────────────────────────────────────────── */
  const filteredStudents = students.filter((s) => {
    if (!listSearch) return true;
    const q = listSearch.toLowerCase();
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  });

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">Manage student accounts and link them to cases.</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={fetchStudents} size="sm" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => {
              resetWizard();
              setShowModal(true);
            }}
          >
            <UserPlus className="h-4 w-4 me-2" />
            Create Student Account
          </Btn>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full border border-slate-200 rounded-xl ps-9 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
        />
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin me-2" /> Loading…
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No student accounts yet</h3>
          <p className="text-slate-500 text-sm mt-1">Start by creating an account and linking it to a case file.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((s) => (
            <Card key={s.id} className="p-4 flex items-start gap-3">
              <div className="bg-indigo-50 h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-900 truncate text-sm">{s.full_name || "—"}</h4>
                <div className="text-xs text-slate-500 space-y-0.5 mt-1">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {s.email}
                  </p>
                  <p>{format(new Date(s.created_at), "d MMM yyyy")}</p>
                </div>
                {s.linked_case_id && (
                  <Badge variant="success" className="mt-2">
                    Linked to case
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Wizard Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[500px] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Create Student Account
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step indicator */}
              <div className="flex items-center text-sm font-medium text-slate-400">
                <span className={wizardStep === "search" ? "text-indigo-600 font-bold" : ""}>1. Find Case</span>
                <ChevronRight className="h-4 w-4 mx-2 opacity-40" />
                <span className={wizardStep === "email" ? "text-indigo-600 font-bold" : ""}>2. Set Email</span>
              </div>

              {/* ── Step 1: Search ── */}
              {wizardStep === "search" && (
                <>
                  <p className="text-sm text-slate-600">
                    Enter the student's name to search for a matching case. Selecting a case will automatically import
                    their profile data.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "First Name *",
                        value: firstName,
                        setter: (v: string) => {
                          setFirstName(v);
                          setSelectedCase(null);
                        },
                      },
                      {
                        label: "Middle",
                        value: middleName,
                        setter: (v: string) => {
                          setMiddleName(v);
                          setSelectedCase(null);
                        },
                      },
                      {
                        label: "Family Name *",
                        value: familyName,
                        setter: (v: string) => {
                          setFamilyName(v);
                          setSelectedCase(null);
                        },
                      },
                    ].map(({ label, value, setter }) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">{label}</label>
                        <input
                          className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Search status */}
                  <div className="min-h-[24px]">
                    {searching && (
                      <span className="flex items-center gap-1 text-xs text-indigo-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching cases…
                      </span>
                    )}
                    {!searching && matchedCases.length > 0 && (
                      <span className="text-xs text-slate-500">
                        🔍 {matchedCases.length} matching case(s) — select to link:
                      </span>
                    )}
                    {!searching &&
                      matchedCases.length === 0 &&
                      (firstName.length > 1 || familyName.length > 1) &&
                      !selectedCase && <span className="text-xs text-slate-400">No matching cases found.</span>}
                  </div>

                  {/* Results */}
                  {matchedCases.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {matchedCases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleCaseSelect(c)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                            selectedCase?.id === c.id
                              ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">{c.full_name}</span>
                            <span className="text-xs text-slate-400">{c.phone_number}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {c.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          {selectedCase?.id === c.id && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCase && (
                    <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Case selected — profile data will be imported
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Btn variant="ghost" onClick={() => setShowModal(false)}>
                      Cancel
                    </Btn>
                    <Btn disabled={!selectedCase} onClick={() => setWizardStep("email")}>
                      Next <ChevronRight className="h-4 w-4 ms-1" />
                    </Btn>
                  </div>
                </>
              )}

              {/* ── Step 2: Email ── */}
              {wizardStep === "email" && (
                <>
                  {/* Selected case summary */}
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 space-y-0.5">
                    <p className="text-xs text-indigo-600 font-bold uppercase">Linked Case</p>
                    <p className="text-sm font-semibold text-indigo-900">{selectedCase?.full_name}</p>
                    <p className="text-xs text-indigo-500">
                      {selectedCase?.phone_number}
                      {selectedCase?.city ? ` • ${selectedCase.city}` : ""}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Student Email Address *</label>
                    <input
                      className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.com"
                      type="email"
                    />
                    <p className="text-xs text-slate-400">
                      An invite email will be sent. If email delivery fails, a temporary password will be generated
                      instead.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Btn variant="ghost" onClick={() => setWizardStep("search")}>
                      <ChevronLeft className="h-4 w-4 me-1" /> Back
                    </Btn>
                    <Btn onClick={handleCreateAccount} disabled={creating || !studentEmail.includes("@")}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                      {creating ? "Creating…" : "Create Account"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ───────────────────────────────────────────────── */}
      {tempCreds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            {/* Icon */}
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-xl font-bold">Account Created!</h3>
              <p className="text-sm text-slate-500">
                {tempCreds.invited
                  ? "An invite email has been sent to the student."
                  : "Share these credentials with the student. The password is shown only once."}
              </p>
            </div>

            {/* Credentials */}
            <div className="space-y-2 text-left">
              {/* Email */}
              <div className="p-3 bg-slate-50 rounded-xl border text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                  <p className="font-medium truncate">{tempCreds.email}</p>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(tempCreds.email);
                    setCopiedEmail(true);
                    setTimeout(() => setCopiedEmail(false), 2000);
                  }}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  {copiedEmail ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {/* Password (only if invite failed) */}
              {!tempCreds.invited && tempCreds.password && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-amber-600 uppercase">Temp Password (one-time)</p>
                    <p className="font-bold text-amber-900 tracking-wider">{tempCreds.password}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(tempCreds.password ?? "");
                      setCopiedPw(true);
                      setTimeout(() => setCopiedPw(false), 2000);
                    }}
                    className="text-amber-500 hover:text-amber-700 shrink-0"
                  >
                    {copiedPw ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {tempCreds.invited && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  ✅ Invite email sent — the student will set their own password.
                </p>
              )}
            </div>

            <Btn variant="ghost" className="w-full" onClick={() => setTempCreds(null)}>
              Done
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
