import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User,
  RefreshCw,
  Clock,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Mail,
  GraduationCap,
  KeyRound,
  Eye,
  EyeOff,
  Shield,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Globe,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  must_change_password: boolean;
  city: string | null;
  country: string | null;
  intake_month: string | null;
  university_name: string | null;
  visa_status: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

interface TempCredentials {
  email: string;
  password: string;
  full_name: string;
}

const VISA_STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  not_applied: { en: "Not Applied", ar: "لم يتقدم", color: "bg-gray-100 text-gray-700" },
  in_progress: { en: "In Progress", ar: "قيد المعالجة", color: "bg-blue-100 text-blue-700" },
  approved: { en: "Approved", ar: "موافق عليه", color: "bg-green-100 text-green-700" },
  rejected: { en: "Rejected", ar: "مرفوض", color: "bg-red-100 text-red-700" },
  expired: { en: "Expired", ar: "منتهي الصلاحية", color: "bg-orange-100 text-orange-700" },
};

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile sheet
  const [selected, setSelected] = useState<StudentProfile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // Temp password popup
  const [tempCreds, setTempCreds] = useState<TempCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone_number, created_at, must_change_password, city, country, intake_month, university_name, visa_status, nationality, passport_number, passport_expiry, emergency_contact_name, emergency_contact_phone, notes",
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (profileError) throw profileError;
      setStudents((profileData as StudentProfile[]) ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const openProfile = (s: StudentProfile) => {
    setSelected(s);
    setSheetOpen(true);
  };

  const handleCreate = async () => {
    if (!createEmail.trim()) {
      toast({ variant: "destructive", description: isRtl ? "البريد الإلكتروني مطلوب" : "Email is required" });
      return;
    }
    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-standalone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ email: createEmail.trim(), full_name: createName.trim() || undefined }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        toast({
          variant: "destructive",
          description: result.error || (isRtl ? "فشل إنشاء الحساب" : "Failed to create account"),
        });
        setCreating(false);
        return;
      }
      setShowCreateModal(false);
      setCreateEmail("");
      setCreateName("");
      setShowPassword(false);
      setTempCreds({
        email: result.email,
        password: result.temp_password,
        full_name: result.full_name || result.email,
      });
      fetchStudents();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, type: "pw" | "both") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "pw") {
        setCopiedPw(true);
        setTimeout(() => setCopiedPw(false), 2000);
      } else {
        setCopiedBoth(true);
        setTimeout(() => setCopiedBoth(false), 2000);
      }
    } catch {
      toast({ variant: "destructive", description: "Could not copy to clipboard" });
    }
  };

  const visaStatus = selected?.visa_status ? VISA_STATUS_LABELS[selected.visa_status] : null;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{isRtl ? "حسابات الطلاب" : "Student Accounts"}</h1>
          <Badge variant="secondary" className="text-xs">
            {students.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            {isRtl ? "إنشاء حساب طالب" : "Create Student Account"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {isRtl ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isRtl
          ? "الحسابات التي أنشأتها — انقر على أي طالب لعرض ملفه"
          : "Accounts you created — click any student to view their profile"}
      </p>

      {/* Student List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>{isRtl ? "لا يوجد طلاب بعد" : "No student accounts yet"}</p>
          <p className="text-xs mt-1">{isRtl ? "أنشئ حساباً للبدء" : "Create an account to get started"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => (
            <Card
              key={s.id}
              className="border-border cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              onClick={() => openProfile(s)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{s.full_name || s.email}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {s.email}
                      </span>
                      {s.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {s.phone_number}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.must_change_password && (
                    <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50">
                      <KeyRound className="h-3 w-3" />
                      {isRtl ? "يجب تغيير كلمة المرور" : "Must change pw"}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    {isRtl ? "طالب" : "Student"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Student Profile Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{selected.full_name || selected.email}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{selected.email}</p>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {selected.must_change_password && (
                    <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50">
                      <KeyRound className="h-3 w-3" />
                      {isRtl ? "يجب تغيير كلمة المرور" : "Must change password"}
                    </Badge>
                  )}
                  {visaStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visaStatus.color}`}>
                      {isRtl ? visaStatus.ar : visaStatus.en}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    {isRtl ? "طالب" : "Student"}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="space-y-5 pt-2">
                {/* Contact Info */}
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "معلومات التواصل" : "Contact Information"}
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<Mail className="h-4 w-4" />}
                      label={isRtl ? "البريد الإلكتروني" : "Email"}
                      value={selected.email}
                    />
                    <InfoRow
                      icon={<Phone className="h-4 w-4" />}
                      label={isRtl ? "رقم الهاتف" : "Phone"}
                      value={selected.phone_number}
                    />
                    <InfoRow
                      icon={<MapPin className="h-4 w-4" />}
                      label={isRtl ? "المدينة" : "City"}
                      value={selected.city}
                    />
                    <InfoRow
                      icon={<Globe className="h-4 w-4" />}
                      label={isRtl ? "الدولة" : "Country"}
                      value={selected.country}
                    />
                    <InfoRow
                      icon={<Globe className="h-4 w-4" />}
                      label={isRtl ? "الجنسية" : "Nationality"}
                      value={selected.nationality}
                    />
                  </div>
                </section>

                <Separator />

                {/* Academic Info */}
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "المعلومات الأكاديمية" : "Academic Information"}
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<BookOpen className="h-4 w-4" />}
                      label={isRtl ? "مدرسة اللغة" : "Language School"}
                      value={selected.university_name}
                    />
                    <InfoRow
                      icon={<Calendar className="h-4 w-4" />}
                      label={isRtl ? "شهر الالتحاق" : "Intake Month"}
                      value={selected.intake_month}
                    />
                  </div>
                </section>

                <Separator />

                {/* Passport Info */}
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "معلومات جواز السفر" : "Passport Information"}
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<Shield className="h-4 w-4" />}
                      label={isRtl ? "رقم جواز السفر" : "Passport Number"}
                      value={selected.passport_number}
                    />
                    <InfoRow
                      icon={<Calendar className="h-4 w-4" />}
                      label={isRtl ? "تاريخ انتهاء الجواز" : "Passport Expiry"}
                      value={
                        selected.passport_expiry ? format(new Date(selected.passport_expiry), "dd MMM yyyy") : null
                      }
                    />
                  </div>
                </section>

                <Separator />

                {/* Emergency Contact */}
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "جهة الاتصال في حالات الطوارئ" : "Emergency Contact"}
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<User className="h-4 w-4" />}
                      label={isRtl ? "الاسم" : "Name"}
                      value={selected.emergency_contact_name}
                    />
                    <InfoRow
                      icon={<Phone className="h-4 w-4" />}
                      label={isRtl ? "رقم الهاتف" : "Phone"}
                      value={selected.emergency_contact_phone}
                    />
                  </div>
                </section>

                {selected.notes && (
                  <>
                    <Separator />
                    <section>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {isRtl ? "ملاحظات" : "Notes"}
                      </p>
                      <p className="text-sm text-foreground bg-muted rounded-lg p-3 leading-relaxed">
                        {selected.notes}
                      </p>
                    </section>
                  </>
                )}

                <Separator />

                {/* Meta */}
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "معلومات الحساب" : "Account Info"}
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<Clock className="h-4 w-4" />}
                      label={isRtl ? "تاريخ الإنشاء" : "Created"}
                      value={format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")}
                    />
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create Student Account Modal ── */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setCreateEmail("");
            setCreateName("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {isRtl ? "إنشاء حساب طالب جديد" : "Create Student Account"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {isRtl
                ? "سيتم إنشاء كلمة مرور مؤقتة آمنة وعرضها لك فوراً."
                : "A secure temporary password will be generated and shown immediately."}
            </p>
            <div className="space-y-2">
              <Label htmlFor="create-email">{isRtl ? "البريد الإلكتروني *" : "Email *"}</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="student@gmail.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">{isRtl ? "الاسم الكامل (اختياري)" : "Full Name (optional)"}</Label>
              <Input
                id="create-name"
                placeholder={isRtl ? "اسم الطالب" : "Student name"}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createEmail.trim()} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {isRtl ? "إنشاء الحساب" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Temp Password Result Popup ── */}
      <Dialog
        open={!!tempCreds}
        onOpenChange={(open) => {
          if (!open) setTempCreds(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              {isRtl ? "تم إنشاء الحساب بنجاح ✓" : "Student Account Created ✓"}
            </DialogTitle>
          </DialogHeader>
          {tempCreds && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                {isRtl
                  ? "احفظ هذه البيانات الآن — كلمة المرور لن تُعرض مرة أخرى."
                  : "Save these credentials now — the password will not be shown again."}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isRtl ? "الاسم" : "Name"}
                  </p>
                  <p className="font-medium text-sm">{tempCreds.full_name}</p>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isRtl ? "البريد الإلكتروني" : "Email"}
                  </p>
                  <p className="font-mono text-sm bg-muted px-3 py-2 rounded-lg select-all">{tempCreds.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isRtl ? "كلمة المرور المؤقتة" : "Temporary Password"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm bg-muted px-3 py-2 rounded-lg flex-1 select-all tracking-wider">
                      {showPassword ? tempCreds.password : "•".repeat(tempCreds.password.length)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => copyToClipboard(tempCreds.password, "pw")}
                >
                  {copiedPw ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copiedPw ? (isRtl ? "تم النسخ!" : "Copied!") : isRtl ? "نسخ كلمة المرور" : "Copy Password"}
                </Button>
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => copyToClipboard(`Email: ${tempCreds.email}\nPassword: ${tempCreds.password}`, "both")}
                >
                  {copiedBoth ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedBoth
                    ? isRtl
                      ? "تم النسخ!"
                      : "Copied!"
                    : isRtl
                      ? "نسخ البريد + كلمة المرور"
                      : "Copy Email + Password"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setTempCreds(null)}>
                  {isRtl ? "إغلاق" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for a single info row
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value)
    return (
      <div className="flex items-start gap-2.5">
        <span className="text-muted-foreground/40 mt-0.5 shrink-0">{icon}</span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm text-muted-foreground/50 italic">—</p>
        </div>
      </div>
    );
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-primary/60 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
