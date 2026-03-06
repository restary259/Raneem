import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Search,
  User,
  Loader2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  GraduationCap,
  Phone,
  Mail,
  UserPlus,
  CheckCircle2,
  X,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";

/* ─── Types ─────────────────────────────────────────────────────── */
interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  city: string | null;
  must_change_password: boolean;
  created_by: string | null;
}

interface CaseMatch {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  city: string | null;
  education_level: string | null;
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function TeamStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Create modal state ── */
  const [showCreate, setShowCreate] = useState(false);

  /* Step 1: case search */
  const [nameQuery, setNameQuery] = useState("");
  const [caseResults, setCaseResults] = useState<CaseMatch[]>([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseMatch | null>(null);

  /* Step 2: fill names */
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  /* Step 3: email + create */
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  /* Success state */
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Fetch students created by this team member ── */
  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get student role users
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (roleError) throw roleError;

      const userIds = (roleData || []).map((r) => r.user_id);
      if (userIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Team members see only students they created
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, created_at, city, must_change_password, created_by")
        .in("id", userIds)
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudents((data as StudentRecord[]) ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* ── Case search as user types name ── */
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameQueryChange = (val: string) => {
    setNameQuery(val);
    setSelectedCase(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (val.trim().length < 2) {
      setCaseResults([]);
      return;
    }
    setSearchingCases(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("cases")
          .select("id, full_name, phone_number, status, city, education_level")
          .ilike("full_name", `%${val.trim()}%`)
          .eq("assigned_to", user!.id)
          .is("student_user_id", null)
          .limit(8);
        setCaseResults((data as CaseMatch[]) ?? []);
      } catch {
        setCaseResults([]);
      } finally {
        setSearchingCases(false);
      }
    }, 350);
  };

  /* Select a case → pre-fill name parts */
  const selectCase = (c: CaseMatch) => {
    setSelectedCase(c);
    setCaseResults([]);
    setNameQuery(c.full_name);
    // Split full_name into parts
    const parts = c.full_name.trim().split(/\s+/);
    setFirstName(parts[0] ?? "");
    setMiddleName(parts.length === 3 ? parts[1] : "");
    setLastName(parts.length >= 2 ? parts[parts.length - 1] : "");
  };

  /* Reset modal */
  const resetModal = () => {
    setNameQuery("");
    setCaseResults([]);
    setSelectedCase(null);
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setEmail("");
    setCredentials(null);
    setShowPw(false);
    setCopied(false);
  };

  const openCreate = () => {
    resetModal();
    setShowCreate(true);
  };

  /* ── Create account ── */
  const handleCreate = async () => {
    const full = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!full) {
      toast({ variant: "destructive", description: "Please enter at least a first and last name." });
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast({ variant: "destructive", description: "Please enter a valid email address." });
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-standalone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            full_name: full,
            case_id: selectedCase?.id ?? null,
            created_by: user!.id,
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to create account");

      setCredentials({ email: email.trim().toLowerCase(), password: result.temp_password });
      fetchStudents();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const waMsg = isRtl
      ? `مرحباً ${[firstName, lastName].filter(Boolean).join(" ")} 👋\n\nتم إنشاء حسابك في منصة DARB.\n\n📧 البريد الإلكتروني: ${credentials.email}\n🔐 كلمة المرور المؤقتة: ${credentials.password}\n\nيرجى تسجيل الدخول وتغيير كلمة المرور فور الدخول.\n\nرابط الدخول: https://darb-agency.lovable.app/student-auth`
      : `Hello ${[firstName, lastName].filter(Boolean).join(" ")} 👋\n\nYour DARB account has been created.\n\n📧 Email: ${credentials.email}\n🔐 Temporary Password: ${credentials.password}\n\nPlease log in and change your password immediately.\n\nLogin: https://darb-agency.lovable.app/student-auth`;
    await navigator.clipboard.writeText(waMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      (s.phone_number || "").includes(q)
    );
  });

  /* ─── RENDER ─────────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? "طلابي" : "My Students"}
          </h1>
          <Badge variant="secondary" className="text-xs">
            {students.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {isRtl ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {isRtl ? "إنشاء حساب طالب" : "Create Student Account"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isRtl ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">{isRtl ? "لا يوجد طلاب" : "No students yet"}</p>
          <p className="text-sm">
            {isRtl ? "انقر على «إنشاء حساب طالب» للبدء" : "Click «Create Student Account» to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="border-border hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name || s.email}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {s.email}
                      </span>
                      {s.phone_number && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {s.phone_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.must_change_password && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                      {isRtl ? "بانتظار تغيير كلمة المرور" : "Awaiting PW change"}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(s.created_at), "dd MMM yyyy")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Student Account Dialog ── */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) { resetModal(); setShowCreate(false); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {isRtl ? "إنشاء حساب طالب" : "Create Student Account"}
            </DialogTitle>
          </DialogHeader>

          {credentials ? (
            /* ── SUCCESS STATE ── */
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-semibold">{isRtl ? "تم إنشاء الحساب بنجاح!" : "Account created successfully!"}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{isRtl ? "البريد الإلكتروني" : "Email"}</Label>
                  <p className="font-mono text-sm mt-0.5">{credentials.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{isRtl ? "كلمة المرور المؤقتة" : "Temporary Password"}</Label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-mono text-sm flex-1">
                      {showPw ? credentials.password : "•".repeat(credentials.password.length)}
                    </p>
                    <button onClick={() => setShowPw(!showPw)} className="text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {isRtl
                    ? "⚠️ سيُطلب من الطالب تغيير كلمة المرور عند أول تسجيل دخول"
                    : "⚠️ Student will be required to change password on first login"}
                </p>
              </div>
              <Button className="w-full gap-2" variant="outline" onClick={copyCredentials}>
                {copied
                  ? <><Check className="h-4 w-4 text-emerald-600" />{isRtl ? "تم النسخ!" : "Copied!"}</>
                  : <><MessageCircle className="h-4 w-4" />{isRtl ? "نسخ رسالة واتساب" : "Copy WhatsApp Message"}</>
                }
              </Button>
              <Button
                className="w-full"
                onClick={() => { resetModal(); setShowCreate(false); }}
              >
                {isRtl ? "إغلاق" : "Done"}
              </Button>
            </div>
          ) : (
            /* ── FORM STATE ── */
            <div className="space-y-5 py-2">
              {/* Step 1: Case Search */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {isRtl ? "١. ابحث عن القضية (اختياري)" : "1. Search for a Case (Optional)"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? "اكتب اسم الطالب للبحث في قضاياك المعيّنة وسيتم ملء البيانات تلقائياً"
                    : "Type the student's name to search your assigned cases — data will auto-fill"}
                </p>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="ps-9 pe-9"
                    placeholder={isRtl ? "ابحث باسم الطالب..." : "Search student name..."}
                    value={nameQuery}
                    onChange={(e) => handleNameQueryChange(e.target.value)}
                  />
                  {searchingCases && (
                    <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {selectedCase && !searchingCases && (
                    <button
                      onClick={() => { setSelectedCase(null); setNameQuery(""); setCaseResults([]); setFirstName(""); setMiddleName(""); setLastName(""); }}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Case dropdown results */}
                {caseResults.length > 0 && !selectedCase && (
                  <div className="border rounded-xl shadow-sm overflow-hidden bg-background">
                    {caseResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-start border-b last:border-0"
                        onClick={() => selectCase(c)}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{c.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{c.phone_number}</span>
                            {c.city && <span className="text-xs text-muted-foreground">· {c.city}</span>}
                            <Badge variant="outline" className="text-xs h-4 px-1">{c.status}</Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected case chip */}
                {selectedCase && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary">{selectedCase.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCase.phone_number} · Case ID: {selectedCase.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Name fields */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {isRtl ? "٢. اسم الطالب (كما في جواز السفر)" : "2. Student Name (as in passport)"}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">{isRtl ? "الاسم الأول" : "First"}</Label>
                    <Input
                      className="mt-1"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={isRtl ? "الأول" : "First"}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{isRtl ? "الأوسط" : "Middle"}</Label>
                    <Input
                      className="mt-1"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder={isRtl ? "الأوسط" : "Middle"}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{isRtl ? "الأخير" : "Last"}</Label>
                    <Input
                      className="mt-1"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={isRtl ? "الأخير" : "Last"}
                    />
                  </div>
                </div>
                {(firstName || lastName) && (
                  <p className="text-xs text-muted-foreground">
                    {isRtl ? "الاسم الكامل:" : "Full name:"}{" "}
                    <span className="font-medium text-foreground">
                      {[firstName, middleName, lastName].filter(Boolean).join(" ")}
                    </span>
                  </p>
                )}
              </div>

              {/* Step 3: Email */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {isRtl ? "٣. البريد الإلكتروني" : "3. Email Address"}
                </Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="ps-9"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg p-3">
                {isRtl
                  ? "سيتم إنشاء كلمة مرور مؤقتة وسيُطلب من الطالب تغييرها عند أول تسجيل دخول."
                  : "A temporary password will be generated. The student will be required to change it on first login."}
              </p>
            </div>
          )}

          {!credentials && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { resetModal(); setShowCreate(false); }}
                disabled={creating}
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-4 w-4" />
                {isRtl ? "إنشاء الحساب" : "Create Account"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
