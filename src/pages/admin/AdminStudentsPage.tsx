import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Search,
  User,
  Mail,
  Phone,
  GraduationCap,
  FileText,
  Download,
  Trash2,
  Upload,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Loader2,
  Save,
  Edit3,
  X,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  city: string | null;
  must_change_password: boolean;
  created_by: string | null;
  emergency_contact: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  arrival_date: string | null;
  gender: string | null;
  date_of_birth: string | null;
  country: string | null;
  nationality: string | null;
  university_name: string | null;
  intake_month: string | null;
  notes: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  updated_by_student_at: string | null;
}

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  created_at: string;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  uploaded_by: string | null;
  uploader_name?: string | null;
}

interface CreatorInfo {
  [userId: string]: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectiveDeleteDialog
// ─────────────────────────────────────────────────────────────────────────────
const SelectiveDeleteDialog = ({
  student,
  t,
  onClose,
  onDeleted,
}: {
  student: StudentRecord;
  t: (key: string, opts?: any) => string;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [mode, setMode] = useState<"soft" | "hard">("soft");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const CATEGORIES = [
    { id: "contact_info", label: t("admin.students.catContactInfo") },
    { id: "documents", label: t("admin.students.catDocuments") },
    { id: "case", label: t("admin.students.catCase") },
  ];

  const toggleCat = (id: string) =>
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleDelete = async () => {
    if (!categories.length) {
      toast({ variant: "destructive", description: t("admin.students.selectCategories") });
      return;
    }
    if (mode === "hard" && !password) {
      toast({ variant: "destructive", description: t("admin.students.adminPassword") });
      return;
    }
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Session expired");

      const resp = await supabase.functions.invoke("selective-delete", {
        body: { student_id: student.id, categories, mode, password: mode === "hard" ? password : undefined },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.error || !resp.data?.success) {
        throw new Error(resp.data?.error || resp.error?.message || "Delete failed");
      }

      toast({ title: t("admin.students.deleted"), description: resp.data.message });
      onDeleted();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("admin.students.selectCategories")}
        </p>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-muted/30">
              <Checkbox id={cat.id} checked={categories.includes(cat.id)} onCheckedChange={() => toggleCat(cat.id)} />
              <Label htmlFor={cat.id} className="cursor-pointer text-sm flex-1">{cat.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {t("admin.students.deleteMode")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("soft")}
            className={`p-3 rounded-xl border text-sm text-left transition-all ${mode === "soft" ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
          >
            <p className="font-medium">{t("admin.students.softDeleteLabel")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("admin.students.softDeleteDesc")}</p>
          </button>
          <button
            onClick={() => setMode("hard")}
            className={`p-3 rounded-xl border text-sm text-left transition-all ${mode === "hard" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}
          >
            <p className="font-medium text-destructive">{t("admin.students.hardDeleteLabel")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("admin.students.hardDeleteDesc")}</p>
          </button>
        </div>
      </div>

      {mode === "hard" && (
        <div className="space-y-2">
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{t("admin.students.hardDeleteWarning")}</p>
          </div>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("admin.students.adminPassword")}
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
          {t("admin.students.cancel")}
        </Button>
        <Button
          variant="destructive"
          className="flex-1 gap-2"
          onClick={handleDelete}
          disabled={!categories.length || deleting}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {deleting ? t("admin.students.deleting") : t("admin.students.delete")}
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminStudentsPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creatorNames, setCreatorNames] = useState<CreatorInfo>({});

  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [visaFields, setVisaFields] = useState<
    Array<{ id: string; label_en: string; label_ar: string; field_type: string; options_json: any[] | null }>
  >([]);
  const [visaValues, setVisaValues] = useState<Record<string, string>>({});
  const [visaValueIds, setVisaValueIds] = useState<Record<string, string>>({});
  const [editingVisa, setEditingVisa] = useState(false);
  const [visaDraft, setVisaDraft] = useState<Record<string, string>>({});
  const [savingVisa, setSavingVisa] = useState(false);

  const [referralCount, setReferralCount] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudentRecord>>({});
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [customDocName, setCustomDocName] = useState("");

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null);
  const [showResetPw, setShowResetPw] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);

  const PROFILE_SELECT =
    "id, full_name, email, phone_number, created_at, city, must_change_password, created_by, emergency_contact, emergency_contact_name, emergency_contact_phone, arrival_date, gender, date_of_birth, country, nationality, university_name, intake_month, notes, passport_number, passport_expiry, updated_by_student_at";

  // ── FIX 2: Remove over-restrictive filters — show ALL students ──
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (roleError) throw roleError;

      const userIds = (roleData || []).map((r: any) => r.user_id);
      if (userIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", userIds)
        // Removed .not("created_by","is",null) and .is("case_id",null) — those were hiding valid students
        .order("created_at", { ascending: false });

      if (error) throw error;
      const profs = (profileData as StudentRecord[]) ?? [];
      setStudents(profs);

      const creatorIds = [...new Set(profs.map((p) => p.created_by).filter(Boolean) as string[])];
      if (creatorIds.length > 0) {
        const { data: creatorProfs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", creatorIds);
        const map: CreatorInfo = {};
        (creatorProfs || []).forEach((p: any) => { map[p.id] = p.full_name || p.email; });
        setCreatorNames(map);
      }
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // ── FIX 4: Helper to refresh docs with uploader names ──
  const fetchDocsForStudent = useCallback(async (studentId: string) => {
    const { data: refreshedDocs } = await supabase
      .from("documents")
      .select("id, file_name, file_url, category, created_at, file_type, file_size, notes, uploaded_by")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const rawDocs = (refreshedDocs as Document[]) ?? [];
    const uploaderIds = [...new Set(rawDocs.map((d) => d.uploaded_by).filter(Boolean) as string[])];
    let uploaderMap: Record<string, string> = {};
    if (uploaderIds.length > 0) {
      const { data: uploaderProfs } = await supabase.from("profiles").select("id, full_name, email").in("id", uploaderIds);
      (uploaderProfs ?? []).forEach((p: any) => { uploaderMap[p.id] = p.full_name || p.email; });
    }
    setDocs(rawDocs.map((d) => ({ ...d, uploader_name: d.uploaded_by ? uploaderMap[d.uploaded_by] || "Unknown" : null })));
  }, []);

  // ── FIX 4: Realtime subscription while sheet is open ──
  useEffect(() => {
    if (!selected) return;
    const studentId = selected.id;

    const channel = supabase
      .channel(`student-sheet-${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `student_id=eq.${studentId}` },
        () => { fetchDocsForStudent(studentId); }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${studentId}` },
        async () => {
          const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", studentId).maybeSingle();
          if (data) {
            const updated = data as StudentRecord;
            setSelected(updated);
            setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...updated } : s)));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected?.id, fetchDocsForStudent]);

  const openStudent = async (s: StudentRecord) => {
    setSelected(s);
    setEditing(false);
    setEditingVisa(false);

    const { data: freshProfile } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", s.id).maybeSingle();
    const profile: StudentRecord = (freshProfile as StudentRecord) ?? s;
    setSelected(profile);
    setStudents((prev) => prev.map((p) => (p.id === profile.id ? { ...p, ...profile } : p)));

    // ── FIX 1: All profile fields in editForm ──
    setEditForm({
      full_name: profile.full_name,
      phone_number: profile.phone_number || "",
      city: profile.city || "",
      emergency_contact: profile.emergency_contact || "",
      emergency_contact_name: profile.emergency_contact_name || "",
      emergency_contact_phone: profile.emergency_contact_phone || "",
      arrival_date: profile.arrival_date || "",
      gender: profile.gender || "",
      date_of_birth: profile.date_of_birth || "",
      nationality: profile.nationality || "",
      country: profile.country || "",
      university_name: profile.university_name || "",
      intake_month: profile.intake_month || "",
      notes: profile.notes || "",
      passport_number: profile.passport_number || "",
      passport_expiry: profile.passport_expiry || "",
    });

    setDocs([]);
    setDocsLoading(true);
    setVisaFields([]);
    setVisaValues({});
    setVisaValueIds({});
    setReferralCount(0);

    try {
      const [docsRes, fieldsRes, valuesRes, referralRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id, file_name, file_url, category, created_at, file_type, file_size, notes, uploaded_by")
          .eq("student_id", s.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        (supabase as any).from("visa_fields").select("id, label_en, label_ar, field_type, options_json").eq("is_active", true).order("display_order"),
        (supabase as any).from("visa_field_values").select("id, field_id, value").eq("student_user_id", s.id),
        (supabase as any).from("referrals").select("id", { count: "exact", head: true }).eq("referrer_user_id", s.id),
      ]);

      if (docsRes.error) throw docsRes.error;
      const rawDocs = (docsRes.data as Document[]) ?? [];
      const uploaderIds = [...new Set(rawDocs.map((d) => d.uploaded_by).filter(Boolean) as string[])];
      let uploaderMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: uploaderProfs } = await supabase.from("profiles").select("id, full_name, email").in("id", uploaderIds);
        (uploaderProfs ?? []).forEach((p: any) => { uploaderMap[p.id] = p.full_name || p.email; });
      }
      setDocs(rawDocs.map((d) => ({ ...d, uploader_name: d.uploaded_by ? uploaderMap[d.uploaded_by] || "Unknown" : null })));

      if (fieldsRes.data) setVisaFields(fieldsRes.data);

      const valMap: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      (valuesRes.data ?? []).forEach((v: any) => { valMap[v.field_id] = v.value ?? ""; idMap[v.field_id] = v.id; });
      setVisaValues(valMap);
      setVisaValueIds(idMap);
      setVisaDraft(valMap);
      setReferralCount(referralRes.count ?? 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDocsLoading(false);
    }
  };

  const saveVisaValues = async () => {
    if (!selected) return;
    setSavingVisa(true);
    try {
      const upserts = visaFields.map((f) => ({
        id: visaValueIds[f.id] ?? undefined,
        field_id: f.id,
        student_user_id: selected.id,
        value: visaDraft[f.id] ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any).from("visa_field_values").upsert(upserts, { onConflict: "field_id,student_user_id" });
      if (error) throw error;
      setVisaValues({ ...visaDraft });
      setEditingVisa(false);
      toast({ description: t("admin.students.visaSaved") });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSavingVisa(false);
    }
  };

  // ── FIX 1: handleSave writes ALL profile fields ──
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          phone_number: editForm.phone_number || null,
          city: editForm.city || null,
          emergency_contact: editForm.emergency_contact || null,
          emergency_contact_name: editForm.emergency_contact_name || null,
          emergency_contact_phone: editForm.emergency_contact_phone || null,
          arrival_date: editForm.arrival_date || null,
          gender: editForm.gender || null,
          date_of_birth: editForm.date_of_birth || null,
          nationality: editForm.nationality || null,
          country: editForm.country || null,
          university_name: editForm.university_name || null,
          intake_month: editForm.intake_month || null,
          notes: editForm.notes || null,
          passport_number: editForm.passport_number || null,
          passport_expiry: editForm.passport_expiry || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", selected.id);
      if (error) throw error;
      toast({ description: t("admin.students.changesSaved") });
      setEditing(false);
      const { data: confirmed } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", selected.id).maybeSingle();
      const saved = (confirmed as StudentRecord) ?? { ...selected, ...editForm };
      setSelected(saved);
      setStudents((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...saved } : s)));
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${selected.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("student-documents").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("student-documents").getPublicUrl(path);
      const displayName = uploadCategory === "other" && customDocName.trim() ? customDocName.trim() : file.name;
      const { error: dbError } = await supabase.from("documents").insert({
        student_id: selected.id,
        file_name: displayName,
        file_url: urlData.publicUrl,
        category: uploadCategory,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        is_visible_to_student: true,
      });
      if (dbError) throw dbError;
      toast({ description: t("admin.students.fileUploaded") });
      setCustomDocName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Realtime subscription auto-refreshes docs list
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (doc: Document) => {
    if (!confirm(isRtl ? "هل أنت متأكد من حذف هذا المستند؟" : "Delete this document?")) return;
    try {
      const urlParts = doc.file_url.split("/student-documents/");
      if (urlParts[1]) await supabase.storage.from("student-documents").remove([urlParts[1]]);
      await (supabase as any).from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast({ description: t("admin.students.docDeleted") });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleDownloadDoc = async (doc: Document) => {
    try {
      const urlParts = doc.file_url.split("/student-documents/");
      const storagePath = urlParts[1] ?? doc.file_url;
      const { data, error } = await supabase.storage.from("student-documents").createSignedUrl(storagePath, 60);
      if (error) throw error;
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.file_name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast({ variant: "destructive", description: `Download failed: ${err.message}` });
    }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-student-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ user_id: selected.id }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed");
      setShowResetDialog(false);
      setShowResetPw(false);
      setResetCreds({ email: selected.email, password: result.temp_password });
      fetchStudents();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setResetting(false);
    }
  };

  const copyResetCreds = async () => {
    if (!resetCreds) return;
    await navigator.clipboard.writeText(`Email: ${resetCreds.email}\nPassword: ${resetCreds.password}`);
    setCopiedReset(true);
    setTimeout(() => setCopiedReset(false), 2000);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.phone_number || "").includes(q);
  });

  const DOC_CATEGORIES = ["passport", "certificate", "visa", "financial", "application", "other"];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t("admin.students.managementTitle")}</h1>
          <Badge variant="secondary" className="text-xs">{students.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t("admin.students.refresh")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("admin.students.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Table header */}
      {!loading && filtered.length > 0 && (
        <div className="hidden md:grid grid-cols-5 px-4 py-2.5 bg-muted/50 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>{t("admin.students.colStudent")}</span>
          <span>{t("admin.students.colEmail")}</span>
          <span>{t("admin.students.colPhone")}</span>
          <span>{t("admin.students.colCreated")}</span>
          <span>{t("admin.students.colCreatedBy")}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t("admin.students.noRegistered")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow border-border" onClick={() => openStudent(s)}>
              <CardContent className="p-4 hidden md:grid grid-cols-5 items-center gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <p className="font-medium text-sm truncate">{s.full_name || s.email}</p>
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                <p className="text-xs text-muted-foreground">{s.phone_number || "—"}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), "dd MMM yyyy")}</p>
                <p className="text-xs text-muted-foreground">
                  {s.created_by ? creatorNames[s.created_by] || s.created_by.slice(0, 8) + "..." : t("admin.students.selfRegistered")}
                </p>
              </CardContent>
              <CardContent className="p-4 flex md:hidden items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{format(new Date(s.created_at), "dd MMM yy")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Student Detail Sheet ── */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditing(false); } }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {selected.full_name || selected.email}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                {/* Profile Info / Edit */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("admin.students.studentInfo")}
                    </p>
                    {!editing ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1 h-7 text-xs">
                        <Edit3 className="h-3 w-3" /> {t("admin.students.edit")}
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-7 text-xs gap-1">
                          <X className="h-3 w-3" /> {t("admin.students.cancel")}
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          {t("admin.students.save")}
                        </Button>
                      </div>
                    )}
                  </div>

                  {editing ? (
                    /* ── FIX 1: Full edit form ── */
                    <div className="space-y-3">
                      {[
                        { label: t("admin.students.fieldFullName"), key: "full_name" },
                        { label: t("admin.students.fieldPhoneNumber"), key: "phone_number" },
                        { label: t("admin.students.fieldCity"), key: "city" },
                        { label: t("admin.students.fieldNationality"), key: "nationality" },
                        { label: isRtl ? "العنوان / الدولة" : "Address / Country", key: "country" },
                        { label: t("admin.students.fieldUniversity"), key: "university_name" },
                        { label: t("admin.students.fieldIntake"), key: "intake_month" },
                        { label: isRtl ? "رقم جواز السفر" : "Passport Number", key: "passport_number" },
                        { label: t("admin.students.fieldEmergency"), key: "emergency_contact" },
                        { label: isRtl ? "اسم جهة الاتصال للطوارئ" : "Emergency Contact Name", key: "emergency_contact_name" },
                        { label: isRtl ? "هاتف جهة الاتصال للطوارئ" : "Emergency Contact Phone", key: "emergency_contact_phone" },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <Label className="text-xs">{label}</Label>
                          <Input
                            value={(editForm as any)[key] || ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>
                      ))}

                      {/* Gender select */}
                      <div>
                        <Label className="text-xs">{t("admin.students.fieldGender")}</Label>
                        <Select value={editForm.gender || ""} onValueChange={(v) => setEditForm((f) => ({ ...f, gender: v }))}>
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder={isRtl ? "اختر الجنس" : "Select gender"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">{isRtl ? "ذكر" : "Male"}</SelectItem>
                            <SelectItem value="female">{isRtl ? "أنثى" : "Female"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date fields */}
                      <div>
                        <Label className="text-xs">{t("admin.students.fieldDob")}</Label>
                        <Input type="date" value={editForm.date_of_birth || ""} onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value }))} className="mt-1 h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("admin.students.fieldArrival")}</Label>
                        <Input type="date" value={editForm.arrival_date || ""} onChange={(e) => setEditForm((f) => ({ ...f, arrival_date: e.target.value }))} className="mt-1 h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">{isRtl ? "انتهاء صلاحية جواز السفر" : "Passport Expiry"}</Label>
                        <Input type="date" value={editForm.passport_expiry || ""} onChange={(e) => setEditForm((f) => ({ ...f, passport_expiry: e.target.value }))} className="mt-1 h-9 text-sm" />
                      </div>

                      {/* Notes */}
                      <div>
                        <Label className="text-xs">{isRtl ? "ملاحظات" : "Notes"}</Label>
                        <Textarea
                          value={editForm.notes || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                          className="mt-1 text-sm min-h-[80px]"
                          placeholder={isRtl ? "ملاحظات..." : "Notes..."}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-sm">
                      {[
                        { icon: <Mail className="h-3.5 w-3.5" />, label: t("admin.students.fieldEmail"), value: selected.email },
                        { icon: <Phone className="h-3.5 w-3.5" />, label: t("admin.students.fieldPhone"), value: selected.phone_number || "—" },
                        { icon: <Shield className="h-3.5 w-3.5" />, label: t("admin.students.fieldCity"), value: selected.city || "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: t("admin.students.fieldGender"), value: selected.gender || "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: t("admin.students.fieldDob"), value: selected.date_of_birth ? format(new Date(selected.date_of_birth), "PPP") : "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: t("admin.students.fieldNationality"), value: selected.nationality || "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: isRtl ? "العنوان / الدولة" : "Address / Country", value: selected.country || "—" },
                        { icon: <GraduationCap className="h-3.5 w-3.5" />, label: t("admin.students.fieldUniversity"), value: selected.university_name || "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: t("admin.students.fieldIntake"), value: selected.intake_month || "—" },
                        { icon: <FileText className="h-3.5 w-3.5" />, label: isRtl ? "رقم جواز السفر" : "Passport No.", value: selected.passport_number || "—" },
                        { icon: <Clock className="h-3.5 w-3.5" />, label: isRtl ? "انتهاء جواز السفر" : "Passport Expiry", value: selected.passport_expiry ? format(new Date(selected.passport_expiry), "PPP") : "—" },
                        { icon: <Phone className="h-3.5 w-3.5" />, label: t("admin.students.fieldEmergency"), value: selected.emergency_contact || "—" },
                        { icon: <User className="h-3.5 w-3.5" />, label: isRtl ? "اسم جهة الطوارئ" : "Emergency Name", value: selected.emergency_contact_name || "—" },
                        { icon: <Phone className="h-3.5 w-3.5" />, label: isRtl ? "هاتف جهة الطوارئ" : "Emergency Phone", value: selected.emergency_contact_phone || "—" },
                        { icon: <Clock className="h-3.5 w-3.5" />, label: t("admin.students.fieldArrival"), value: selected.arrival_date ? format(new Date(selected.arrival_date), "PPP") : "—" },
                        { icon: <Clock className="h-3.5 w-3.5" />, label: t("admin.students.fieldLastUpdated"), value: selected.updated_by_student_at ? format(new Date(selected.updated_by_student_at), "PPP") : "—" },
                        { icon: <Clock className="h-3.5 w-3.5" />, label: t("admin.students.fieldCreated"), value: format(new Date(selected.created_at), "PPP") },
                        { icon: <User className="h-3.5 w-3.5" />, label: t("admin.students.fieldCreatedBy"), value: selected.created_by ? creatorNames[selected.created_by] || selected.created_by.slice(0, 8) : t("admin.students.selfRegistered") },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
                          <span className="text-muted-foreground w-32 shrink-0 text-xs">{label}</span>
                          <span className="font-medium text-xs break-all">{value}</span>
                        </div>
                      ))}
                      {selected.notes && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-muted-foreground w-32 shrink-0 text-xs">{isRtl ? "ملاحظات" : "Notes"}</span>
                          <span className="font-medium text-xs break-all">{selected.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Admin Actions */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {t("admin.students.adminActions")}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => setShowResetDialog(true)}>
                      <KeyRound className="h-4 w-4" />
                      {t("admin.students.resetPassword")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full text-destructive hover:bg-destructive/5 border-destructive/30"
                      onClick={() => { setDeleteTarget(selected); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("admin.students.selectiveDelete")}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Document Upload */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {t("admin.students.uploadNewDocument")}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">{t("admin.students.docCategory")}</Label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="mt-1 w-full h-9 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        {DOC_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    {uploadCategory === "other" && (
                      <div>
                        <Label className="text-xs">{t("admin.students.docName")}</Label>
                        <Input value={customDocName} onChange={(e) => setCustomDocName(e.target.value)} placeholder={t("admin.students.docNamePlaceholder")} className="mt-1 h-9 text-sm" />
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
                    <Button variant="outline" size="sm" className="gap-2 w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? t("admin.students.uploading") : t("admin.students.chooseFile")}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── FIX 3: Visa Fields — handle select, date, boolean, text ── */}
                {visaFields.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("admin.students.visaInfo")}
                      </p>
                      {!editingVisa ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => { setVisaDraft({ ...visaValues }); setEditingVisa(true); }}>
                          <Edit3 className="h-3 w-3" /> {t("admin.students.edit")}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditingVisa(false)} disabled={savingVisa}>
                            <X className="h-3 w-3" /> {t("admin.students.cancel")}
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={saveVisaValues} disabled={savingVisa}>
                            {savingVisa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            {t("admin.students.save")}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {visaFields.map((f) => {
                        const label = isRtl ? f.label_ar : f.label_en;
                        const val = editingVisa ? (visaDraft[f.id] ?? "") : (visaValues[f.id] ?? "");
                        const onChange = (v: string) => setVisaDraft((d) => ({ ...d, [f.id]: v }));

                        if (f.field_type === "boolean") {
                          return (
                            <div key={f.id} className="flex items-center justify-between py-1 text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <input type="checkbox" checked={val === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} disabled={!editingVisa} className="h-4 w-4 rounded" />
                            </div>
                          );
                        }

                        if (f.field_type === "select" && Array.isArray(f.options_json) && f.options_json.length > 0) {
                          return (
                            <div key={f.id} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                              {editingVisa ? (
                                <select value={val} onChange={(e) => onChange(e.target.value)} className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs">
                                  <option value="">{isRtl ? "اختر..." : "Select..."}</option>
                                  {f.options_json.map((opt: any) => (
                                    <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt.value ?? opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-medium">{val || "—"}</span>
                              )}
                            </div>
                          );
                        }

                        if (f.field_type === "date") {
                          return (
                            <div key={f.id} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                              {editingVisa ? (
                                <Input type="date" value={val} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs flex-1" />
                              ) : (
                                <span className="font-medium">
                                  {val ? (() => { try { return format(new Date(val), "PPP"); } catch { return val; } })() : "—"}
                                </span>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={f.id} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                            {editingVisa ? (
                              <Input value={val} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs flex-1" />
                            ) : (
                              <span className="font-medium">{val || "—"}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {visaFields.length > 0 && <Separator />}

                {/* Referral count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    {isRtl ? "الإحالات" : "Referrals"}
                  </span>
                  <span className="font-bold">{referralCount}</span>
                </div>

                <Separator />

                {/* Documents List */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? "المستندات" : "Documents"} ({docs.length})
                  </p>
                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">{isRtl ? "لا توجد مستندات بعد" : "No documents yet"}</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted text-xs border border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate font-medium text-sm">{doc.file_name}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs capitalize px-1 py-0">{doc.category.replace(/_/g, " ")}</Badge>
                                {doc.file_size && <span className="text-muted-foreground">{formatBytes(doc.file_size)}</span>}
                              </div>
                              <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                                <span>{format(new Date(doc.created_at), "dd MMM yyyy, HH:mm")}</span>
                                {doc.uploader_name && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {doc.uploader_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadDoc(doc)} title={isRtl ? "تحميل" : "Download"}>
                              <Download className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteDoc(doc)} title={isRtl ? "حذف" : "Delete"}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Selective Delete Dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setDeleteTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t("admin.students.selectiveDeleteTitle")}
              {deleteTarget && <span className="text-foreground font-normal text-sm"> — {deleteTarget.full_name}</span>}
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <SelectiveDeleteDialog
              student={deleteTarget}
              t={t as (key: string, opts?: any) => string}
              onClose={() => { setShowDeleteDialog(false); setDeleteTarget(null); }}
              onDeleted={() => { setShowDeleteDialog(false); setDeleteTarget(null); setSelected(null); fetchStudents(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Confirm ── */}
      <Dialog open={showResetDialog} onOpenChange={(open) => { if (!open) setShowResetDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              {isRtl ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRtl ? `هل تريد إعادة تعيين كلمة مرور ${selected?.full_name || selected?.email}؟` : `Reset password for ${selected?.full_name || selected?.email}?`}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={resetting}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleResetPassword} disabled={resetting} variant="destructive" className="gap-2">
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isRtl ? "إعادة التعيين" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Password Result ── */}
      <Dialog open={!!resetCreds} onOpenChange={(open) => { if (!open) setResetCreds(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              {isRtl ? "بيانات الدخول الجديدة" : "New Login Credentials"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-3 rounded-lg bg-muted border border-border font-mono text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground text-xs">Email</span>
              <span>{resetCreds?.email}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground text-xs">{isRtl ? "كلمة المرور" : "Password"}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{showResetPw ? resetCreds?.password : "••••••••"}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowResetPw(!showResetPw)}>
                  {showResetPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {isRtl ? "شارك هذه البيانات مع الطالب فورًا. لن تتمكن من رؤيتها مجددًا." : "Share these credentials with the student immediately. They won't be shown again."}
            </p>
          </div>
          <Button className="w-full gap-2" onClick={copyResetCreds}>
            {copiedReset ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedReset ? (isRtl ? "تم النسخ!" : "Copied!") : isRtl ? "نسخ البيانات" : "Copy Credentials"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
