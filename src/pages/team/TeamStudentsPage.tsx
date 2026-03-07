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
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");

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
          .is("student_user_id", null)
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

      toast({ title: t("team.students.accountCreated", "Student account created"), description: result.message });
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
    <div className="p-4 sm:p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("team.students.title", "Students")}</h1>
          <p className="text-sm text-muted-foreground">{t("team.students.subtitle", "Manage student accounts and link them to cases.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStudents} title={t("common.refresh", "Refresh")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              resetWizard();
              setShowModal(true);
            }}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t("team.students.createAccount", "Create Student Account")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder={t("team.students.searchPlaceholder", "Search by name or email…")}
          className="ps-9"
        />
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" /> {t("common.loading", "Loading…")}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">{t("team.students.noStudents", "No student accounts yet")}</h3>
          <p className="text-muted-foreground text-sm mt-1">{t("team.students.noStudentsHint", "Start by creating an account and linking it to a case file.")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-primary/10 h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate text-sm">{s.full_name || "—"}</h4>
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {s.email}
                    </p>
                    <p>{format(new Date(s.created_at), "d MMM yyyy")}</p>
                  </div>
                  {s.linked_case_id && (
                    <Badge variant="secondary" className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                      {t("team.students.linkedToCase", "Linked to case")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Wizard Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-[500px] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <UserPlus className="h-5 w-5 text-primary" />
                {t("team.students.createAccount", "Create Student Account")}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step indicator */}
              <div className="flex items-center text-sm font-medium text-muted-foreground">
                <span className={wizardStep === "search" ? "text-primary font-bold" : ""}>{t("team.students.step1", "1. Find Case")}</span>
                <ChevronRight className="h-4 w-4 mx-2 opacity-40" />
                <span className={wizardStep === "email" ? "text-primary font-bold" : ""}>{t("team.students.step2", "2. Set Email")}</span>
              </div>

              {/* ── Step 1: Search ── */}
              {wizardStep === "search" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("team.students.searchHint", "Enter the student's name to search for a matching case. Selecting a case will automatically import their profile data.")}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: t("team.students.firstName", "First Name *"),
                        value: firstName,
                        setter: (v: string) => { setFirstName(v); setSelectedCase(null); },
                      },
                      {
                        label: t("team.students.middleName", "Middle"),
                        value: middleName,
                        setter: (v: string) => { setMiddleName(v); setSelectedCase(null); },
                      },
                      {
                        label: t("team.students.familyName", "Family Name *"),
                        value: familyName,
                        setter: (v: string) => { setFamilyName(v); setSelectedCase(null); },
                      },
                    ].map(({ label, value, setter }) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground">{label}</label>
                        <input
                          className="w-full p-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-ring outline-none bg-background text-foreground"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Search status */}
                  <div className="min-h-[24px]">
                    {searching && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("team.students.searching", "Searching cases…")}
                      </span>
                    )}
                    {!searching && matchedCases.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        🔍 {matchedCases.length} {t("team.students.matchingCases", "matching case(s) — select to link:")}
                      </span>
                    )}
                    {!searching &&
                      matchedCases.length === 0 &&
                      (firstName.length > 1 || familyName.length > 1) &&
                      !selectedCase && (
                        <span className="text-xs text-muted-foreground">{t("team.students.noMatchingCases", "No matching cases found.")}</span>
                      )}
                  </div>

                  {/* Results */}
                  {matchedCases.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {matchedCases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleCaseSelect(c)}
                          className={`w-full text-start p-3 rounded-xl border transition-all flex items-center justify-between ${
                            selectedCase?.id === c.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-border/80 bg-card"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{c.full_name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone_number}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {c.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          {selectedCase?.id === c.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCase && (
                    <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {t("team.students.caseSelected", "Case selected — profile data will be imported")}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <Button variant="ghost" onClick={() => setShowModal(false)}>
                      {t("common.cancel", "Cancel")}
                    </Button>
                    <Button disabled={!selectedCase} onClick={() => setWizardStep("email")} className="gap-1">
                      {t("common.next", "Next")} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 2: Email ── */}
              {wizardStep === "email" && (
                <>
                  {/* Selected case summary */}
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-0.5">
                    <p className="text-xs text-primary font-bold uppercase">{t("team.students.linkedCase", "Linked Case")}</p>
                    <p className="text-sm font-semibold text-foreground">{selectedCase?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCase?.phone_number}
                      {selectedCase?.city ? ` • ${selectedCase.city}` : ""}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">{t("team.students.emailLabel", "Student Email Address *")}</label>
                    <input
                      className="w-full p-3 border border-input rounded-xl text-sm focus:ring-2 focus:ring-ring outline-none bg-background text-foreground"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.com"
                      type="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("team.students.emailHint", "A temporary password will be generated for the student.")}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border">
                    <Button variant="ghost" onClick={() => setWizardStep("search")} className="gap-1">
                      <ChevronLeft className="h-4 w-4" /> {t("common.back", "Back")}
                    </Button>
                    <Button onClick={handleCreateAccount} disabled={creating || !studentEmail.includes("@")} className="gap-2">
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {creating ? t("team.students.creating", "Creating…") : t("team.students.createAccount", "Create Account")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ───────────────────────────────────────────────── */}
      {tempCreds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-sm p-6 space-y-5">
            {/* Icon */}
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground">{t("team.students.accountCreated", "Account Created!")}</h3>
              <p className="text-sm text-muted-foreground">
                {tempCreds.invited
                  ? t("team.students.inviteSent", "An invite email has been sent to the student.")
                  : t("team.students.shareCredentials", "Share these credentials with the student. The password is shown only once.")}
              </p>
            </div>

            {/* Credentials */}
            <div className="space-y-2">
              {/* Email */}
              <div className="p-3 bg-muted rounded-xl border border-border text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("common.email", "Email")}</p>
                  <p className="font-medium truncate text-foreground">{tempCreds.email}</p>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(tempCreds.email);
                    setCopiedEmail(true);
                    setTimeout(() => setCopiedEmail(false), 2000);
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  {copiedEmail ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {/* Password */}
              {!tempCreds.invited && tempCreds.password && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-amber-600 uppercase">{t("team.students.tempPassword", "Temp Password (one-time)")}</p>
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
                    {copiedPw ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {tempCreds.invited && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  ✅ {t("team.students.inviteNote", "Invite email sent — the student will set their own password.")}
                </p>
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setTempCreds(null)}>
              {t("common.done", "Done")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
