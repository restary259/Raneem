import React, { useEffect, useState, useCallback } from "react";
import { User, RefreshCw, UserPlus, Copy, CheckCheck, Loader2, Mail, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  /* ── Student list ────────────────────────────────────────────────── */
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Dialog ──────────────────────────────────────────────────────── */
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCreds, setNewCreds] = useState<{
    full_name: string;
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  /* ── Form fields ─────────────────────────────────────────────────── */
  const [form, setForm] = useState({
    firstName: "",
    fatherName: "",
    familyName: "",
    email: "",
  });

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetForm = () => setForm({ firstName: "", fatherName: "", familyName: "", email: "" });

  /* ── Fetch students ──────────────────────────────────────────────── */
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
        .select("id, full_name, email, created_at")
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

  /* ── Create account ──────────────────────────────────────────────── */
  const handleCreate = async () => {
    const { firstName, fatherName, familyName, email } = form;

    if (!firstName.trim() || !fatherName.trim() || !familyName.trim()) {
      toast({
        variant: "destructive",
        description: isRtl ? "يرجى إدخال الاسم الثلاثي كاملاً" : "Please enter all three name parts",
      });
      return;
    }

    if (!email.includes("@")) {
      toast({
        variant: "destructive",
        description: isRtl ? "البريد الإلكتروني غير صالح" : "Invalid email address",
      });
      return;
    }

    const fullName = `${firstName.trim()} ${fatherName.trim()} ${familyName.trim()}`;

    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("create-student-standalone", {
        body: { email: email.trim().toLowerCase(), full_name: fullName },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Creation failed");

      setNewCreds({
        full_name: fullName,
        email: data.email,
        password: data.temp_password,
      });

      resetForm();
      await fetchStudents();
      toast({
        description: isRtl ? "تم إنشاء الحساب بنجاح" : "Account created successfully",
      });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, field: "email" | "password") => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── Filtered list ───────────────────────────────────────────────── */
  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  });

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("team.students.title", "Student Accounts")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("team.students.subtitle", "Create and manage student portal accounts.")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchStudents} title={isRtl ? "تحديث" : "Refresh"}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* ── Create dialog ───────────────────────────────────────── */}
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                resetForm();
                setNewCreds(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t("team.students.createAccount", "Create Student Account")}
              </Button>
            </DialogTrigger>

            <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("team.students.createAccount", "Create Student Account")}</DialogTitle>
              </DialogHeader>

              {/* ── Success / credentials view ─────────────────────── */}
              {newCreds ? (
                <div className="space-y-4 pt-1">
                  <p className="text-sm text-muted-foreground">
                    {isRtl
                      ? `تم إنشاء حساب لـ ${newCreds.full_name}. شارك بيانات الدخول مع الطالب.`
                      : `Account created for ${newCreds.full_name}. Share these credentials with the student.`}
                  </p>

                  <div className="rounded-lg bg-muted p-4 space-y-3 text-sm">
                    {/* Email row */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{isRtl ? "البريد الإلكتروني" : "Email"}</p>
                        <p className="font-medium">{newCreds.email}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(newCreds.email, "email")}>
                        {copied === "email" ? (
                          <CheckCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <div className="border-t border-border" />

                    {/* Password row */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {isRtl ? "كلمة المرور المؤقتة" : "Temporary Password"}
                        </p>
                        <p className="font-mono font-semibold tracking-wide">{newCreds.password}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(newCreds.password, "password")}
                      >
                        {copied === "password" ? (
                          <CheckCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {isRtl
                      ? "سيُطلب من الطالب تغيير كلمة المرور عند أول تسجيل دخول."
                      : "The student will be required to change this password on first login."}
                  </p>

                  <Button
                    className="w-full"
                    onClick={() => {
                      setNewCreds(null);
                      setOpen(false);
                    }}
                  >
                    {t("common.done", "Done")}
                  </Button>
                </div>
              ) : (
                /* ── Creation form ──────────────────────────────────── */
                <div className="space-y-4 pt-1">
                  {/* Three-part name */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {isRtl ? "الاسم الثلاثي" : "Full Three-Part Name"}
                    </p>

                    <div className="space-y-1">
                      <Label htmlFor="firstName">{isRtl ? "الاسم الأول" : "First Name"}</Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={setField("firstName")}
                        placeholder={isRtl ? "مثال: محمد" : "e.g. Ahmad"}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="fatherName">{isRtl ? "اسم الأب" : "Father's Name"}</Label>
                      <Input
                        id="fatherName"
                        value={form.fatherName}
                        onChange={setField("fatherName")}
                        placeholder={isRtl ? "مثال: علي" : "e.g. Khalid"}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="familyName">{isRtl ? "اسم العائلة" : "Family Name"}</Label>
                      <Input
                        id="familyName"
                        value={form.familyName}
                        onChange={setField("familyName")}
                        placeholder={isRtl ? "مثال: النجار" : "e.g. Hassan"}
                      />
                    </div>
                  </div>

                  {/* Preview full name */}
                  {(form.firstName || form.fatherName || form.familyName) && (
                    <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {[form.firstName, form.fatherName, form.familyName].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-border" />

                  {/* Email */}
                  <div className="space-y-1">
                    <Label htmlFor="email">{isRtl ? "البريد الإلكتروني" : "Email Address"}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={setField("email")}
                      placeholder="student@example.com"
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                  </div>

                  <Button className="w-full" onClick={handleCreate} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin me-2" />
                        {isRtl ? "جارٍ الإنشاء…" : "Creating…"}
                      </>
                    ) : (
                      t("team.students.createAccount", "Create Account")
                    )}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRtl ? "بحث بالاسم أو البريد…" : "Search by name or email…"}
          className="ps-9"
        />
      </div>

      {/* ── Student list ───────────────────────────────────────────── */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          {isRtl ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">
            {search
              ? isRtl
                ? "لا توجد نتائج"
                : "No results found"
              : t("team.students.noStudents", "No student accounts yet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {!search && t("team.students.noStudentsHint", "Create a student account to get started.")}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {s.email}
                    </p>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(s.created_at), "d MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
