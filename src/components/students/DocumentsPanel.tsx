import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Plus, File, Loader2, Upload } from "lucide-react";
import { validateUploadFile } from "@/lib/uploadRules";
import { logDocumentAccess } from "@/lib/documentAccessLog";
import { useToast } from "@/hooks/use-toast";

/**
 * Shared documents tab for the Student Overview. Backed by the SAME
 * `documents` table the student `DocumentsManager` uses — no second record
 * store, no copies. Team and admin see exactly the rows the student sees.
 *
 * - Team (`canDelete=false`): list + upload only. `uploaded_by` + `case_id`
 *   are stamped so the row is attributed to the acting team member and linked
 *   to the case. Team cannot delete (RLS has no team UPDATE/DELETE policy).
 * - Admin (`canDelete=true`): list + upload + soft-delete, like the existing
 *   admin sheet.
 *
 * Upload reuses the student upload rules (`validateUploadFile`) and the same
 * `student-documents` private bucket + signed-URL download path.
 */

const CATEGORY_KEYS = [
  "passport",
  "certificate",
  "translation",
  "visa",
  "university_letter",
  "language",
  "insurance",
  "financial",
  "housing",
  "other",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

interface DocRow {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader_name: string | null;
}

interface DocumentsPanelProps {
  studentId: string;
  /** Linked case id, stamped on uploads so the row joins to the case. */
  caseId?: string | null;
  /** The acting staff user (team/admin). Stamped as `uploaded_by`. */
  actorUserId?: string | null;
  canDelete?: boolean;
  viewerIsAdmin?: boolean;
}

const toStoragePath = (fileUrl: string): string => {
  const marker = "/student-documents/";
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) return fileUrl.slice(idx + marker.length);
  return fileUrl;
};

const formatBytes = (bytes?: number | null, mbLabel = "MB") => {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} ${mbLabel}`;
};

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Unexpected error";

export default function DocumentsPanel({
  studentId,
  caseId,
  actorUserId,
  canDelete = false,
  viewerIsAdmin = false,
}: DocumentsPanelProps) {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<CategoryKey>("other");
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_url, category, file_size, file_type, notes, created_at, uploaded_by")
        .eq("student_id", studentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const raw = (data as Omit<DocRow, "uploader_name">[]) ?? [];
      const uploaderIds = [...new Set(raw.map((d) => d.uploaded_by).filter(Boolean) as string[])];
      const uploaderMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uploaderIds);
        (profs ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
          uploaderMap[p.id] = p.full_name || p.email;
        });
      }
      setDocs(
        raw.map((d) => ({
          ...d,
          uploader_name: d.uploaded_by ? uploaderMap[d.uploaded_by] || null : null,
        })),
      );
    } catch (err: unknown) {
      toast({ variant: "destructive", description: errMsg(err) });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Live refresh when anyone (student, another team member, admin) adds/removes
  // a document for this student — single source of truth stays in sync.
  useEffect(() => {
    const channel = supabase
      .channel(`student-overview-docs-${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `student_id=eq.${studentId}` },
        () => fetchDocs(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, fetchDocs]);

  const resetUpload = () => {
    setFile(null);
    setCategory("other");
    setCustomName("");
    setNotes("");
    setExpiryDate("");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ variant: "destructive", description: t("documents.selectFile") });
      return;
    }
    const uploadError = validateUploadFile(file);
    if (uploadError) {
      const isSizeError = /MB limit/.test(uploadError);
      toast({
        variant: "destructive",
        title: isSizeError ? t("documents.fileTooLarge", "File is too large") : t("documents.invalidType", "Unsupported file type"),
        description: uploadError,
      });
      return;
    }
    if (category === "other" && !customName.trim()) {
      toast({
        variant: "destructive",
        description: t("documents.customNameRequired", { defaultValue: "Please enter a document name" }),
      });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${studentId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("student-documents")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const displayName = category === "other" && customName.trim() ? customName.trim() : file.name;
      const { error: dbError } = await supabase.from("documents").insert({
        student_id: studentId,
        file_name: displayName,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        category,
        expiry_date: expiryDate || null,
        notes: notes || null,
        uploaded_by: actorUserId ?? null,
        case_id: caseId ?? null,
        is_visible_to_student: true,
      });
      if (dbError) throw dbError;
      toast({ title: t("documents.uploadSuccess"), description: t("documents.uploadSuccessDesc") });
      setShowUpload(false);
      resetUpload();
      fetchDocs();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("documents.uploadError"), description: errMsg(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocRow) => {
    try {
      logDocumentAccess(doc.id, "download");
      const storagePath = toStoragePath(doc.file_url);
      const { data, error } = await supabase.storage
        .from("student-documents")
        .createSignedUrl(storagePath, 60);
      if (error) throw error;
      const resp = await fetch(data.signedUrl);
      if (!resp.ok) throw new Error("Failed to fetch file");
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = blobUrl;
      a.download = doc.file_name;
      a.style.display = "none";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("documents.downloadError"), description: errMsg(err) });
    }
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm(t("documents.deleteConfirm"))) return;
    try {
      const storagePath = toStoragePath(doc.file_url);
      const { error: storageError } = await supabase.storage.from("student-documents").remove([storagePath]);
      if (storageError) console.warn("[DocumentsPanel] storage delete failed:", storageError);
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      toast({ title: t("documents.deleteSuccess"), description: t("documents.deleteSuccessDesc") });
      fetchDocs();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("documents.deleteError"), description: errMsg(err) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {isAr ? "المستندات" : "Documents"} ({docs.length})
        </p>
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("documents.upload")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("documents.uploadNew")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("documents.file")}</Label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("documents.fileHint")} — {t("documents.maxSize", { defaultValue: "Max 15 MB" })}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("documents.category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v as CategoryKey);
                    if (v !== "other") setCustomName("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`documents.categories.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {category === "other" && (
                <div className="space-y-2">
                  <Label>{t("documents.customDocName", { defaultValue: "Document name" })}</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={t("documents.customDocNamePlaceholder", { defaultValue: "e.g. Birth Certificate" })}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("documents.expiryDate")}</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("documents.notes")}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("documents.optionalNotes")}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={uploading} className="w-full gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? t("documents.uploading") : t("documents.uploadBtn")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{t("documents.noDocuments")}</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{doc.file_name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize px-1 py-0">
                      {t(`documents.categories.${doc.category}`, doc.category.replace(/_/g, " "))}
                    </Badge>
                    {doc.file_size ? (
                      <span className="text-muted-foreground text-xs">{formatBytes(doc.file_size, t("documents.mb"))}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground mt-0.5 text-xs">
                    <span>{new Date(doc.created_at).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</span>
                    {doc.uploader_name && (
                      <span className="flex items-center gap-1">
                        {doc.uploader_name}
                      </span>
                    )}
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground truncate">{doc.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(doc)}
                  title={isAr ? "تحميل" : "Download"}
                  aria-label={isAr ? "تحميل" : "Download"}
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(doc)}
                    title={isAr ? "حذف" : "Delete"}
                    aria-label={isAr ? "حذف" : "Delete"}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {viewerIsAdmin && canDelete && (
        <p className="text-[11px] text-muted-foreground">
          {t("studentOverview.documentsHint", "Student and authorized team can see these documents.")}
        </p>
      )}
    </div>
  );
}
