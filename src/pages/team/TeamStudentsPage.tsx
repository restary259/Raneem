import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ChevronRight,
  ChevronLeft,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  must_change_password: boolean;
  city: string | null;
  created_by: string | null;
}

interface MatchedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  city: string | null;
}

interface TempCredentials {
  email: string;
  password: string;
  full_name: string;
}

interface CreatorProfile {
  id: string;
  full_name: string | null;
  email: string;
}

/* ── Wizard steps ── FIX #1: removed unused "done" step ────────────── */
type WizardStep = "search" | "email";

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  /* ── Create Student wizard state ── */
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("search");

  // Step 1 — Search
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [matchedCases, setMatchedCases] = useState<MatchedCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<MatchedCase | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2 — Email
  const [studentEmail, setStudentEmail] = useState("");

  // Submitting / result
  const [creating, setCreating] = useState(false);
  const [tempCreds, setTempCreds] = useState<TempCredentials | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  /* ─────────────────────────────────────────────────────────────────────
     FIX #3 + Reset wizard — now also clears tempCreds
  ─────────────────────────────────────────────────────────────────────── */
  const resetWizard = useCallback(() => {
    setWizardStep("search");
    setFirstName("");
    setMiddleName("");
    setFamilyName("");
    setMatchedCases([]);
    setSelectedCase(null);
    setStudentEmail("");
    setCreating(false);
    setTempCreds(null); // ✅ FIX #3 — was missing
  }, []);

  /* ─────────────────────────────────────────────────────────────────────
     Fetch all students
     FIX #5 — Fallback now also verifies user_roles doesn't exist for them
     to avoid pulling in non-student "must_change_password" users.
  ─────────────────────────────────────────────────────────────────────── */
  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Primary: via user_roles
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (roleError) throw roleError;

      let studentIds: string[] = (roleData ?? []).map((r: { user_id: string }) => r.user_id);

      // FIX #5 — Fallback: only profiles with must_change_password=true
      // AND no existing role row (i.e., genuinely untagged students)
      if (studentIds.length === 0) {
        const { data: allRoleIds } = await supabase.from("user_roles").select("user_id");

        const existingRoleUserIds = new Set((allRoleIds ?? []).map((r: { user_id: string }) => r.user_id));

        const { data: fallbackProfs } = await supabase.from("profiles").select("id").eq("must_change_password", true);

        studentIds = (fallbackProfs ?? [])
          .map((p: { id: string }) => p.id)
          .filter((id) => !existingRoleUserIds.has(id)); // exclude non-students
      }

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profileData, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, created_at, must_change_password, city, created_by")
        .in("id", studentIds)
        .order("created_at", { ascending: false });

      if (profError) throw profError;

      const profs = (profileData as StudentProfile[]) ?? [];
      setStudents(profs);

      // Fetch creator display names
      const creatorIds = profs.map((p) => p.created_by).filter((id): id is string => Boolean(id)); // ✅ FIX #12 — proper TS filter

      const uniqueCreatorIds = [...new Set(creatorIds)];

      if (uniqueCreatorIds.length > 0) {
        const { data: creatorProfs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uniqueCreatorIds);

        const map: Record<string, string> = {};
        ((creatorProfs as CreatorProfile[]) ?? []).forEach((p) => {
          map[p.id] = p.full_name || p.email;
        });
        setCreatorNames(map);
      }
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Failed to load students",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* ─────────────────────────────────────────────────────────────────────
     Debounced case search — triggers as soon as firstName >= 2 chars
  ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Build query from whatever parts are filled
    const fullName = [firstName, middleName, familyName].filter(Boolean).join(" ").trim();

    // Trigger on firstName alone (>= 2 chars)
    if (firstName.trim().length < 2) {
      setMatchedCases([]);
      return;
    }

    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, full_name, phone_number, status, city")
        .ilike("full_name", `%${fullName}%`)
        .limit(8);

      setMatchedCases((data as MatchedCase[]) ?? []);
      setSearching(false);
    }, 350);

    return () => clearTimeout(t);
  }, [firstName, middleName, familyName]);

  /* ─────────────────────────────────────────────────────────────────────
     NEW: Select case + auto-fill name fields
     Splits "Ahmad Ali Hassan" → first="Ahmad" middle="Ali" family="Hassan"
  ─────────────────────────────────────────────────────────────────────── */
  const handleSelectCase = (c: MatchedCase) => {
    // Deselect if clicking the same case
    if (selectedCase?.id === c.id) {
      setSelectedCase(null);
      return;
    }

    setSelectedCase(c);

    // Auto-fill name inputs from the case's full_name
    const parts = c.full_name.trim().split(/\s+/);

    if (parts.length === 1) {
      setFirstName(parts[0]);
      setMiddleName("");
      setFamilyName("");
    } else if (parts.length === 2) {
      setFirstName(parts[0]);
      setMiddleName("");
      setFamilyName(parts[1]);
    } else {
      // 3+ words: first | middle(s) | last
      setFirstName(parts[0]);
      setFamilyName(parts[parts.length - 1]);
      setMiddleName(parts.slice(1, parts.length - 1).join(" "));
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     Create account
     FIX #2  — setTempCreds BEFORE resetWizard / setShowModal
     FIX #4  — guard against missing temp_password
     FIX #11 — null-check session
  ─────────────────────────────────────────────────────────────────────── */
  const handleCreateAccount = async () => {
    const email = studentEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ variant: "destructive", description: "A valid email address is required." });
      return;
    }

    const fullName = [firstName.trim(), middleName.trim(), familyName.trim()].filter(Boolean).join(" ");

    if (!fullName) {
      toast({ variant: "destructive", description: "Student name is required." });
      return;
    }

    setCreating(true);
    try {
      // FIX #11 — session null-check
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated — please log in again.");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-from-case`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          case_id: selectedCase?.id ?? null,
          student_email: email,
          student_full_name: fullName,
          student_phone: selectedCase?.phone_number ?? null,
          force_temp_password: true,
        }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to create account");

      // FIX #4 — guard against missing password in response
      if (!result.temp_password) throw new Error("No temporary password returned from server.");

      // FIX #2 — set credentials FIRST, then close/reset
      setTempCreds({ email, password: result.temp_password, full_name: fullName });
      setShowModal(false);
      resetWizard();
      fetchStudents();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setCreating(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">{isRtl ? "الطلاب" : "Students"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStudents} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetWizard();
              setShowModal(true);
            }}
          >
            <UserPlus className="h-4 w-4 me-1" />
            {isRtl ? "إنشاء حساب طالب" : "Create Student Account"}
          </Button>
        </div>
      </div>

      {/* ── Student list ── */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
          <User className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{isRtl ? "لا يوجد طلاب بعد" : "No student accounts yet"}</p>
          <p className="text-xs mt-1">{isRtl ? "أنشئ حساب طالب أولاً" : "Create a student account to get started"}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <Card key={s.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {s.email}
                    </p>
                    {s.phone_number && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {s.phone_number}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {s.must_change_password && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Temp Password
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </span>
                      {s.created_by && (
                        <span className="text-[10px] text-muted-foreground">
                          · By: {creatorNames[s.created_by] ?? `${s.created_by.slice(0, 8)}…`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CREATE STUDENT WIZARD MODAL
      ══════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showModal}
        onOpenChange={(v) => {
          setShowModal(v);
          if (!v) resetWizard();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Student Account
            </DialogTitle>
          </DialogHeader>

          {/* ── FIX #6 — Step indicator matches actual steps only ── */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            {(["search", "email"] as WizardStep[]).map((s, i) => (
              <React.Fragment key={s}>
                <span className={wizardStep === s ? "text-primary font-semibold" : ""}>
                  {i + 1}. {s === "search" ? "Find Case" : "Set Email"}
                </span>
                {/* FIX #9 — RTL-aware chevron */}
                {i < 1 && (isRtl ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
              </React.Fragment>
            ))}
          </div>

          {/* ── Step 1: Search & select case ── */}
          {wizardStep === "search" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the student's name to search for a matching case. Selecting a case will fill all fields
                automatically.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">First Name *</Label>
                  <Input
                    className="mt-1"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ahmad"
                  />
                </div>
                <div>
                  <Label className="text-xs">Middle Name</Label>
                  <Input
                    className="mt-1"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Ali"
                  />
                </div>
                <div>
                  <Label className="text-xs">Family Name *</Label>
                  <Input
                    className="mt-1"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Hassan"
                  />
                </div>
              </div>

              {/* Live search results */}
              {searching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching cases…
                </div>
              )}

              {!searching && matchedCases.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    {matchedCases.length} matching case(s) — select to auto-fill:
                  </Label>
                  <div className="space-y-2 max-h-44 overflow-y-auto rounded-md border border-border p-2">
                    {matchedCases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCase(c)} // ✅ uses new handler
                        className={`w-full text-left p-2 rounded-md text-sm transition-colors border ${
                          selectedCase?.id === c.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{c.full_name}</span>
                        <span className="text-xs text-muted-foreground ms-2">{c.phone_number}</span>
                        <Badge variant="secondary" className="ms-2 text-xs">
                          {c.status.replace(/_/g, " ")}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  {selectedCase && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Case selected — name fields auto-filled</p>
                  )}
                </div>
              )}

              {!searching && firstName.trim().length >= 2 && matchedCases.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No matching cases found. Account will be created without a case link.
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setWizardStep("email")} disabled={!firstName.trim() || !familyName.trim()}>
                  Next
                  {/* FIX #9 — RTL-aware chevron */}
                  {isRtl ? <ChevronLeft className="h-4 w-4 ms-1" /> : <ChevronRight className="h-4 w-4 ms-1" />}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ── Step 2: Enter personal email ── */}
          {wizardStep === "email" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the student's <strong>personal email address</strong>. They will use this to log in.
              </p>

              {selectedCase && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                  <p className="font-medium text-emerald-800">✓ Linked to case: {selectedCase.full_name}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Profile data will be imported automatically.</p>
                </div>
              )}

              <div>
                <Label>Student Email *</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  // FIX #8 — prevent double-submit
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && studentEmail.includes("@") && !creating) {
                      handleCreateAccount();
                    }
                  }}
                />
              </div>

              <div className="p-3 rounded-lg bg-muted text-xs space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">What happens next:</p>
                <p>• A student account is created with this email</p>
                <p>• A secure temporary password is generated</p>
                <p>
                  • The student <strong>must change their password</strong> on first login
                </p>
                {selectedCase && <p>• All case data is imported into their profile</p>}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setWizardStep("search")}>
                  {/* FIX #9 — RTL-aware chevron */}
                  {isRtl ? <ChevronRight className="h-4 w-4 me-1" /> : <ChevronLeft className="h-4 w-4 me-1" />}
                  Back
                </Button>
                <Button
                  onClick={handleCreateAccount}
                  disabled={creating || !studentEmail.trim() || !studentEmail.includes("@")}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin me-1" /> Creating…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Temp credentials result dialog ── */}
      <Dialog open={!!tempCreds} onOpenChange={() => setTempCreds(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Student Account Created</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the student. The password will <strong>not</strong> be shown again. The
              student must change it on first login.
            </p>

            {tempCreds && (
              <div className="space-y-2">
                {/* Student name */}
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Student</p>
                  <p className="font-semibold">{tempCreds.full_name}</p>
                </div>

                {/* Email */}
                <div className="p-3 rounded-lg bg-muted font-mono text-sm space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 break-all">{tempCreds.email}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(tempCreds.email)}
                      className="shrink-0 p-1 rounded hover:bg-border"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Temporary Password */}
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 font-mono text-sm space-y-1">
                  <p className="text-xs text-amber-700">Temporary Password (show once)</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 break-all select-all text-amber-900 font-bold">{tempCreds.password}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tempCreds.password);
                        setCopiedPw(true);
                        setTimeout(() => setCopiedPw(false), 2000);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-amber-100"
                    >
                      {copiedPw ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-amber-700" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (tempCreds) {
                    navigator.clipboard.writeText(`Email: ${tempCreds.email}\nPassword: ${tempCreds.password}`);
                  }
                }}
              >
                <Copy className="h-4 w-4 me-1" /> Copy Both
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (!tempCreds) return;
                  const msg = encodeURIComponent(
                    `مرحبا ${tempCreds.full_name},\nبيانات تسجيل الدخول:\n🔗 darb.agency/student-auth\n📧 ${tempCreds.email}\n🔑 ${tempCreds.password}\nيرجى تغيير كلمة المرور عند أول دخول.`,
                  );
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }}
              >
                <MessageCircle className="h-4 w-4 me-1" /> WhatsApp
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setTempCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
